import React, { useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Dimensions, Platform } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import Pdf from 'react-native-pdf';
import { theme } from '../theme';
import { LocalFile } from '../services/FileService';
import { format } from 'date-fns';

const SCREEN_WIDTH = Dimensions.get('window').width;
const CARD_WIDTH = (SCREEN_WIDTH - 48) / 2; // (16 padding on sides + 16 gap) / 2

interface Props {
    file: LocalFile;
    onPress: () => void;
    onMore: () => void;
    isFavorite: boolean;
}

export const PdfGridItem = ({ file, onPress, onMore, isFavorite }: Props) => {

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

    // Format size logic
    const formattedSize = useMemo(() => {
        const bytes = file.size;
        if (bytes === 0) return '0 B';
        const k = 1024;
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + (['B', 'KB', 'MB', 'GB'][i]);
    }, [file.size]);

    return (
        <TouchableOpacity
            style={styles.card}
            onPress={onPress}
            activeOpacity={0.7}
            onLongPress={onMore} // Long press as fallback if no button
        >
            {isFavorite && (
                <View style={styles.favoriteBadge}>
                    <MaterialIcon name="favorite" size={18} color="#ef4444" />
                </View>
            )}
            <View style={[styles.iconContainer, { backgroundColor: bgColor }]}>
                <MaterialCommunityIcons name={iconName} size={48} color={iconColor} />
            </View>

            <View style={styles.infoContainer}>
                <Text style={styles.name} numberOfLines={2}>{file.name}</Text>
                <View style={styles.metaRow}>
                    <Text style={styles.metaText}>{formattedSize}</Text>
                    <Text style={styles.metaText}> • {formattedDate}</Text>
                </View>
            </View>

            <TouchableOpacity style={styles.moreButton} onPress={onMore} hitSlop={10}>
                <MaterialIcon name="more-vert" size={20} color={theme.colors.textSecondary} />
            </TouchableOpacity>
        </TouchableOpacity>
    );
};

const styles = StyleSheet.create({
    card: {
        width: CARD_WIDTH,
        backgroundColor: theme.colors.surfaceLight,
        borderRadius: 16,
        padding: 12,
        marginBottom: 16,
        borderWidth: 1,
        borderColor: theme.colors.border,
        // Optional shadow
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
        color: theme.colors.text,
        marginBottom: 4,
        lineHeight: 18,
        height: 36, // Force height for 2 lines usually
    },
    metaRow: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    metaText: {
        fontSize: 11,
        color: theme.colors.textSecondary,
    },
    moreButton: {
        position: 'absolute',
        bottom: 8,
        right: 8,
        width: 28,
        height: 28,
        justifyContent: 'center',
        alignItems: 'center',
        backgroundColor: 'rgba(255,255,255,0.9)', // Slightly more opaque since it's on top of potentially complex bg? No, card is generic.
        borderRadius: 6,
        borderWidth: 1,
        borderColor: 'rgba(0,0,0,0.05)',
        zIndex: 10,
    },
    favoriteBadge: {
        position: 'absolute',
        top: 8,
        left: 8,
        backgroundColor: 'rgba(255,255,255,0.9)',
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
