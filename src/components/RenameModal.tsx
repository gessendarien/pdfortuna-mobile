import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import { theme } from '../theme';

interface Props {
    visible: boolean;
    currentName: string;
    onClose: () => void;
    onRename: (newName: string) => void;
}

export const RenameModal = ({ visible, currentName, onClose, onRename }: Props) => {
    const [name, setName] = useState(currentName);
    const [extension, setExtension] = useState('.pdf');

    useEffect(() => {
        if (visible) {
            const lastDotIndex = currentName.lastIndexOf('.');
            if (lastDotIndex !== -1) {
                setName(currentName.substring(0, lastDotIndex));
                setExtension(currentName.substring(lastDotIndex));
            } else {
                setName(currentName);
                setExtension('');
            }
        }
    }, [visible, currentName]);

    const handleSave = () => {
        if (!name.trim()) return;
        onRename(`${name.trim()}${extension}`);
        onClose();
    };

    return (
        <Modal transparent visible={visible} animationType="fade" onRequestClose={onClose}>
            <View style={styles.overlay}>
                <View style={styles.content}>
                    <Text style={styles.title}>Renombrar Archivo</Text>
                    <View style={styles.inputContainer}>
                        <TextInput
                            style={styles.input}
                            value={name}
                            onChangeText={setName}
                            autoFocus
                            selectTextOnFocus
                        />
                        <Text style={styles.extension}>{extension}</Text>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity onPress={onClose} style={styles.buttonCancel}>
                            <Text style={styles.textCancel}>Cancelar</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSave} style={styles.buttonSave}>
                            <Text style={styles.textSave}>Guardar</Text>
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
        backgroundColor: '#fff',
        borderRadius: 12,
        padding: 20,
        elevation: 5,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
        color: theme.colors.text,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderColor: theme.colors.border,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 20,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
        color: theme.colors.text,
    },
    extension: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        marginLeft: 4,
    },
    actions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
    },
    buttonCancel: {
        paddingVertical: 10,
        paddingHorizontal: 16,
    },
    buttonSave: {
        backgroundColor: theme.colors.primary,
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    textCancel: {
        color: theme.colors.textSecondary,
        fontWeight: '600',
    },
    textSave: {
        color: '#fff',
        fontWeight: '600',
    },
});
