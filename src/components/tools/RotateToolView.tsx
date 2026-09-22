import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { PageThumbnailGrid } from './shared/PageThumbnailGrid';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (rotations: Record<number, number>) => Promise<void>;
    isProcessing: boolean;
}

export const RotateToolView: React.FC<Props> = ({
    totalPages,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    // Record of pageNum (1-indexed) -> added degrees (90, 180, 270)
    const [rotations, setRotations] = useState<Record<number, number>>({});

    const handleRotateSingle = (pageNum: number) => {
        setRotations((prev) => {
            const current = prev[pageNum] || 0;
            const next = (current + 90) % 360;
            const updated = { ...prev };
            if (next === 0) {
                delete updated[pageNum];
            } else {
                updated[pageNum] = next;
            }
            return updated;
        });
    };

    const handleRotateAll = () => {
        setRotations((prev) => {
            const updated: Record<number, number> = {};
            for (let p = 1; p <= totalPages; p++) {
                const current = prev[p] || 0;
                const next = (current + 90) % 360;
                if (next !== 0) {
                    updated[p] = next;
                }
            }
            return updated;
        });
    };

    const handleReset = () => {
        setRotations({});
    };

    const handleSave = () => {
        const count = Object.keys(rotations).length;
        if (count === 0) {
            Alert.alert('Atención', 'No has girado ninguna página todavía.');
            return;
        }
        onProcess(rotations);
    };

    const rotatedCount = Object.keys(rotations).length;

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={[styles.instruction, { color: colors.textSecondary }]}>
                    Toca "Girar 90°" debajo de cada página o usa el botón para todas.
                </Text>

                <View style={styles.topButtons}>
                    <TouchableOpacity
                        style={[styles.smallBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                        onPress={handleRotateAll}
                    >
                        <Icon name="rotate-right" size={16} color={colors.primary} style={{ marginRight: 4 }} />
                        <Text style={[styles.smallBtnText, { color: colors.primary }]}>Todas 90°</Text>
                    </TouchableOpacity>

                    {rotatedCount > 0 && (
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
                    rotations={rotations}
                    onRotatePage={handleRotateSingle}
                    mode="rotate"
                />
            </View>

            <TouchableOpacity
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: rotatedCount > 0 ? colors.primary : 'rgba(221, 31, 71, 0.4)',
                    },
                ]}
                onPress={handleSave}
                disabled={rotatedCount === 0 || isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="rotate-right" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>
                    Guardar ({rotatedCount} página(s) giradas)
                </Text>
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
