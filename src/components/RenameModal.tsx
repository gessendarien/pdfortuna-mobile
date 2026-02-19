import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TextInput, TouchableOpacity, StyleSheet, Platform } from 'react-native';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

interface Props {
    visible: boolean;
    currentName: string;
    onClose: () => void;
    onRename: (newName: string) => void;
    title?: string;
    saveLabel?: string;
}

export const RenameModal = ({ visible, currentName, onClose, onRename, title, saveLabel }: Props) => {
    const { colors } = useTheme();
    const [name, setName] = useState(currentName);
    const [extension, setExtension] = useState('.pdf');
    const inputRef = useRef<TextInput>(null);

    const resolvedTitle = title || t('rename.title');
    const resolvedSaveLabel = saveLabel || t('rename.save');

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
            const timer = setTimeout(() => {
                inputRef.current?.focus();
            }, Platform.OS === 'android' ? 300 : 100);
            return () => clearTimeout(timer);
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
                <View style={[styles.content, { backgroundColor: colors.surfaceLight }]}>
                    <Text style={[styles.title, { color: colors.text }]}>{resolvedTitle}</Text>
                    <View style={[styles.inputContainer, { borderColor: colors.border }]}>
                        <TextInput
                            ref={inputRef}
                            style={[styles.input, { color: colors.text }]}
                            value={name}
                            onChangeText={setName}
                            selectTextOnFocus
                            placeholderTextColor={colors.textSecondary}
                        />
                        <Text style={[styles.extension, { color: colors.textSecondary }]}>{extension}</Text>
                    </View>
                    <View style={styles.actions}>
                        <TouchableOpacity onPress={onClose} style={styles.buttonCancel}>
                            <Text style={[styles.textCancel, { color: colors.textSecondary }]}>{t('rename.cancel')}</Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={handleSave} style={[styles.buttonSave, { backgroundColor: colors.primary }]}>
                            <Text style={styles.textSave}>{resolvedSaveLabel}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal >
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
        borderRadius: 12,
        padding: 20,
        elevation: 5,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        marginBottom: 16,
    },
    inputContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 12,
        marginBottom: 20,
    },
    input: {
        flex: 1,
        paddingVertical: 12,
        fontSize: 16,
    },
    extension: {
        fontSize: 16,
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
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    textCancel: {
        fontWeight: '600',
    },
    textSave: {
        color: '#fff',
        fontWeight: '600',
    },
});
