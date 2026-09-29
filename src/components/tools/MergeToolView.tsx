import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Alert, Modal } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useNavigation } from '@react-navigation/native';
import Pdf from 'react-native-pdf';
import { useTheme } from '../../theme/ThemeContext';
import { LocalFile } from '../../services/FileService';
import { PageJumpBalloon } from './shared/PageJumpBalloon';

interface Props {
    availableFiles: LocalFile[];
    onProcess: (paths: string[], outputName?: string) => Promise<void>;
    isProcessing: boolean;
    initialFile?: LocalFile | null;
}

export const MergeToolView: React.FC<Props> = ({
    availableFiles,
    onProcess,
    isProcessing,
    initialFile,
}) => {
    const { colors, isDarkMode } = useTheme();
    const navigation = useNavigation<any>();
    const [selectedFiles, setSelectedFiles] = useState<LocalFile[]>(() => {
        return initialFile ? [initialFile] : [];
    });
    const [pickerVisible, setPickerVisible] = useState(false);
    const [previewFile, setPreviewFile] = useState<LocalFile | null>(null);
    const [previewPageCount, setPreviewPageCount] = useState<number>(0);
    const [previewCurrentPage, setPreviewCurrentPage] = useState<number>(1);
    const [pageJumpVisible, setPageJumpVisible] = useState(false);
    const previewPdfRef = useRef<any>(null);

    const handleJumpToPage = (p: number) => {
        if (p >= 1 && p <= previewPageCount) {
            previewPdfRef.current?.setPage(p);
            setPreviewCurrentPage(p);
        }
    };

    useEffect(() => {
        if (initialFile && selectedFiles.length === 0) {
            setSelectedFiles([initialFile]);
        }
    }, [initialFile]);

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
                            <TouchableOpacity
                                style={[
                                    styles.eyeButton,
                                    {
                                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.08)' : 'rgba(0, 0, 0, 0.04)',
                                        borderColor: colors.border,
                                    },
                                ]}
                                onPress={() => {
                                    setPreviewPageCount(0);
                                    setPreviewCurrentPage(1);
                                    setPreviewFile(item);
                                }}
                                activeOpacity={0.7}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                accessibilityLabel={`Ver preview de ${item.name}`}
                            >
                                <Icon name="visibility" size={18} color={colors.primary} />
                            </TouchableOpacity>

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

            {/* Modal Preview for selected document */}
            <Modal
                visible={!!previewFile}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPreviewFile(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View
                        style={[
                            styles.previewModalBox,
                            {
                                backgroundColor: colors.surfaceLight,
                                borderColor: colors.border,
                            },
                        ]}
                    >
                        {/* Header */}
                        {/* Header */}
                        <View style={[styles.previewModalHeader, { borderBottomColor: colors.border }]}>
                            <Icon name="picture-as-pdf" size={24} color="#ef4444" style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.previewModalTitle, { color: colors.text }]} numberOfLines={1}>
                                    {previewFile?.name || ''}
                                </Text>
                                {previewPageCount > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setPageJumpVisible(true)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.previewModalPageInfo, { color: colors.textSecondary }]}>
                                            Página <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{previewCurrentPage}</Text> de {previewPageCount}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => setPreviewFile(null)}
                                style={styles.previewModalCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Icon name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Page Jump Balloon */}
                        <PageJumpBalloon
                            visible={pageJumpVisible}
                            currentPage={previewCurrentPage}
                            totalPages={previewPageCount}
                            onPageChange={handleJumpToPage}
                            onClose={() => setPageJumpVisible(false)}
                            topOffset={52}
                        />

                        {/* PDF Content */}
                        <View style={styles.previewModalContent}>
                            {previewFile && (
                                <Pdf
                                    ref={previewPdfRef}
                                    source={{
                                        uri: previewFile.path.startsWith('file://')
                                            ? previewFile.path
                                            : `file://${previewFile.path}`,
                                        cache: true,
                                    }}
                                    style={styles.previewPdfView}
                                    fitPolicy={2}
                                    spacing={6}
                                    minScale={1.0}
                                    maxScale={5.0}
                                    enablePaging={true}
                                    enableDoubleTapZoom={true}
                                    onLoadComplete={(numberOfPages) => {
                                        setPreviewPageCount(numberOfPages);
                                        setPreviewCurrentPage(1);
                                    }}
                                    onPageChanged={(page) => {
                                        setPreviewCurrentPage(page);
                                    }}
                                    onError={(error) => {
                                        console.warn('Pdf modal preview error:', error);
                                    }}
                                />
                            )}
                        </View>

                        {/* Footer (Centered Buttons) */}
                        <View style={[styles.previewModalFooter, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                                style={[styles.previewModalOpenBtn, { backgroundColor: colors.primary }]}
                                onPress={() => {
                                    if (previewFile) {
                                        const fileToOpen = previewFile;
                                        setPreviewFile(null);
                                        navigation.navigate('PdfViewer', {
                                            uri: fileToOpen.path.startsWith('file://')
                                                ? fileToOpen.path
                                                : `file://${fileToOpen.path}`,
                                            name: fileToOpen.name,
                                        });
                                    }
                                }}
                                activeOpacity={0.8}
                            >
                                <Icon name="visibility" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.previewModalOpenBtnText}>Abrir completo</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.previewModalDismissBtn, { borderColor: colors.border }]}
                                onPress={() => setPreviewFile(null)}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.previewModalDismissBtnText, { color: colors.textSecondary }]}>
                                    Cerrar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
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
    eyeButton: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 10,
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
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    previewModalBox: {
        width: '100%',
        height: '80%',
        maxWidth: 420,
        borderRadius: 20,
        borderWidth: 1,
        overflow: 'hidden',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.25,
        shadowRadius: 12,
    },
    previewModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    previewModalTitle: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    previewModalPageInfo: {
        fontSize: 11,
        marginTop: 2,
    },
    previewModalCloseBtn: {
        padding: 4,
        marginLeft: 8,
    },
    previewModalContent: {
        flex: 1,
        backgroundColor: '#1e293b',
    },
    previewPdfView: {
        flex: 1,
        width: '100%',
        backgroundColor: 'transparent',
    },
    previewModalFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 12,
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    previewModalOpenBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
    },
    previewModalOpenBtnText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
    previewModalDismissBtn: {
        paddingHorizontal: 14,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    previewModalDismissBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    jumpBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    jumpCard: {
        width: 240,
        borderRadius: 16,
        padding: 18,
        borderWidth: 1,
        alignItems: 'center',
        elevation: 6,
    },
    jumpTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        marginBottom: 12,
    },
    jumpInputRow: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 16,
        gap: 8,
    },
    jumpInput: {
        width: 60,
        height: 40,
        borderRadius: 8,
        borderWidth: 1,
        textAlign: 'center',
        fontSize: 16,
        fontWeight: 'bold',
    },
    jumpTotalText: {
        fontSize: 14,
    },
    jumpActions: {
        flexDirection: 'row',
        gap: 10,
        width: '100%',
    },
    jumpCancelBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        borderWidth: 1,
        alignItems: 'center',
    },
    jumpCancelText: {
        fontSize: 13,
        fontWeight: '600',
    },
    jumpConfirmBtn: {
        flex: 1,
        paddingVertical: 8,
        borderRadius: 8,
        alignItems: 'center',
    },
    jumpConfirmText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
});
