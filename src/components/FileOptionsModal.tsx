import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme';
import { LocalFile } from '../services/FileService';

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

    const renderOption = (icon: string, label: string, onPress: () => void, color: string = theme.colors.text) => (
        <TouchableOpacity style={styles.option} onPress={onPress}>
            <View style={styles.iconContainer}>
                <MaterialIcon name={icon} size={24} color={color} />
            </View>
            <Text style={styles.optionText}>{label}</Text>
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
                <View style={styles.content}>
                    <Text style={styles.title} numberOfLines={1}>{file.name}</Text>

                    {renderOption(isFavorite ? "favorite" : "favorite-border", isFavorite ? "Quitar de favoritos" : "Añadir a favoritos", () => {
                        onFavorite();
                        onClose();
                    }, isFavorite ? "#ef4444" : theme.colors.text)}

                    {renderOption("edit", "Renombrar", () => {
                        onClose();
                        setTimeout(onRename, 300);
                    }, theme.colors.primary)}

                    {renderOption("share", "Compartir", () => {
                        onClose();
                        setTimeout(onShare, 300);
                    }, theme.colors.primary)}

                    {renderOption("delete", "Eliminar", () => {
                        onClose();
                        setTimeout(onDelete, 300);
                    }, theme.colors.textSecondary)}

                    <TouchableOpacity style={styles.buttonClose} onPress={onClose}>
                        <Text style={styles.buttonCloseText}>Cancelar</Text>
                    </TouchableOpacity>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        width: '100%',
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 24,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 20,
        textAlign: 'center',
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 12,
    },
    iconContainer: {
        width: 40,
        alignItems: 'center',
        marginRight: 12,
    },
    optionText: {
        fontSize: 16,
        fontWeight: '500',
        color: theme.colors.text,
    },
    buttonClose: {
        marginTop: 16,
        alignItems: 'center',
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: theme.colors.border,
    },
    buttonCloseText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
        fontWeight: '500',
    }
});
