import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (ranges: string) => Promise<void>;
    isProcessing: boolean;
}

export const SplitToolView: React.FC<Props> = ({
    totalPages,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    const [mode, setMode] = useState<'all' | 'custom'>('custom');
    const [rangeInput, setRangeInput] = useState<string>('1-2, 3');

    const handleSplit = () => {
        let finalRange = '';
        if (mode === 'all') {
            finalRange = Array.from({ length: totalPages }, (_, i) => (i + 1).toString()).join(', ');
        } else {
            finalRange = rangeInput.trim();
            if (!finalRange) {
                Alert.alert('Atención', 'Ingresa los rangos de páginas (ejemplo: 1-2, 3-5).');
                return;
            }
        }
        onProcess(finalRange);
    };

    return (
        <View style={styles.container}>
            <View style={[styles.infoBanner, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                <Icon name="info-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                    Este documento tiene <Text style={{ fontWeight: 'bold' }}>{totalPages} páginas</Text>.
                </Text>
            </View>

            {/* Mode selection tabs */}
            <View style={styles.modeTabs}>
                <TouchableOpacity
                    style={[
                        styles.modeTab,
                        {
                            borderColor: colors.border,
                            backgroundColor: mode === 'custom' ? colors.primary : colors.surfaceLight,
                        },
                    ]}
                    onPress={() => setMode('custom')}
                >
                    <Text
                        style={[
                            styles.modeTabText,
                            { color: mode === 'custom' ? '#ffffff' : colors.text },
                        ]}
                    >
                        Por rangos
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.modeTab,
                        {
                            borderColor: colors.border,
                            backgroundColor: mode === 'all' ? colors.primary : colors.surfaceLight,
                        },
                    ]}
                    onPress={() => setMode('all')}
                >
                    <Text
                        style={[
                            styles.modeTabText,
                            { color: mode === 'all' ? '#ffffff' : colors.text },
                        ]}
                    >
                        Página por página
                    </Text>
                </TouchableOpacity>
            </View>

            {mode === 'custom' ? (
                <View style={styles.customSection}>
                    <Text style={[styles.label, { color: colors.text }]}>
                        Rangos a extraer (separados por coma):
                    </Text>
                    <TextInput
                        style={[
                            styles.input,
                            {
                                backgroundColor: colors.surfaceLight,
                                borderColor: colors.border,
                                color: colors.text,
                            },
                        ]}
                        placeholder="Ejemplo: 1-2, 3-5"
                        placeholderTextColor={colors.textSecondary}
                        value={rangeInput}
                        onChangeText={setRangeInput}
                        autoCapitalize="none"
                    />
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                        Se creará un archivo PDF independiente por cada rango o página especificada.
                    </Text>
                </View>
            ) : (
                <View style={styles.allSection}>
                    <Text style={[styles.hint, { color: colors.textSecondary }]}>
                        Se generarán {totalPages} archivos PDF individuales (1 página cada uno).
                    </Text>
                </View>
            )}

            <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleSplit}
                disabled={isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="call-split" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Dividir documento</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        padding: 16,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        gap: 8,
    },
    infoText: {
        fontSize: 13,
    },
    modeTabs: {
        flexDirection: 'row',
        gap: 10,
        marginBottom: 16,
    },
    modeTab: {
        flex: 1,
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
        alignItems: 'center',
    },
    modeTabText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    customSection: {
        marginBottom: 20,
    },
    label: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 15,
        marginBottom: 6,
    },
    hint: {
        fontSize: 12,
        lineHeight: 16,
    },
    allSection: {
        marginBottom: 20,
        padding: 14,
    },
    actionBtn: {
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 'auto',
        marginBottom: 16,
        elevation: 4,
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
