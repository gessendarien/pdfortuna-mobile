import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert, ScrollView } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { RedactionBox } from '../../services/PdfToolsService';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (boxes: RedactionBox[]) => Promise<void>;
    isProcessing: boolean;
}

export const RedactToolView: React.FC<Props> = ({
    totalPages,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    const [selectedPage, setSelectedPage] = useState(1);
    const [targetArea, setTargetArea] = useState<'header' | 'footer' | 'middle'>('middle');

    const handleApply = () => {
        // Standard A4 is 595 x 842 pt
        let box: RedactionBox;

        if (targetArea === 'header') {
            box = { pageIndex: selectedPage - 1, x: 40, y: 740, width: 515, height: 60 };
        } else if (targetArea === 'footer') {
            box = { pageIndex: selectedPage - 1, x: 40, y: 40, width: 515, height: 60 };
        } else {
            box = { pageIndex: selectedPage - 1, x: 80, y: 380, width: 435, height: 80 };
        }

        Alert.alert(
            'Confirmar censura',
            'La información seleccionada se cubrirá permanentemente de negro y no podrá recuperarse.',
            [
                { text: 'Cancelar', style: 'cancel' },
                {
                    text: 'Censurar',
                    style: 'destructive',
                    onPress: () => onProcess([box]),
                },
            ]
        );
    };

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <View style={[styles.warningBox, { backgroundColor: 'rgba(239, 68, 68, 0.1)', borderColor: '#ef4444' }]}>
                <Icon name="warning" size={20} color="#ef4444" />
                <Text style={[styles.warningText, { color: colors.text }]}>
                    La censura aplica bloques negros opacos permanentes sobre el documento para proteger información confidencial.
                </Text>
            </View>

            {/* Page selection */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Página a censurar</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.pageList}>
                {Array.from({ length: totalPages }, (_, i) => i + 1).map((p) => (
                    <TouchableOpacity
                        key={p}
                        style={[
                            styles.pageChip,
                            {
                                backgroundColor: selectedPage === p ? colors.primary : colors.surfaceLight,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => setSelectedPage(p)}
                    >
                        <Text style={[styles.pageChipText, { color: selectedPage === p ? '#fff' : colors.text }]}>
                            Pág. {p}
                        </Text>
                    </TouchableOpacity>
                ))}
            </ScrollView>

            {/* Area selection */}
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Zona de censura</Text>
            <View style={styles.areaList}>
                {[
                    { id: 'header', title: 'Censurar encabezado', desc: 'Oculta datos superiores como nombres o membretes' },
                    { id: 'middle', title: 'Bloque central confidencial', desc: 'Cubre el párrafo central del documento' },
                    { id: 'footer', title: 'Censurar pie de página', desc: 'Oculta firmas, números de cuenta o pies' },
                ].map((item) => (
                    <TouchableOpacity
                        key={item.id}
                        style={[
                            styles.areaCard,
                            {
                                backgroundColor: colors.surfaceLight,
                                borderColor: targetArea === item.id ? colors.primary : colors.border,
                                borderWidth: targetArea === item.id ? 2 : 1,
                            },
                        ]}
                        onPress={() => setTargetArea(item.id as any)}
                        activeOpacity={0.75}
                    >
                        <Icon
                            name={targetArea === item.id ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={20}
                            color={targetArea === item.id ? colors.primary : colors.textSecondary}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.areaTitle, { color: colors.text }]}>{item.title}</Text>
                            <Text style={[styles.areaDesc, { color: colors.textSecondary }]}>{item.desc}</Text>
                        </View>
                    </TouchableOpacity>
                ))}
            </View>

            <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: '#ef4444' }]}
                onPress={handleApply}
                disabled={isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="visibility-off" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Censurar en Pág. {selectedPage}</Text>
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
    warningBox: {
        flexDirection: 'row',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 10,
        marginBottom: 16,
        alignItems: 'center',
    },
    warningText: {
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
    pageList: {
        flexDirection: 'row',
        marginBottom: 12,
    },
    pageChip: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 20,
        borderWidth: 1,
        marginRight: 8,
    },
    pageChipText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    areaList: {
        gap: 10,
        marginBottom: 20,
    },
    areaCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
    },
    areaTitle: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    areaDesc: {
        fontSize: 11,
        marginTop: 2,
    },
    actionBtn: {
        marginTop: 16,
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
