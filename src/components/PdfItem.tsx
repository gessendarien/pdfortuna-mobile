import React, { useMemo, useEffect, useRef, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated, Dimensions, Image } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import FileIcon from 'react-native-vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';
import { LocalFile, getThumbnail } from '../services/FileService';
import { format } from 'date-fns';
import { FavoriteParticles } from './FavoriteParticles';

const SCREEN_WIDTH = Dimensions.get('window').width;

interface Props {
    file: LocalFile;
    onPress: () => void;
    onShare: () => void;
    onFavorite: () => void;
    isFavorite: boolean;
    onRename: () => void;
    onDelete: () => void;
    isDeleting?: boolean;
    isRestoring?: boolean;
    onLongPress?: () => void;
    showPreview?: boolean;
}

export const PdfItem = ({ file, onPress, onShare, onFavorite, isFavorite, onRename, onDelete, isDeleting, isRestoring, onLongPress, showPreview = false }: Props) => {
    const formattedDate = useMemo(() => format(file.date, 'MMM dd, yyyy'), [file.date]);
    const [showBurst, setShowBurst] = React.useState(false);
    const prevFavorite = useRef(isFavorite);
    const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

    // Load thumbnail if preview is enabled
    useEffect(() => {
        let isMounted = true;
        if (showPreview && file.type === 'pdf') {
            getThumbnail(file.path).then(uri => {
                if (isMounted) setThumbnailUri(uri);
            });
        }
        return () => { isMounted = false; };
    }, [showPreview, file.path]);

    useEffect(() => {
        if (!prevFavorite.current && isFavorite) {
            setShowBurst(true);
            setTimeout(() => setShowBurst(false), 1000);
        }
        prevFavorite.current = isFavorite;
    }, [isFavorite]);

    // Icon logic
    const { iconName, iconColor, bgColor } = useMemo(() => {
        switch (file.type) {
            case 'pdf':
                return { iconName: 'file-pdf-box', iconColor: '#ef4444', bgColor: '#fee2e2' };
            case 'doc':
            case 'docx':
                return { iconName: 'file-word-box', iconColor: '#3b82f6', bgColor: '#dbeafe' };
            case 'odf':
                // Using a distinct color and icon for Open Document Format
                return { iconName: 'text-box', iconColor: '#f59e0b', bgColor: '#fef3c7' }; // Amber/Orange
            default:
                return { iconName: 'file', iconColor: '#64748b', bgColor: '#f1f5f9' };
        }
    }, [file.type]);

    // Animation value: 0 = default position, -SCREEN_WIDTH = off screen left
    const translateX = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (isDeleting) {
            // Slide out to LEFT
            Animated.timing(translateX, {
                toValue: -SCREEN_WIDTH,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else if (isRestoring) {
            // If restoring, we might want to start from -SCREEN_WIDTH and go to 0
            // But React renders a new component instance unless we keep key consistent. 
            // Assuming key is consistent, we can animate back.
            // If key changes, we need to set initial value.
            // Let's assume parent handles state/key properly.
            translateX.setValue(-SCREEN_WIDTH);
            Animated.spring(translateX, {
                toValue: 0,
                useNativeDriver: true,
                bounciness: 6
            }).start();
        } else {
            // Reset if needed (e.g. recycling views)
            translateX.setValue(0);
        }
    }, [isDeleting, isRestoring]);

    // Format size logic
    const formattedSize = useMemo(() => {
        const bytes = file.size;
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }, [file.size]);

    return (
        <Animated.View style={[styles.swipeWrapper, { transform: [{ translateX }] }]}>
            <View style={styles.container}>
                <TouchableOpacity
                    style={styles.mainContent}
                    onPress={onPress}
                    onLongPress={onLongPress}
                    activeOpacity={0.7}
                >
                    <View style={[styles.iconContainer, {
                        backgroundColor: (showPreview && file.type === 'pdf' && thumbnailUri) ? '#f1f5f9' : bgColor,
                        overflow: 'hidden'
                    }]}>
                        {showPreview && file.type === 'pdf' && thumbnailUri ? (
                            <Image
                                source={{ uri: thumbnailUri }}
                                style={{ width: '100%', height: '100%', resizeMode: 'cover' }}
                            />
                        ) : (
                            <FileIcon name={iconName} size={28} color={iconColor} />
                        )}
                    </View>
                    <View style={styles.infoContainer}>
                        <Text style={styles.name} numberOfLines={1}>{file.name}</Text>
                        <View style={styles.metaContainer}>
                            <Text style={styles.metaText}>{formattedSize}</Text>
                            <View style={styles.dot} />
                            <Text style={styles.metaText}>{formattedDate}</Text>
                        </View>
                    </View>
                </TouchableOpacity>

                <View style={styles.actionsContainer}>
                    <TouchableOpacity onPress={onFavorite} style={styles.actionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Icon name={isFavorite ? "favorite" : "favorite-border"} size={24} color={isFavorite ? "#ef4444" : "#94a3b8"} />
                        <FavoriteParticles trigger={showBurst} />
                    </TouchableOpacity>
                    <TouchableOpacity onPress={onShare} style={styles.actionButton} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                        <Icon name="share" size={20} color={theme.colors.primary} />
                    </TouchableOpacity>
                </View>
            </View>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    swipeWrapper: {
        marginHorizontal: theme.spacing.m,
        marginBottom: theme.spacing.s,
        backgroundColor: 'transparent',
    },
    container: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: theme.spacing.m,
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: theme.borderRadius.l,
        // Shadow
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
    },
    mainContent: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
    },
    iconContainer: {
        width: 40,
        height: 40,
        borderRadius: theme.borderRadius.m,
        backgroundColor: '#fee2e2', // red-50
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: theme.spacing.m,
    },
    infoContainer: {
        flex: 1,
        justifyContent: 'center',
    },
    name: {
        fontSize: 16,
        fontWeight: '600',
        color: theme.colors.text,
        marginBottom: 2,
    },
    metaContainer: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 12,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    dot: {
        width: 4,
        height: 4,
        borderRadius: 2,
        backgroundColor: '#cbd5e1',
        marginHorizontal: 6,
    },
    actionsContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    actionButton: {
        padding: 6,
    }
});
