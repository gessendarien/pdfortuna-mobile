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

export const EditAnnotationsView: React.FC<Props> = ({
    totalPages,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    const [noteText, setNoteText] = useState('');
    const [colorKey, setColorKey] = useState<'yellow' | 'blue' | 'red'>('yellow');

    const colorMap = {
        yellow: { r: 0.95, g: 0.75, b: 0.1 },
        blue: { r: 0.15, g: 0.45, b: 0.85 },
        red: { r: 0.86, g: 0.12, b: 0.27 },
    };

    const handleApply = () => {
        if (!noteText.trim()) {
            Alert.alert('Atención', 'Escribe el texto de la anotación.');
            return;
        }

        onProcess({
            text: noteText.trim(),
            opacity: 0.85,
            size: 24,
            rotation: 0,
            layout: 'center',
            color: colorMap[colorKey],
        });
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={[styles.infoBanner, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                <Icon name="edit-note" size={22} color={colors.primary} />
                <Text style={[styles.infoText, { color: colors.text }]}>
                    Agrega notas, sellos de texto y observaciones permanentes sobre tu documento.
                </Text>
            </View>

            <Text style={[styles.sectionTitle, { color: colors.text }]}>Texto de la anotación</Text>
            <TextInput
                style={[
                    styles.input,
                    {
                        backgroundColor: colors.surfaceLight,
                        borderColor: colors.border,
                        color: colors.text,
                    },
                ]}
                placeholder="Ejemplo: Aprobado el 21 Sep, Revisión pendiente..."
                placeholderTextColor={colors.textSecondary}
                value={noteText}
                onChangeText={setNoteText}
                multiline
            />

            {/* Color selection */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Color del texto</Text>
            <View style={styles.colorRow}>
                {[
                    { id: 'yellow', label: 'Amarillo', hex: '#eab308' },
                    { id: 'blue', label: 'Azul', hex: '#2563eb' },
                    { id: 'red', label: 'Rojo', hex: '#dd1f47' },
                ].map((c) => (
                    <TouchableOpacity
                        key={c.id}
                        style={[
                            styles.colorBtn,
                            {
                                borderColor: colorKey === c.id ? colors.primary : 'transparent',
                                borderWidth: colorKey === c.id ? 2 : 1,
                            },
                        ]}
                        onPress={() => setColorKey(c.id as any)}
                    >
                        <View style={[styles.colorCircle, { backgroundColor: c.hex }]} />
                        <Text style={[styles.colorLabel, { color: colors.text }]}>{c.label}</Text>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handleApply}
                disabled={isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="auto-fix-high" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Incrustar anotación</Text>
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
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        gap: 10,
    },
    infoText: {
        flex: 1,
        fontSize: 12,
        lineHeight: 16,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginTop: 10,
        marginBottom: 8,
    },
    input: {
        minHeight: 80,
        borderWidth: 1,
        borderRadius: 12,
        padding: 12,
        fontSize: 14,
        textAlignVertical: 'top',
    },
    colorRow: {
        flexDirection: 'row',
        gap: 10,
        marginTop: 4,
    },
    colorBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        borderRadius: 12,
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
