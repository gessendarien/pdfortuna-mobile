import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { PageThumbnailGrid } from './shared/PageThumbnailGrid';
import { ConfirmModal } from '../ConfirmModal';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (pagesToDelete: number[]) => Promise<void>;
    isProcessing: boolean;
}

export const DeletePagesToolView: React.FC<Props> = ({
    totalPages,
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    const [selectedPages, setSelectedPages] = useState<Set<number>>(new Set());
    const [alertModal, setAlertModal] = useState<{
        visible: boolean;
        title: string;
        message: string;
        singleButton?: boolean;
        onConfirm?: () => void;
    } | null>(null);

    const handleToggleSelect = (pageNum: number) => {
        setSelectedPages((prev) => {
            const next = new Set(prev);
            if (next.has(pageNum)) {
                next.delete(pageNum);
            } else {
                next.add(pageNum);
            }
            return next;
        });
    };

    const handleSelectAll = () => {
        if (selectedPages.size === totalPages) {
            setSelectedPages(new Set());
        } else {
            setSelectedPages(new Set(Array.from({ length: totalPages }, (_, i) => i + 1)));
        }
    };

    const handleDelete = () => {
        if (selectedPages.size === 0) {
            setAlertModal({
                visible: true,
                title: 'Atención',
                message: 'Selecciona al menos una página para eliminar.',
                singleButton: true,
            });
            return;
        }
        if (selectedPages.size >= totalPages) {
            setAlertModal({
                visible: true,
                title: 'Atención',
                message: 'No puedes eliminar todas las páginas del documento. Debe quedar al menos una página.',
                singleButton: true,
            });
            return;
        }

        setAlertModal({
            visible: true,
            title: 'Confirmar eliminación',
            message: `¿Estás seguro de que deseas eliminar ${selectedPages.size} página(s)?`,
            singleButton: false,
            onConfirm: () => {
                setAlertModal(null);
                onProcess(Array.from(selectedPages));
            },
        });
    };

    return (
        <View style={styles.container}>
            <View style={styles.topBar}>
                <Text style={[styles.instruction, { color: colors.textSecondary }]}>
                    Toca las páginas que deseas quitar ({selectedPages.size} de {totalPages} seleccionadas).
                </Text>
                <TouchableOpacity
                    style={[styles.smallBtn, { borderColor: colors.border }]}
                    onPress={handleSelectAll}
                >
                    <Text style={[styles.smallBtnText, { color: colors.primary }]}>
                        {selectedPages.size === totalPages ? 'Deseleccionar' : 'Seleccionar todas'}
                    </Text>
                </TouchableOpacity>
            </View>

            <View style={{ flex: 1 }}>
                <PageThumbnailGrid
                    totalPages={totalPages}
                    sourcePath={sourcePath}
                    selectedPages={selectedPages}
                    onToggleSelect={handleToggleSelect}
                    mode="select"
                />
            </View>

            <TouchableOpacity
                style={[
                    styles.actionBtn,
                    {
                        backgroundColor: selectedPages.size > 0 ? '#ef4444' : 'rgba(239, 68, 68, 0.4)',
                    },
                ]}
                onPress={handleDelete}
                disabled={selectedPages.size === 0 || isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="delete-sweep" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>
                    Eliminar {selectedPages.size} página(s)
                </Text>
            </TouchableOpacity>
            {alertModal && (
                <ConfirmModal
                    visible={alertModal.visible}
                    title={alertModal.title}
                    message={alertModal.message}
                    singleButton={alertModal.singleButton}
                    confirmText={alertModal.singleButton ? 'Entendido' : 'Eliminar'}
                    cancelText="Cancelar"
                    confirmColor="#ef4444"
                    onConfirm={() => {
                        if (alertModal.onConfirm) {
                            alertModal.onConfirm();
                        } else {
                            setAlertModal(null);
                        }
                    }}
                    onCancel={() => setAlertModal(null)}
                />
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 10,
    },
    instruction: {
        fontSize: 12,
        flex: 1,
        marginRight: 8,
    },
    smallBtn: {
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
