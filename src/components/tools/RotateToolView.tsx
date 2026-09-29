import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { PageThumbnailGrid } from './shared/PageThumbnailGrid';
import { ConfirmModal } from '../ConfirmModal';
import { SaveModeModal } from './shared/SaveModeModal';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (rotations: Record<number, number>, saveMode?: 'original' | 'copy') => Promise<void>;
    isProcessing: boolean;
}

export const RotateToolView: React.FC<Props> = ({
    totalPages,
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    // Record of pageNum (1-indexed) -> added degrees (90, 180, 270)
    const [rotations, setRotations] = useState<Record<number, number>>({});
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

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

    const handlePressSave = () => {
        const count = Object.keys(rotations).length;
        if (count === 0) {
            Alert.alert('Atención', 'No has girado ninguna página todavía.');
            return;
        }
        setShowSaveModal(true);
    };

    const handleConfirmSave = (saveMode: 'original' | 'copy') => {
        setShowSaveModal(false);
        onProcess(rotations, saveMode);
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
                        <Text style={[styles.smallBtnText, { color: colors.text }]}>Girar todas +90°</Text>
                    </TouchableOpacity>

                    {rotatedCount > 0 && (
                        <TouchableOpacity
                            style={[styles.smallBtn, { backgroundColor: colors.surfaceLight, borderColor: '#ef4444' }]}
                            onPress={() => setShowResetConfirm(true)}
                        >
                            <Icon name="restore" size={16} color="#ef4444" style={{ marginRight: 4 }} />
                            <Text style={[styles.smallBtnText, { color: '#ef4444' }]}>Restablecer</Text>
                        </TouchableOpacity>
                    )}
                </View>
            </View>

            <PageThumbnailGrid
                totalPages={totalPages}
                sourcePath={sourcePath}
                mode="rotate"
                rotations={rotations}
                onRotatePage={handleRotateSingle}
            />

            <TouchableOpacity
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: rotatedCount > 0 ? colors.primary : 'rgba(221, 31, 71, 0.4)',
                    },
                ]}
                onPress={handlePressSave}
                disabled={rotatedCount === 0 || isProcessing}
                activeOpacity={0.85}
            >
                <Icon name="check" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>
                    {rotatedCount === 0
                        ? 'Guardar páginas giradas'
                        : `Guardar (${rotatedCount} ${rotatedCount === 1 ? 'página girada' : 'páginas giradas'})`}
                </Text>
            </TouchableOpacity>

            {/* SaveModeModal */}
            <SaveModeModal
                visible={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                onConfirm={handleConfirmSave}
                title="¿Cómo deseas guardar el PDF?"
                description="Selecciona una opción para aplicar los giros de páginas:"
            />

            {/* Reset confirmation modal */}
            <ConfirmModal
                visible={showResetConfirm}
                title="Restablecer documento"
                message="¿Estás seguro de que deseas restablecer el documento editado a su forma original?"
                confirmText="Restablecer"
                cancelText="Cancelar"
                confirmColor="#ef4444"
                onConfirm={() => {
                    setRotations({});
                    setShowResetConfirm(false);
                }}
                onCancel={() => setShowResetConfirm(false)}
            />
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
