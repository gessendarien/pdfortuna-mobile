import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme';
import { LocalFile } from '../services/FileService';
import { MarqueeText } from './MarqueeText';

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
    if (!file) return null;

    const renderOption = (
        icon: string,
        label: string,
        onPress: () => void,
        iconColor: string,
        bgColor: string,
        textColor: string = theme.colors.text
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
            <MaterialIcon name="chevron-right" size={20} color="#cbd5e1" style={styles.chevron} />
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
                <TouchableOpacity activeOpacity={1} style={styles.content}>
                    {/* Header with marquee file name */}
                    <View style={styles.header}>
                        <MaterialIcon name="description" size={24} color={theme.colors.primary} />
                        <MarqueeText text={file.name} style={styles.title} />
                    </View>

                    <View style={styles.divider} />

                    {/* Options */}
                    <View style={styles.optionsContainer}>
                        {renderOption(
                            isFavorite ? "favorite" : "favorite-border",
                            isFavorite ? "Quitar de favoritos" : "Añadir a favoritos",
                            () => {
                                onFavorite();
                                onClose();
                            },
                            isFavorite ? "#ef4444" : "#f87171",
                            isFavorite ? "#fee2e2" : "#fef2f2",
                            isFavorite ? "#ef4444" : theme.colors.text
                        )}

                        {renderOption(
                            "share",
                            "Compartir",
                            () => {
                                onClose();
                                setTimeout(onShare, 300);
                            },
                            "#3b82f6",
                            "#dbeafe"
                        )}

                        {renderOption(
                            "edit",
                            "Renombrar",
                            () => {
                                onClose();
                                setTimeout(onRename, 300);
                            },
                            "#8b5cf6",
                            "#ede9fe"
                        )}

                        {renderOption(
                            "delete",
                            "Eliminar",
                            () => {
                                onClose();
                                setTimeout(onDelete, 300);
                            },
                            "#64748b",
                            "#f1f5f9",
                            "#64748b"
                        )}
                    </View>

                    {/* Cancel button */}
                    <TouchableOpacity style={styles.buttonClose} onPress={onClose}>
                        <Text style={styles.buttonCloseText}>Cancelar</Text>
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
        backgroundColor: '#fff',
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
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 24,
        paddingTop: 24,
        paddingBottom: 16,
        gap: 12,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        color: theme.colors.text,
    },
    divider: {
        height: 1,
        backgroundColor: '#f1f5f9',
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
        color: theme.colors.text,
    },
    chevron: {
        opacity: 0.3,
    },
    buttonClose: {
        marginTop: 8,
        marginHorizontal: 24,
        alignItems: 'center',
        paddingVertical: 14,
        backgroundColor: '#f8fafc',
        borderRadius: 12,
    },
    buttonCloseText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
        fontWeight: '600',
    }
});
