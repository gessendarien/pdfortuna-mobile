import React, { useMemo } from 'react';
import { format } from 'date-fns';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { LocalFile } from '../services/FileService';
import { MarqueeText } from './MarqueeText';
import { t } from '../i18n';

interface Props {
    visible: boolean;
    file: LocalFile | null;
    isFavorite: boolean;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
    onShare: () => void;
    onFavorite: () => void;
}

export const FileOptionsModal = ({ visible, file, isFavorite, onClose, onRename, onDelete, onShare, onFavorite }: Props) => {
    const { colors, isDarkMode } = useTheme();

    if (!file) return null;

    const formattedDate = useMemo(() => format(file.date, 'MMM dd, yyyy'), [file.date]);

    const formattedSize = useMemo(() => {
        const bytes = file.size;
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }, [file.size]);

    const renderOption = (
        icon: string,
        label: string,
        onPress: () => void,
        iconColor: string,
        bgColor: string,
        textColor: string = colors.text
    ) => (
        <TouchableOpacity
            style={styles.option}
            onPress={onPress}
            activeOpacity={0.7}
        >
            <View style={[styles.iconCircle, { backgroundColor: bgColor }]}>
                <MaterialIcon name={icon} size={22} color={iconColor} />
            </View>
            <Text style={[styles.optionText, { color: textColor }]}>{label}</Text>
            <MaterialIcon name="chevron-right" size={20} color={colors.border} style={styles.chevron} />
        </TouchableOpacity>
    );

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={[styles.content, { backgroundColor: colors.surfaceLight }]}>
                    {/* Header with marquee file name */}
                    <View style={styles.header}>
                        <View style={styles.titleRow}>
                            <MaterialIcon name="description" size={24} color={colors.primary} />
                            <MarqueeText text={file.name} style={[styles.title, { color: colors.text }]} />
                        </View>
                        <Text style={[styles.metaText, { color: colors.textSecondary }]}>
                            {formattedSize}
                            {` • ${formattedDate}`}
                            {file.pageCount !== undefined ? ` • ${file.pageCount} p.` : ''}
                        </Text>
                    </View>

                    <View style={[styles.divider, { backgroundColor: colors.border }]} />

                    {/* Options */}
                    <View style={styles.optionsContainer}>
                        {renderOption(
                            isFavorite ? "favorite" : "favorite-border",
                            isFavorite ? t('fileOptions.removeFavorite') : t('fileOptions.addFavorite'),
                            () => {
                                onFavorite();
                                onClose();
                            },
                            isFavorite ? "#ef4444" : "#f87171",
                            isFavorite ? "#fee2e2" : "#fef2f2",
                            isFavorite ? "#ef4444" : colors.text
                        )}

                        {renderOption(
                            "share",
                            t('fileOptions.share'),
                            () => {
                                onClose();
                                setTimeout(onShare, 300);
                            },
                            "#3b82f6",
                            "#dbeafe"
                        )}

                        {renderOption(
                            "edit",
                            t('fileOptions.rename'),
                            () => {
                                onClose();
                                setTimeout(onRename, 300);
                            },
                            "#8b5cf6",
                            "#ede9fe"
                        )}

                        {renderOption(
                            "delete",
                            t('fileOptions.delete'),
                            () => {
                                onClose();
                                setTimeout(onDelete, 300);
                            },
                            "#64748b",
                            isDarkMode ? '#FFFFFF' : "#e2e8f0",
                            colors.text
                        )}
                    </View>

                    {/* Cancel button */}
                    <TouchableOpacity style={[styles.buttonClose, { backgroundColor: isDarkMode ? '#2a2a2a' : '#f8fafc' }]} onPress={onClose}>
                        <Text style={[styles.buttonCloseText, { color: colors.textSecondary }]}>{t('fileOptions.cancel')}</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'flex-end',
        alignItems: 'center',
    },
    content: {
        width: '100%',
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        paddingBottom: 24,
        elevation: 10,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: -4 },
        shadowOpacity: 0.15,
        shadowRadius: 12,
    },
    header: {
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
    },
    titleRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        marginBottom: 4,
    },
    metaText: {
        fontSize: 13,
        marginLeft: 36, // 24(icon) + 12(gap)
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
    },
    divider: {
        height: 1,
        marginHorizontal: 24,
    },
    optionsContainer: {
        paddingTop: 8,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 14,
        paddingHorizontal: 24,
    },
    iconCircle: {
        width: 44,
        height: 44,
        borderRadius: 22,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 16,
    },
    optionText: {
        flex: 1,
        fontSize: 16,
        fontWeight: '500',
    },
    chevron: {
        opacity: 0.3,
    },
    buttonClose: {
        marginTop: 8,
        marginHorizontal: 24,
        alignItems: 'center',
        paddingVertical: 14,
        borderRadius: 12,
    },
    buttonCloseText: {
        fontSize: 16,
        fontWeight: '600',
    }
});
