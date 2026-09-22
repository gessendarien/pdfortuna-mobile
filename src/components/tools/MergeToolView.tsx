import React, { useState } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { LocalFile } from '../../services/FileService';

interface Props {
    availableFiles: LocalFile[];
    onProcess: (paths: string[], outputName?: string) => Promise<void>;
    isProcessing: boolean;
}

export const MergeToolView: React.FC<Props> = ({
    availableFiles,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    const [selectedFiles, setSelectedFiles] = useState<LocalFile[]>([]);
    const [pickerVisible, setPickerVisible] = useState(false);

    const handleAddFile = (file: LocalFile) => {
        setSelectedFiles((prev) => [...prev, file]);
        setPickerVisible(false);
    };

    const handleRemoveFile = (index: number) => {
        setSelectedFiles((prev) => prev.filter((_, i) => i !== index));
    };

    const handleMove = (index: number, direction: 'up' | 'down') => {
        const targetIndex = direction === 'up' ? index - 1 : index + 1;
        if (targetIndex < 0 || targetIndex >= selectedFiles.length) return;

        const newArr = [...selectedFiles];
        const [moved] = newArr.splice(index, 1);
        newArr.splice(targetIndex, 0, moved);
        setSelectedFiles(newArr);
    };

    const handleMerge = () => {
        if (selectedFiles.length < 2) {
            Alert.alert('Atención', 'Selecciona al menos 2 documentos para unir.');
            return;
        }
        const paths = selectedFiles.map((f) => f.path);
        onProcess(paths, 'documento_unido');
    };

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <Text style={[styles.instruction, { color: colors.textSecondary }]}>
                    Agrega los PDFs en el orden en que deseas unirlos.
                </Text>
                <TouchableOpacity
                    style={[styles.addBtn, { backgroundColor: colors.primary }]}
                    onPress={() => setPickerVisible(true)}
                    activeOpacity={0.8}
                >
                    <Icon name="add" size={18} color="#fff" />
                    <Text style={styles.addBtnText}>Agregar PDF</Text>
                </TouchableOpacity>
            </View>

            {/* List of selected PDFs to merge */}
            {selectedFiles.length === 0 ? (
                <View style={styles.emptyContainer}>
                    <Icon name="call-merge" size={48} color={colors.textSecondary} />
                    <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                        No has seleccionado documentos todavía.{'\n'}Toca "+ Agregar PDF" para empezar.
                    </Text>
                </View>
            ) : (
                <FlatList
                    data={selectedFiles}
                    keyExtractor={(item, index) => `${item.path}_${index}`}
                    renderItem={({ item, index }) => (
                        <View
                            style={[
                                styles.fileRow,
                                {
                                    backgroundColor: colors.surfaceLight,
                                    borderColor: colors.border,
                                },
                            ]}
                        >
                            <View style={[styles.indexCircle, { backgroundColor: colors.surfaceLight }]}>
                                <Text style={[styles.indexText, { color: colors.primary }]}>{index + 1}</Text>
                            </View>

                            <View style={styles.fileInfo}>
                                <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                                    {item.name}
                                </Text>
                                <Text style={[styles.fileMeta, { color: colors.textSecondary }]}>
                                    {item.pageCount ? `${item.pageCount} pág. • ` : ''}
                                    {(item.size / 1024).toFixed(0)} KB
                                </Text>
                            </View>

                            {/* Move up / down / remove controls */}
                            <View style={styles.controls}>
                                <TouchableOpacity
                                    onPress={() => handleMove(index, 'up')}
                                    disabled={index === 0}
                                    style={[styles.ctrlBtn, { opacity: index === 0 ? 0.25 : 1 }]}
                                >
                                    <Icon name="arrow-upward" size={18} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity
                                    onPress={() => handleMove(index, 'down')}
                                    disabled={index === selectedFiles.length - 1}
                                    style={[styles.ctrlBtn, { opacity: index === selectedFiles.length - 1 ? 0.25 : 1 }]}
                                >
                                    <Icon name="arrow-downward" size={18} color={colors.text} />
                                </TouchableOpacity>
                                <TouchableOpacity onPress={() => handleRemoveFile(index)} style={styles.ctrlBtn}>
                                    <Icon name="close" size={18} color="#ef4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    )}
                    contentContainerStyle={styles.listContent}
                />
            )}

            {/* Merge action trigger */}
            {selectedFiles.length >= 2 && (
                <TouchableOpacity
                    style={[styles.mainActionBtn, { backgroundColor: colors.primary }]}
                    onPress={handleMerge}
                    disabled={isProcessing}
                    activeOpacity={0.8}
                >
                    <Icon name="call-merge" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.mainActionText}>
                        Unir {selectedFiles.length} documentos
                    </Text>
                </TouchableOpacity>
            )}

            {/* Document Picker Overlay */}
            {pickerVisible && (
                <View style={[styles.pickerOverlay, { backgroundColor: 'rgba(0,0,0,0.6)' }]}>
                    <View style={[styles.pickerCard, { backgroundColor: colors.surfaceLight }]}>
                        <View style={styles.pickerHeader}>
                            <Text style={[styles.pickerTitle, { color: colors.text }]}>Selecciona un PDF</Text>
                            <TouchableOpacity onPress={() => setPickerVisible(false)}>
                                <Icon name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        <FlatList
                            data={availableFiles.filter((f) => f.type === 'pdf')}
                            keyExtractor={(f) => f.path}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.pickerItem, { borderBottomColor: colors.border }]}
                                    onPress={() => handleAddFile(item)}
                                >
                                    <Icon name="picture-as-pdf" size={24} color="#ef4444" style={{ marginRight: 12 }} />
                                    <View style={{ flex: 1 }}>
                                        <Text style={[styles.pickerItemName, { color: colors.text }]} numberOfLines={1}>
                                            {item.name}
                                        </Text>
                                        <Text style={[styles.pickerItemMeta, { color: colors.textSecondary }]}>
                                            {item.pageCount ? `${item.pageCount} pág. • ` : ''}
                                            {(item.size / 1024).toFixed(0)} KB
                                        </Text>
                                    </View>
                                </TouchableOpacity>
                            )}
                            style={{ maxHeight: 350 }}
                        />
                    </View>
                </View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    instruction: {
        fontSize: 12,
        flex: 1,
        marginRight: 10,
    },
    addBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderRadius: 16,
        gap: 4,
    },
    addBtnText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 12,
        lineHeight: 18,
    },
    listContent: {
        paddingHorizontal: 16,
        paddingBottom: 80,
    },
    fileRow: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 8,
    },
    indexCircle: {
        width: 26,
        height: 26,
        borderRadius: 13,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
    },
    indexText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    fileInfo: {
        flex: 1,
    },
    fileName: {
        fontSize: 13,
        fontWeight: '700',
    },
    fileMeta: {
        fontSize: 11,
        marginTop: 2,
    },
    controls: {
        flexDirection: 'row',
        gap: 6,
    },
    ctrlBtn: {
        padding: 6,
        borderRadius: 8,
    },
    mainActionBtn: {
        margin: 16,
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    mainActionText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    pickerOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    pickerCard: {
        width: '100%',
        borderRadius: 20,
        padding: 16,
        maxHeight: 450,
    },
    pickerHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    pickerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    pickerItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    pickerItemName: {
        fontSize: 13,
        fontWeight: '600',
    },
    pickerItemMeta: {
        fontSize: 11,
        marginTop: 2,
    },
});
