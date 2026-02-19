import React, { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform, Animated, Image } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { LocalFile, getThumbnail } from '../services/FileService';
import { format } from 'date-fns';
import { FavoriteParticles } from './FavoriteParticles';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2;

interface Props {
    file: LocalFile;
    onPress: () => void;
    onMore: () => void;
    isFavorite: boolean;
    showPreview?: boolean;
    isDeleting?: boolean;
    isRestoring?: boolean;
}

export const PdfGridItem = ({ file, onPress, onMore, isFavorite, showPreview = false, isDeleting, isRestoring }: Props) => {
    const { colors, isDarkMode } = useTheme();
    const scaleAnim = useRef(new Animated.Value(1)).current;
    const [thumbnailUri, setThumbnailUri] = useState<string | null>(null);

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
        if (isDeleting) {
            Animated.timing(scaleAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else if (isRestoring) {
            scaleAnim.setValue(0);
            Animated.spring(scaleAnim, {
                toValue: 1,
                useNativeDriver: true,
                bounciness: 6
            }).start();
        } else {
            scaleAnim.setValue(1);
        }
    }, [isDeleting, isRestoring]);

    const [showBurst, setShowBurst] = useState(false);
    const prevFavorite = useRef(isFavorite);

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
                return { iconName: 'text-box', iconColor: '#f59e0b', bgColor: '#fef3c7' };
            default:
                return { iconName: 'file', iconColor: '#64748b', bgColor: '#f1f5f9' };
        }
    }, [file.type]);

    const formattedDate = useMemo(() => format(file.date, 'dd MMM'), [file.date]);

    const formattedSize = useMemo(() => {
        const bytes = file.size;
        if (bytes === 0) return '0 B';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + (['B', 'KB', 'MB', 'GB'][i]);
    }, [file.size]);

    return (
        <Animated.View style={{ transform: [{ scale: scaleAnim }], opacity: scaleAnim }}>
            <TouchableOpacity
                style={[styles.card, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                onPress={onPress}
                activeOpacity={0.7}
                onLongPress={onMore}
            >
                {isFavorite && (
                    <View style={[styles.favoriteBadge, { backgroundColor: isDarkMode ? 'rgba(30,30,30,0.9)' : 'rgba(255,255,255,0.9)' }]}>
                        <MaterialIcon name="favorite" size={18} color="#ef4444" />
                        <FavoriteParticles trigger={showBurst} />
                    </View>
                )}
                <View
                    style={[styles.iconContainer, { backgroundColor: (showPreview && file.type === 'pdf') ? '#f1f5f9' : bgColor, overflow: 'hidden' }]}
                    pointerEvents="none"
                >
                    {showPreview && file.type === 'pdf' && thumbnailUri ? (
                        <Image
                            source={{ uri: thumbnailUri }}
                            style={{ flex: 1, width: '100%', height: '100%', resizeMode: 'cover' }}
                        />
                    ) : (
                        <MaterialCommunityIcons name={iconName} size={48} color={iconColor} />
                    )}
                </View>

                <View style={styles.infoContainer}>
                    <Text style={[styles.name, { color: colors.text }]} numberOfLines={2}>{file.name}</Text>
                    <View style={styles.metaRow}>
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>{formattedDate}</Text>
                        {file.pageCount !== undefined && <Text style={[styles.metaText, { color: colors.textSecondary }]}> • {file.pageCount} p.</Text>}
                    </View>
                </View>

                <TouchableOpacity
                    style={[styles.moreButton, {
                        backgroundColor: colors.surfaceLight,
                    }]}
                    onPress={onMore}
                    hitSlop={10}
                >
                    <MaterialIcon name="more-vert" size={20} color={colors.textSecondary} />
                </TouchableOpacity>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    card: {
        width: CARD_WIDTH,
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
    },
    iconContainer: {
        width: '100%',
        height: 160,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 12,
    },
    infoContainer: {
        marginBottom: 4,
    },
    name: {
        fontSize: 14,
        fontWeight: '600',
        marginBottom: 4,
        lineHeight: 18,
        height: 36,
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 11,
    },
    moreButton: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        borderRadius: 6,
        zIndex: 10,
    },
    favoriteBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        borderRadius: 12,
        padding: 4,
        zIndex: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 1,
        elevation: 1,
    }
});
