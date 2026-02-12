import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Props {
    visible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    onCancel: () => void;
    confirmText?: string;
    cancelText?: string;
    confirmColor?: string;
}

export const ConfirmModal = ({
    visible,
    title,
    message,
    onConfirm,
    onCancel,
    confirmText = "Confirmar",
    cancelText = "Cancelar",
    confirmColor = theme.colors.primary
}: Props) => {
    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onCancel}
        >
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <Text style={styles.title}>{title}</Text>
                    <Text style={styles.message}>{message}</Text>

                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={styles.cancelButton} onPress={onCancel}>
                            <Text style={styles.cancelButtonText}>{cancelText}</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.confirmButton, { backgroundColor: confirmColor }]}
                            onPress={onConfirm}
                        >
                            <Text style={styles.confirmButtonText}>{confirmText}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
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
        maxWidth: 320,
        backgroundColor: 'white',
        borderRadius: 20,
        padding: 24,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    title: {
        fontSize: 20,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 8,
    },
    message: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginBottom: 24,
        lineHeight: 22,
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
    },
    cancelButtonText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        fontWeight: '500',
    },
    confirmButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    confirmButtonText: {
        fontSize: 16,
        color: 'white',
        fontWeight: '600',
    },
});
