import React from 'react';
import { View, Text, Modal, StyleSheet, ActivityIndicator } from 'react-native';
import { useTheme } from '../../../theme/ThemeContext';

interface Props {
    visible: boolean;
    title?: string;
    message?: string;
}

export const ToolProgressModal: React.FC<Props> = ({
    visible,
    title = 'Procesando PDF...',
    message = 'Por favor espera unos momentos',
}) => {
    const { colors, isDarkMode } = useTheme();

    if (!visible) return null;

    return (
        <Modal transparent visible={visible} animationType="fade">
            <View style={styles.overlay}>
                <View
                    style={[
                        styles.card,
                        {
                            backgroundColor: colors.surfaceLight,
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={[styles.title, { color: colors.text }]}>{title}</Text>
                    <Text style={[styles.message, { color: colors.textSecondary }]}>{message}</Text>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    card: {
        width: '100%',
        maxWidth: 320,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 12,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.3,
        shadowRadius: 10,
    },
    title: {
        fontSize: 16,
        fontWeight: '700',
        marginTop: 16,
        textAlign: 'center',
    },
    message: {
        fontSize: 13,
        marginTop: 6,
        textAlign: 'center',
    },
});
