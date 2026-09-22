import React, { useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { WatermarkOptions } from '../../services/PdfToolsService';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (opts: WatermarkOptions) => Promise<void>;
    isProcessing: boolean;
}

export const WatermarkToolView: React.FC<Props> = ({
    totalPages,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    const [text, setText] = useState('CONFIDENCIAL');
    const [opacity, setOpacity] = useState(0.3);
    const [layout, setLayout] = useState<'diagonal' | 'repeat'>('diagonal');
    const [colorKey, setColorKey] = useState<'red' | 'gray' | 'blue'>('red');

    const colorMap = {
        red: { r: 0.86, g: 0.12, b: 0.27 }, // #dd1f47
        gray: { r: 0.4, g: 0.45, b: 0.5 },
        blue: { r: 0.15, g: 0.4, b: 0.8 },
    };

    const handleApply = () => {
        if (!text.trim()) {
            Alert.alert('Atención', 'Ingresa el texto para la marca de agua.');
            return;
        }

        onProcess({
            text: text.trim(),
            opacity,
            layout,
            color: colorMap[colorKey],
            rotation: layout === 'diagonal' ? 45 : 0,
            size: layout === 'repeat' ? 32 : 54,
        });
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Texto de la marca</Text>
            <TextInput
                style={[
                    styles.input,
                    {
                        backgroundColor: colors.surfaceLight,
                        borderColor: colors.border,
                        color: colors.text,
                    },
                ]}
                placeholder="Ejemplo: CONFIDENCIAL, COPIA, BORRADOR..."
                placeholderTextColor={colors.textSecondary}
                value={text}
                onChangeText={setText}
            />

            {/* Layout selector */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Disposición</Text>
            <View style={styles.row}>
                <TouchableOpacity
                    style={[
                        styles.optionBtn,
                        {
                            backgroundColor: layout === 'diagonal' ? colors.primary : colors.surfaceLight,
                            borderColor: colors.border,
                        },
                    ]}
                    onPress={() => setLayout('diagonal')}
                >
                    <Icon name="rotate-90-degrees-ccw" size={18} color={layout === 'diagonal' ? '#fff' : colors.text} />
                    <Text style={[styles.optionBtnText, { color: layout === 'diagonal' ? '#fff' : colors.text }]}>
                        Centro diagonal
                    </Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.optionBtn,
                        {
                            backgroundColor: layout === 'repeat' ? colors.primary : colors.surfaceLight,
                            borderColor: colors.border,
                        },
                    ]}
                    onPress={() => setLayout('repeat')}
                >
                    <Icon name="grid-view" size={18} color={layout === 'repeat' ? '#fff' : colors.text} />
                    <Text style={[styles.optionBtnText, { color: layout === 'repeat' ? '#fff' : colors.text }]}>
                        Mosaico repetido
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Opacity selector */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Opacidad / Transparencia</Text>
            <View style={styles.row}>
                {[0.15, 0.3, 0.5].map((op) => (
                    <TouchableOpacity
                        key={op}
                        style={[
                            styles.smallOption,
                            {
                                backgroundColor: opacity === op ? colors.primary : colors.surfaceLight,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => setOpacity(op)}
                    >
                        <Text style={[styles.optionBtnText, { color: opacity === op ? '#fff' : colors.text }]}>
                            {Math.round(op * 100)}%
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>

            {/* Color selector */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Color</Text>
            <View style={styles.row}>
                <TouchableOpacity
                    style={[
                        styles.colorBtn,
                        { borderColor: colorKey === 'red' ? colors.primary : 'transparent' },
                    ]}
                    onPress={() => setColorKey('red')}
                >
                    <View style={[styles.colorCircle, { backgroundColor: '#dd1f47' }]} />
                    <Text style={[styles.colorLabel, { color: colors.text }]}>Rojo</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.colorBtn,
                        { borderColor: colorKey === 'gray' ? colors.primary : 'transparent' },
                    ]}
                    onPress={() => setColorKey('gray')}
                >
                    <View style={[styles.colorCircle, { backgroundColor: '#64748b' }]} />
                    <Text style={[styles.colorLabel, { color: colors.text }]}>Gris</Text>
                </TouchableOpacity>

                <TouchableOpacity
                    style={[
                        styles.colorBtn,
                        { borderColor: colorKey === 'blue' ? colors.primary : 'transparent' },
                    ]}
                    onPress={() => setColorKey('blue')}
                >
                    <View style={[styles.colorCircle, { backgroundColor: '#2563eb' }]} />
                    <Text style={[styles.colorLabel, { color: colors.text }]}>Azul</Text>
                </TouchableOpacity>
            </View>

            <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleApply}
                disabled={isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="branding-watermark" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>
                    Aplicar en {totalPages} página(s)
                </Text>
            </TouchableOpacity>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginTop: 14,
        marginBottom: 8,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 15,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    optionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 6,
    },
    smallOption: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1,
    },
    optionBtnText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    colorBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
        borderWidth: 1.5,
        gap: 6,
    },
    colorCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    colorLabel: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    actionBtn: {
        marginTop: 32,
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
