import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { PageThumbnailGrid } from './shared/PageThumbnailGrid';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (newOrder: number[]) => Promise<void>;
    isProcessing: boolean;
}

export const ReorderPagesToolView: React.FC<Props> = ({
    totalPages,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    // 1-indexed page numbers in current order
    const [pageOrder, setPageOrder] = useState<number[]>(
        Array.from({ length: totalPages }, (_, i) => i + 1)
    );

    const handleMove = (fromIndex: number, toIndex: number) => {
        if (toIndex < 0 || toIndex >= pageOrder.length) return;
        const newArr = [...pageOrder];
        const [moved] = newArr.splice(fromIndex, 1);
        newArr.splice(toIndex, 0, moved);
        setPageOrder(newArr);
    };

    const handleInvert = () => {
        setPageOrder([...pageOrder].reverse());
    };

    const handleReset = () => {
        setPageOrder(Array.from({ length: totalPages }, (_, i) => i + 1));
    };

    // Check if order has changed
    const hasChanged = pageOrder.some((p, i) => p !== i + 1);

    const handleSave = () => {
        if (!hasChanged) {
            Alert.alert('Atención', 'El orden de las páginas no ha sido modificado.');
            return;
        }
        onProcess(pageOrder);
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={[styles.instruction, { color: colors.textSecondary }]}>
                    Usa las flechas para mover cada página a su nueva posición.
                </Text>

                <View style={styles.topButtons}>
                    <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                        onPress={handleInvert}
                    >
                        <Icon name="swap-vertical-circle" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.smallBtnText, { color: colors.primary }]}>Invertir</Text>
                    </TouchableOpacity>

                    {hasChanged && (
                        <TouchableOpacity
                            style={[styles.smallBtn, { borderColor: colors.border }]}
                            onPress={handleReset}
                        >
                            <Text style={[styles.smallBtnText, { color: colors.textSecondary }]}>Restablecer</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <View style={{ flex: 1 }}>
                <PageThumbnailGrid
                    totalPages={totalPages}
                    pageOrder={pageOrder}
                    onMovePage={handleMove}
                    mode="reorder"
                />
            </View>

            <TouchableOpacity
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: hasChanged ? colors.primary : 'rgba(221, 31, 71, 0.4)',
                    },
                ]}
                onPress={handleSave}
                disabled={!hasChanged || isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="check" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Guardar nuevo orden</Text>
            </TouchableOpacity>
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        paddingHorizontal: 16,
        paddingVertical: 10,
        gap: 8,
    },
    instruction: {
        fontSize: 12,
    },
    topButtons: {
        flexDirection: 'row',
        gap: 8,
    },
    smallBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    smallBtnText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    actionBtn: {
        margin: 16,
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
