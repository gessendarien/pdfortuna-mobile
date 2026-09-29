import React, { useState } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { PdfCompactPreview } from './shared/PdfCompactPreview';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (ranges: string) => Promise<void>;
    isProcessing: boolean;
}

export const SplitToolView: React.FC<Props> = ({
    totalPages,
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    // 'ranges' | 'pages' | null (by default nothing is checked)
    const [splitMode, setSplitMode] = useState<'ranges' | 'pages' | null>(null);
    const [rangeInput, setRangeInput] = useState<string>('');

    const handleSelectSeparateEachPage = () => {
        if (splitMode === 'pages') return;
        if (totalPages > 10) {
            Alert.alert(
                'Atención',
                `Este documento tiene ${totalPages} páginas. Esta acción creará ${totalPages} archivos y podría ralentizar el teléfono. ¿Seguro que deseas continuar?`,
                [
                    { text: 'Cancelar', style: 'cancel' },
                    {
                        text: 'Aceptar',
                        onPress: () => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setSplitMode('pages');
                        },
                    },
                ]
            );
        } else {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSplitMode('pages');
        }
    };

    const handleSelectRanges = () => {
        if (splitMode === 'ranges') return;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setSplitMode('ranges');
    };

    const handleInitiateSplit = () => {
        if (!splitMode) {
            Alert.alert('Atención', 'Por favor selecciona una opción para dividir el documento.');
            return;
        }

        let finalRange = '';
        if (splitMode === 'pages') {
            finalRange = Array.from({ length: totalPages }, (_, i) => (i + 1).toString()).join(', ');
        } else {
            finalRange = rangeInput.trim();
            if (!finalRange) {
                Alert.alert(
                    'Atención',
                    'Por favor ingresa los rangos o páginas a dividir (por ej. 1-3, 5).'
                );
                return;
            }
        }

        onProcess(finalRange);
    };

    const isSeparate = splitMode === 'pages';
    const isRanges = splitMode === 'ranges';

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.scrollContent}
            keyboardShouldPersistTaps="handled"
            showsVerticalScrollIndicator={false}
        >
            {/* Top Info Banner */}
            <View
                style={[
                    styles.infoBanner,
                    {
                        backgroundColor: colors.surfaceLight,
                        borderColor: colors.border,
                    },
                ]}
            >
                <Icon name="info-outline" size={20} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                    Este documento tiene{' '}
                    <Text style={{ fontWeight: 'bold' }}>
                        {totalPages} {totalPages === 1 ? 'página' : 'páginas'}
                    </Text>
                    .
                </Text>
            </View>

            {/* Compact PDF Preview Module */}
            <PdfCompactPreview
                sourcePath={sourcePath}
                totalPages={totalPages}
                height={220}
            />

            {/* Opción 1: Separar cada página una a una */}
            <TouchableOpacity
                style={[
                    styles.checkboxRow,
                    {
                        backgroundColor: colors.surfaceLight,
                        borderColor: isSeparate ? colors.primary : colors.border,
                    },
                ]}
                onPress={handleSelectSeparateEachPage}
                activeOpacity={0.7}
            >
                <View
                    style={[
                        styles.checkboxBox,
                        {
                            borderColor: isSeparate ? colors.primary : colors.textSecondary,
                            backgroundColor: isSeparate ? colors.primary : 'transparent',
                        },
                    ]}
                >
                    {isSeparate && <Icon name="check" size={16} color="#ffffff" />}
                </View>

                <View style={styles.checkboxTextContainer}>
                    <Text style={[styles.checkboxTitle, { color: colors.text }]}>
                        Separar cada página una a una
                    </Text>
                    <Text style={[styles.checkboxSubtitle, { color: colors.textSecondary }]}>
                        {isSeparate
                            ? `Se creará 1 archivo PDF por cada una de las ${totalPages} páginas.`
                            : 'Generar un archivo PDF individual por cada página del documento.'}
                    </Text>
                </View>
            </TouchableOpacity>

            {/* Opción 2: Dividir por rangos o páginas con checkbox */}
            <View
                style={[
                    styles.rangeContainerBox,
                    {
                        backgroundColor: colors.surfaceLight,
                        borderColor: isRanges ? colors.primary : colors.border,
                    },
                ]}
            >
                <TouchableOpacity
                    style={styles.checkboxRowHeader}
                    onPress={handleSelectRanges}
                    activeOpacity={0.7}
                >
                    <View
                        style={[
                            styles.checkboxBox,
                            {
                                borderColor: isRanges ? colors.primary : colors.textSecondary,
                                backgroundColor: isRanges ? colors.primary : 'transparent',
                            },
                        ]}
                    >
                        {isRanges && <Icon name="check" size={16} color="#ffffff" />}
                    </View>

                    <View style={styles.checkboxTextContainer}>
                        <Text style={[styles.checkboxTitle, { color: colors.text }]}>
                            Dividir por rangos o páginas
                        </Text>
                        <Text style={[styles.checkboxSubtitle, { color: colors.textSecondary }]}>
                            Indica páginas exactas o rangos numéricos para extraer.
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Input desplegable animado de arriba a abajo solo cuando la opción está activa */}
                {isRanges && (
                    <View style={styles.rangeDropdown}>
                        <Text style={[styles.rangeHint, { color: colors.textSecondary }]}>
                            {"Escribe las páginas separadas por guión (-) para rangos y coma (,) para páginas sueltas.\nEj: 1-3, 5"}
                        </Text>

                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.backgroundLight,
                                    borderColor: colors.border,
                                    color: colors.text,
                                },
                            ]}
                            value={rangeInput}
                            onChangeText={setRangeInput}
                            autoCapitalize="none"
                            autoCorrect={false}
                        />
                    </View>
                )}
            </View>

            {/* Action Button */}
            <TouchableOpacity
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: splitMode ? colors.primary : 'rgba(221, 31, 71, 0.4)',
                    },
                    (isProcessing || !splitMode) && styles.actionBtnDisabled,
                ]}
                onPress={handleInitiateSplit}
                disabled={isProcessing || !splitMode}
                activeOpacity={0.8}
            >
                <Icon name="call-split" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Dividir documento</Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 40,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 14,
        gap: 8,
    },
    infoText: {
        fontSize: 13,
        flex: 1,
    },
    checkboxRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 12,
        borderWidth: 1.5,
        marginBottom: 14,
    },
    checkboxBox: {
        width: 22,
        height: 22,
        borderRadius: 6,
        borderWidth: 2,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    checkboxTextContainer: {
        flex: 1,
    },
    checkboxTitle: {
        fontSize: 14,
        fontWeight: '600',
    },
    checkboxSubtitle: {
        fontSize: 12,
        marginTop: 2,
    },
    rangeContainerBox: {
        borderRadius: 12,
        borderWidth: 1.5,
        marginBottom: 20,
        overflow: 'hidden',
    },
    checkboxRowHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
    },
    rangeDropdown: {
        paddingHorizontal: 14,
        paddingBottom: 14,
        paddingTop: 4,
    },
    rangeHint: {
        fontSize: 12,
        lineHeight: 16,
        marginBottom: 12,
    },
    input: {
        borderWidth: 1,
        borderRadius: 10,
        paddingHorizontal: 12,
        paddingVertical: 10,
        fontSize: 15,
    },
    actionBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
        elevation: 2,
    },
    actionBtnDisabled: {
        opacity: 0.6,
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
