import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme/ThemeContext';

interface Props {
    resultPaths: string[];
    onOpen: (path: string) => void;
    onShare: (path: string) => void;
    onReset: () => void;
}

export const ToolResultBar: React.FC<Props> = ({
    resultPaths,
    onOpen,
    onShare,
    onReset,
}) => {
    const { colors } = useTheme();

    if (!resultPaths || resultPaths.length === 0) return null;

    const firstPath = resultPaths[0];
    const isMultiple = resultPaths.length > 1;

    return (
        <View
            style={[
                styles.container,
                {
                    backgroundColor: colors.surfaceLight,
                    borderTopColor: colors.border,
                },
            ]}
        >
            <View style={styles.header}>
                <View style={[styles.successBadge, { backgroundColor: '#10b981' }]}>
                    <Icon name="check" size={18} color="#ffffff" />
                </View>
                <Text style={[styles.title, { color: colors.text }]}>
                    {isMultiple
                        ? `¡${resultPaths.length} documentos generados!`
                        : '¡Documento generado con éxito!'}
                </Text>
            </View>

            <View style={styles.actions}>
                <TouchableOpacity
                    style={[styles.primaryButton, { backgroundColor: colors.primary }]}
                    onPress={() => onOpen(firstPath)}
                    activeOpacity={0.8}
                >
                    <Icon name="visibility" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                    <Text style={styles.primaryButtonText}>Abrir documento</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surfaceLight }]}
                    onPress={() => onShare(firstPath)}
                    activeOpacity={0.8}
                >
                    <Icon name="share" size={20} color={colors.text} />
                </TouchableOpacity>

                <TouchableOpacity
                    style={[styles.secondaryButton, { borderColor: colors.border, backgroundColor: colors.surfaceLight }]}
                    onPress={onReset}
                    activeOpacity={0.8}
                >
                    <Icon name="refresh" size={20} color={colors.text} />
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 24,
        borderTopWidth: 1,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.1,
        shadowRadius: 6,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
    },
    successBadge: {
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    title: {
        fontSize: 14,
        fontWeight: '700',
    },
    actions: {
        flexDirection: 'row',
        gap: 10,
        alignItems: 'center',
    },
    primaryButton: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
    },
    primaryButtonText: {
        color: '#ffffff',
        fontWeight: '700',
        fontSize: 14,
    },
    secondaryButton: {
        width: 46,
        height: 46,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
});
