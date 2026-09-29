import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme/ThemeContext';

interface Props {
    visible: boolean;
    onClose: () => void;
    onConfirm: (mode: 'copy' | 'original') => void;
    title?: string;
    description?: string;
}

export const SaveModeModal: React.FC<Props> = ({
    visible,
    onClose,
    onConfirm,
    title = '¿Cómo deseas guardar el PDF?',
    description = 'Selecciona una opción para aplicar los cambios:',
}) => {
    const { colors } = useTheme();
    const [selectedOption, setSelectedOption] = useState<'copy' | 'original'>('copy');

    useEffect(() => {
        if (visible) {
            setSelectedOption('copy');
        }
    }, [visible]);

    const handleConfirm = () => {
        onConfirm(selectedOption);
    };

    return (
        <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
            <View style={styles.backdrop}>
                <View style={[styles.card, { backgroundColor: colors.surfaceLight }]}>
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
                        {description}
                    </Text>

                    {/* Option A: Make a copy */}
                    <TouchableOpacity
                        style={[
                            styles.option,
                            {
                                backgroundColor:
                                    selectedOption === 'copy'
                                        ? 'rgba(221, 31, 71, 0.08)'
                                        : colors.backgroundLight,
                                borderColor: selectedOption === 'copy' ? colors.primary : colors.border,
                                borderWidth: selectedOption === 'copy' ? 2 : 1,
                            },
                        ]}
                        onPress={() => setSelectedOption('copy')}
                        activeOpacity={0.8}
                    >
                        <Icon
                            name={selectedOption === 'copy' ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={22}
                            color={selectedOption === 'copy' ? colors.primary : colors.textSecondary}
                            style={{ marginRight: 12 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text
                                style={[
                                    styles.optionTitle,
                                    {
                                        color: selectedOption === 'copy' ? colors.primary : colors.text,
                                        fontWeight: selectedOption === 'copy' ? '700' : '500',
                                    },
                                ]}
                            >
                                Hacer una copia y guardar
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Option B: Overwrite original */}
                    <TouchableOpacity
                        style={[
                            styles.option,
                            {
                                backgroundColor:
                                    selectedOption === 'original'
                                        ? 'rgba(221, 31, 71, 0.08)'
                                        : colors.backgroundLight,
                                borderColor: selectedOption === 'original' ? colors.primary : colors.border,
                                borderWidth: selectedOption === 'original' ? 2 : 1,
                            },
                        ]}
                        onPress={() => setSelectedOption('original')}
                        activeOpacity={0.8}
                    >
                        <Icon
                            name={selectedOption === 'original' ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={22}
                            color={selectedOption === 'original' ? colors.primary : colors.textSecondary}
                            style={{ marginRight: 12 }}
                        />
                        <View style={{ flex: 1 }}>
                            <Text
                                style={[
                                    styles.optionTitle,
                                    {
                                        color: selectedOption === 'original' ? colors.primary : colors.text,
                                        fontWeight: selectedOption === 'original' ? '700' : '500',
                                    },
                                ]}
                            >
                                Guardar en el documento original
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Actions: Continuar & Cancelar */}
                    <View style={styles.actionsRow}>
                        <TouchableOpacity
                            style={[styles.continueBtn, { backgroundColor: colors.primary }]}
                            onPress={handleConfirm}
                            activeOpacity={0.85}
                        >
                            <Text style={styles.continueBtnText}>Continuar</Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.cancelBtn, { borderColor: colors.border }]}
                            onPress={onClose}
                            activeOpacity={0.7}
                        >
                            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    backdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    card: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 20,
        padding: 20,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 10,
    },
    title: {
        fontSize: 17,
        fontWeight: 'bold',
        marginBottom: 6,
    },
    subtitle: {
        fontSize: 13,
        marginBottom: 16,
        lineHeight: 18,
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        marginBottom: 12,
    },
    optionTitle: {
        fontSize: 14,
    },
    actionsRow: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 10,
    },
    continueBtn: {
        paddingHorizontal: 20,
        paddingVertical: 10,
        borderRadius: 10,
    },
    continueBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    cancelBtn: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderRadius: 10,
        borderWidth: 1,
    },
    cancelBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
});
