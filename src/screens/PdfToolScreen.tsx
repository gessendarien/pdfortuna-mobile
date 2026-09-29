import React, { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, BackHandler, Modal, ScrollView } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Share from 'react-native-share';
import Pdf from 'react-native-pdf';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';
import { LocalFile, scanDocuments, renameFile } from '../services/FileService';
import { RenameModal } from '../components/RenameModal';
import { MarqueeText } from '../components/MarqueeText';
import { PdfToolsService, WatermarkOptions, SignaturePlacement, RedactionBox, DocumentEditItem } from '../services/PdfToolsService';
import { PageJumpBalloon } from '../components/tools/shared/PageJumpBalloon';

// Tool Components
import { MergeToolView } from '../components/tools/MergeToolView';
import { SplitToolView } from '../components/tools/SplitToolView';
import { DeletePagesToolView } from '../components/tools/DeletePagesToolView';
import { RotateToolView } from '../components/tools/RotateToolView';
import { ReorderPagesToolView } from '../components/tools/ReorderPagesToolView';
import { WatermarkToolView } from '../components/tools/WatermarkToolView';
import { SignatureToolView } from '../components/tools/SignatureToolView';
import { RedactToolView } from '../components/tools/RedactToolView';
import { FillFormToolView } from '../components/tools/FillFormToolView';
import { PdfInlineEditorView } from '../components/tools/PdfInlineEditorView';

// Shared
import { ToolProgressModal } from '../components/tools/shared/ToolProgressModal';

export const PdfToolScreen: React.FC = () => {
    const navigation = useNavigation<any>();
    const route = useRoute<any>();
    const insets = useSafeAreaInsets();
    const { colors } = useTheme();

    const { toolId, initialPdfUri, initialPdfName } = route.params || {};

    // Source document state
    const [selectedFile, setSelectedFile] = useState<LocalFile | null>(null);
    const [availableFiles, setAvailableFiles] = useState<LocalFile[]>([]);
    const [loadingFiles, setLoadingFiles] = useState(false);
    const [totalPages, setTotalPages] = useState<number>(0);

    // Processing & results state
    const [isProcessing, setIsProcessing] = useState(false);
    const [processMessage, setProcessMessage] = useState('Procesando documento...');
    const [resultPaths, setResultPaths] = useState<string[]>([]);

    // Rename & Preview Modal states for result documents
    const [renamingFilePath, setRenamingFilePath] = useState<string | null>(null);
    const [previewModalPath, setPreviewModalPath] = useState<string | null>(null);
    const [previewPageCount, setPreviewPageCount] = useState<number>(0);
    const [previewCurrentPage, setPreviewCurrentPage] = useState<number>(1);
    const [previewPageJumpVisible, setPreviewPageJumpVisible] = useState(false);
    const previewPdfRef = useRef<any>(null);

    const handleJumpToPreviewPage = (p: number) => {
        if (p >= 1 && p <= previewPageCount) {
            previewPdfRef.current?.setPage(p);
            setPreviewCurrentPage(p);
        }
    };

    // Title from i18n
    const toolTitle = useMemo(() => {
        return t(`tools.${toolId}`) || 'Herramienta PDF';
    }, [toolId]);

    const handleAcceptReturnHome = () => {
        setResultPaths([]);
        navigation.navigate('Home', { targetTab: 'documents', targetSubTab: 'all' });
    };

    // Back handler
    useEffect(() => {
        const onBack = () => {
            if (resultPaths.length > 0) {
                handleAcceptReturnHome();
                return true;
            }
            if (selectedFile && !initialPdfUri && toolId !== 'merge') {
                setSelectedFile(null);
                return true;
            }
            navigation.goBack();
            return true;
        };

        const sub = BackHandler.addEventListener('hardwareBackPress', onBack);
        return () => sub.remove();
    }, [resultPaths, selectedFile, initialPdfUri, toolId, navigation]);

    // Load available files for picker
    useEffect(() => {
        const load = async () => {
            setLoadingFiles(true);
            try {
                const files = await scanDocuments();
                setAvailableFiles(files);

                // If initial file provided via route params, match it
                if (initialPdfUri) {
                    const clean = initialPdfUri.replace(/^file:\/\//, '');
                    const matched = files.find((f: LocalFile) => f.path === clean) || {
                        name: initialPdfName || 'documento.pdf',
                        path: clean,
                        size: 0,
                        date: new Date(),
                        type: 'pdf' as const,
                    };
                    setSelectedFile(matched);
                }
            } catch (e) {
                console.warn('Error loading files for tool:', e);
            } finally {
                setLoadingFiles(false);
            }
        };
        load();
    }, [initialPdfUri, initialPdfName]);

    // Read page count when a file is selected
    useEffect(() => {
        if (!selectedFile) return;
        const readInfo = async () => {
            try {
                const info = await PdfToolsService.getPdfInfo(selectedFile.path);
                setTotalPages(info.pageCount);
            } catch (e) {
                console.warn('Error reading pdf info:', e);
                setTotalPages(1);
            }
        };
        readInfo();
    }, [selectedFile]);

    // ==========================================
    // Tool Execution Handlers
    // ==========================================

    const handleMerge = async (paths: string[], outputName?: string) => {
        setIsProcessing(true);
        setProcessMessage('Uniendo documentos PDF...');
        try {
            const out = await PdfToolsService.mergeFiles(paths, outputName);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo unir los documentos.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSplit = async (ranges: string, outputName?: string) => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Dividiendo documento...');
        try {
            const defaultBase = selectedFile.name.replace(/\.pdf$/i, '') + '_dividido';
            const outs = await PdfToolsService.splitFile(selectedFile.path, ranges, outputName || defaultBase);
            setResultPaths(outs);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo dividir el documento.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleExecuteRename = async (newName: string) => {
        if (!renamingFilePath) return;
        const oldPath = renamingFilePath;
        setRenamingFilePath(null);

        const cleanNewName = newName.trim();
        if (!cleanNewName) return;

        const finalName = cleanNewName.toLowerCase().endsWith('.pdf') ? cleanNewName : `${cleanNewName}.pdf`;
        const success = await renameFile(oldPath, finalName);
        if (success) {
            const lastSlash = oldPath.lastIndexOf('/');
            const newPath = oldPath.substring(0, lastSlash + 1) + finalName;
            setResultPaths((prev) => prev.map((p) => (p === oldPath ? newPath : p)));
            if (previewModalPath === oldPath) {
                setPreviewModalPath(newPath);
            }
        } else {
            Alert.alert('Error', 'No se pudo renombrar el archivo.');
        }
    };

    const handleDeletePages = async (pagesToDelete: number[]) => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Eliminando páginas...');
        try {
            const out = await PdfToolsService.deletePages(selectedFile.path, pagesToDelete);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo eliminar las páginas.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRotatePages = async (rotations: Record<number, number>, saveMode: 'original' | 'copy' = 'copy') => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Girando páginas...');
        try {
            const out = await PdfToolsService.rotatePages(selectedFile.path, rotations, saveMode);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo girar las páginas.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReorderPages = async (newOrder: number[], saveMode: 'original' | 'copy' = 'copy') => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Reordenando páginas...');
        try {
            const out = await PdfToolsService.reorderPages(selectedFile.path, newOrder, saveMode);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo reordenar las páginas.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleWatermark = async (opts: WatermarkOptions) => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Aplicando marca de agua...');
        try {
            const out = await PdfToolsService.addWatermark(selectedFile.path, opts);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo aplicar la marca de agua.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleEditDocument = async (edits: DocumentEditItem[], saveMode: 'original' | 'copy' = 'copy') => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Guardando ediciones en el documento...');
        try {
            const out = await PdfToolsService.applyDocumentEdits(selectedFile.path, edits, saveMode);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudieron guardar las modificaciones.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleSignature = async (placement: SignaturePlacement, saveMode: 'original' | 'copy' = 'copy') => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Incrustando firma...');
        try {
            const out = await PdfToolsService.applySignature(selectedFile.path, placement, saveMode);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo insertar la firma.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleRedact = async (boxes: RedactionBox[], saveMode: 'original' | 'copy' = 'copy') => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Censurando información...');
        try {
            const out = await PdfToolsService.redactDocument(selectedFile.path, boxes, saveMode);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo censurar el documento.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFillForm = async (values: Record<string, string | boolean>, flatten: boolean, saveMode: 'original' | 'copy' = 'copy') => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Completando formulario...');
        try {
            const out = await PdfToolsService.fillForm(selectedFile.path, values, flatten, saveMode);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo rellenar el formulario.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleOpenResult = (filePath: string) => {
        const fileName = filePath.split('/').pop() || 'documento.pdf';
        navigation.navigate('PdfViewer', {
            uri: `file://${filePath}`,
            name: fileName,
            isExternal: false,
        });
    };

    const handleShareResult = async (filePath: string) => {
        try {
            await Share.open({
                url: `file://${filePath}`,
                type: 'application/pdf',
            });
        } catch (e) {
            console.warn('Share dismissed or failed:', e);
        }
    };

    return (
        <View style={[styles.safeArea, { backgroundColor: colors.backgroundLight, paddingTop: insets.top }]}>
            {/* Header */}
            <View style={[styles.navHeader, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                {resultPaths.length === 0 && (
                    <TouchableOpacity
                        onPress={() => navigation.goBack()}
                        style={styles.backBtn}
                    >
                        <Icon name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                )}

                <View style={styles.titleContainer}>
                    <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                        {resultPaths.length > 0 ? '' : toolTitle}
                    </Text>
                    {resultPaths.length === 0 && selectedFile && toolId !== 'merge' && (
                        <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
                            {selectedFile.name}
                        </Text>
                    )}
                </View>

                {resultPaths.length === 0 && selectedFile && !initialPdfUri && toolId !== 'merge' && !['sign', 'watermark', 'redact', 'edit'].includes(toolId) && (
                    <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.changeFileBtn}>
                        <Icon name="swap-horiz" size={22} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Content Body */}
            <View style={styles.body}>
                {resultPaths.length > 0 ? (
                    <View style={styles.successScreen}>
                        <View style={[styles.successCard, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                            <View style={[styles.successIconBadge, { backgroundColor: 'rgba(16, 185, 129, 0.12)' }]}>
                                <Icon name="check-circle" size={56} color="#10b981" />
                            </View>

                            <Text style={[styles.successTitle, { color: colors.text }]}>
                                {resultPaths.length > 1
                                    ? `¡${resultPaths.length} documentos generados!`
                                    : '¡Documento generado con éxito!'}
                            </Text>

                            {/* Nested list container for generated PDF(s) (approx. 3.5 items visible) */}
                            <View style={styles.filesNestedContainer}>
                                <ScrollView
                                    style={styles.filesScrollView}
                                    contentContainerStyle={styles.filesScrollContent}
                                    nestedScrollEnabled={true}
                                    showsVerticalScrollIndicator={true}
                                    persistentScrollbar={true}
                                >
                                    {resultPaths.map((filePath, index) => {
                                        const fileName = filePath.split('/').pop() || 'documento.pdf';
                                        return (
                                            <TouchableOpacity
                                                key={`${filePath}_${index}`}
                                                style={[
                                                    styles.successFilePill,
                                                    {
                                                        backgroundColor: colors.backgroundLight,
                                                        borderColor: colors.border,
                                                    },
                                                ]}
                                                onPress={() => {
                                                    setPreviewPageCount(0);
                                                    setPreviewCurrentPage(1);
                                                    setPreviewModalPath(filePath);
                                                }}
                                                activeOpacity={0.7}
                                            >
                                                <Icon name="picture-as-pdf" size={26} color="#ef4444" style={{ marginRight: 12 }} />
                                                <View style={{ flex: 1 }}>
                                                    <View style={{ height: 22, justifyContent: 'center' }}>
                                                        <MarqueeText
                                                            text={fileName}
                                                            style={[styles.successFileName, { color: colors.text }]}
                                                        />
                                                    </View>

                                                    {/* Enlace abajo del nombre del documento para Renombrar */}
                                                    <TouchableOpacity
                                                        onPress={() => setRenamingFilePath(filePath)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                        style={styles.renameLinkBtn}
                                                        activeOpacity={0.7}
                                                    >
                                                        <Icon name="edit" size={13} color={colors.primary} style={{ marginRight: 4 }} />
                                                        <Text style={[styles.renameLinkText, { color: colors.primary }]}>
                                                            Renombrar
                                                        </Text>
                                                    </TouchableOpacity>
                                                </View>
                                            </TouchableOpacity>
                                        );
                                    })}
                                </ScrollView>
                            </View>

                            {/* Action Buttons: Abrir & Compartir */}
                            <View style={styles.successActionsRow}>
                                <TouchableOpacity
                                    style={[styles.successPrimaryBtn, { backgroundColor: colors.primary }]}
                                    onPress={() => handleOpenResult(resultPaths[0])}
                                    activeOpacity={0.8}
                                >
                                    <Icon name="visibility" size={20} color="#ffffff" style={{ marginRight: 6 }} />
                                    <Text style={styles.successPrimaryBtnText}>Abrir</Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[styles.successSecondaryBtn, { borderColor: colors.border, backgroundColor: colors.surfaceLight }]}
                                    onPress={() => handleShareResult(resultPaths[0])}
                                    activeOpacity={0.8}
                                >
                                    <Icon name="share" size={20} color={colors.text} style={{ marginRight: 6 }} />
                                    <Text style={[styles.successSecondaryBtnText, { color: colors.text }]}>Compartir</Text>
                                </TouchableOpacity>
                            </View>

                            {/* Botón mediano de Aceptar que regresa a Documentos general */}
                            <TouchableOpacity
                                style={[styles.acceptBtn, { borderColor: colors.primary, backgroundColor: colors.surfaceLight }]}
                                onPress={handleAcceptReturnHome}
                                activeOpacity={0.8}
                            >
                                <Text style={[styles.acceptBtnText, { color: colors.primary }]}>Aceptar</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                ) : toolId === 'merge' ? (
                    <MergeToolView
                        availableFiles={availableFiles}
                        onProcess={handleMerge}
                        isProcessing={isProcessing}
                        initialFile={selectedFile}
                    />
                ) : !selectedFile ? (
                    /* Document picker for single-document tools */
                    <View style={styles.pickerContainer}>
                        <Text style={[styles.pickerTitle, { color: colors.text }]}>
                            Selecciona un documento para {toolTitle.toLowerCase()}
                        </Text>

                        {loadingFiles ? (
                            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 24 }} />
                        ) : availableFiles.length === 0 ? (
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No se encontraron documentos PDF en tu dispositivo.
                            </Text>
                        ) : (
                            <FlatList
                                data={availableFiles.filter((f) => f.type === 'pdf')}
                                keyExtractor={(f) => f.path}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={[
                                            styles.fileCard,
                                            { backgroundColor: colors.surfaceLight, borderColor: colors.border },
                                        ]}
                                        onPress={() => setSelectedFile(item)}
                                        activeOpacity={0.7}
                                    >
                                        <Icon name="picture-as-pdf" size={28} color="#ef4444" style={{ marginRight: 12 }} />
                                        <View style={{ flex: 1 }}>
                                            <Text style={[styles.fileName, { color: colors.text }]} numberOfLines={1}>
                                                {item.name}
                                            </Text>
                                            <Text style={[styles.fileMeta, { color: colors.textSecondary }]}>
                                                {item.pageCount ? `${item.pageCount} pág. • ` : ''}
                                                {(item.size / 1024).toFixed(0)} KB
                                            </Text>
                                        </View>
                                        <Icon name="chevron-right" size={20} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                                contentContainerStyle={{ paddingBottom: 24 }}
                                showsVerticalScrollIndicator={false}
                            />
                        )}
                    </View>
                ) : totalPages === 0 ? (
                    <View style={styles.centerLoading}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: 12, color: colors.textSecondary }}>Cargando información del PDF...</Text>
                    </View>
                ) : (
                    /* Specific Tool View */
                    <>
                        {toolId === 'split' && (
                            <SplitToolView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleSplit}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'deletePages' && (
                            <DeletePagesToolView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleDeletePages}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'rotate' && (
                            <RotateToolView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleRotatePages}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'reorder' && (
                            <ReorderPagesToolView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleReorderPages}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'watermark' && (
                            <WatermarkToolView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleWatermark}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'sign' && (
                            <SignatureToolView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleSignature}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'redact' && (
                            <RedactToolView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleRedact}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'form' && (
                            <FillFormToolView
                                sourcePath={selectedFile.path}
                                totalPages={totalPages}
                                onProcess={handleFillForm}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'edit' && (
                            <PdfInlineEditorView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleEditDocument}
                                isProcessing={isProcessing}
                            />
                        )}
                    </>
                )}
            </View>

            {/* Progress Modal */}
            <ToolProgressModal
                visible={isProcessing}
                message={processMessage}
            />

            {/* Modal Preview for generated document */}
            <Modal
                visible={!!previewModalPath}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPreviewModalPath(null)}
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
                        <View style={[styles.previewModalHeader, { borderBottomColor: colors.border }]}>
                            <Icon name="picture-as-pdf" size={24} color="#ef4444" style={{ marginRight: 8 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.previewModalTitle, { color: colors.text }]} numberOfLines={1}>
                                    {previewModalPath ? previewModalPath.split('/').pop() : ''}
                                </Text>
                                {previewPageCount > 0 && (
                                    <TouchableOpacity
                                        onPress={() => setPreviewPageJumpVisible(true)}
                                        activeOpacity={0.7}
                                    >
                                        <Text style={[styles.previewModalPageInfo, { color: colors.textSecondary }]}>
                                            Página <Text style={{ color: colors.primary, fontWeight: 'bold' }}>{previewCurrentPage}</Text> de {previewPageCount}
                                        </Text>
                                    </TouchableOpacity>
                                )}
                            </View>
                            <TouchableOpacity
                                onPress={() => setPreviewModalPath(null)}
                                style={styles.previewModalCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Icon name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Page Jump Balloon */}
                        <PageJumpBalloon
                            visible={previewPageJumpVisible}
                            currentPage={previewCurrentPage}
                            totalPages={previewPageCount}
                            onPageChange={handleJumpToPreviewPage}
                            onClose={() => setPreviewPageJumpVisible(false)}
                            topOffset={52}
                        />

                        {/* PDF Content */}
                        <View style={styles.previewModalContent}>
                            {previewModalPath && (
                                <Pdf
                                    ref={previewPdfRef}
                                    source={{
                                        uri: previewModalPath.startsWith('file://')
                                            ? previewModalPath
                                            : `file://${previewModalPath}`,
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
                                    const path = previewModalPath;
                                    setPreviewModalPath(null);
                                    if (path) handleOpenResult(path);
                                }}
                                activeOpacity={0.8}
                            >
                                <Icon name="visibility" size={18} color="#ffffff" style={{ marginRight: 6 }} />
                                <Text style={styles.previewModalOpenBtnText}>Abrir completo</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.previewModalDismissBtn, { borderColor: colors.border }]}
                                onPress={() => setPreviewModalPath(null)}
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

            {/* Rename Modal on Success Screen */}
            <RenameModal
                visible={!!renamingFilePath}
                currentName={renamingFilePath ? renamingFilePath.split('/').pop() || 'documento.pdf' : 'documento.pdf'}
                onClose={() => setRenamingFilePath(null)}
                onRename={handleExecuteRename}
                title="Renombrar documento"
                saveLabel="Guardar"
            />
        </View>
    );
};

const styles = StyleSheet.create({
    safeArea: {
        flex: 1,
    },
    navHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 10,
        borderBottomWidth: 1,
    },
    backBtn: {
        padding: 6,
        marginRight: 8,
    },
    titleContainer: {
        flex: 1,
    },
    headerTitle: {
        fontSize: 16,
        fontWeight: 'bold',
    },
    headerSub: {
        fontSize: 11,
        marginTop: 1,
    },
    changeFileBtn: {
        padding: 6,
    },
    body: {
        flex: 1,
    },
    centerLoading: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    pickerContainer: {
        flex: 1,
        padding: 16,
    },
    pickerTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 14,
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 24,
    },
    fileCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 8,
    },
    fileName: {
        fontSize: 13,
        fontWeight: '600',
    },
    fileMeta: {
        fontSize: 11,
        marginTop: 2,
    },
    successScreen: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 16,
    },
    successCard: {
        width: '100%',
        maxWidth: 420,
        borderRadius: 22,
        paddingHorizontal: 20,
        paddingTop: 24,
        paddingBottom: 20,
        alignItems: 'center',
        borderWidth: 1,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 10,
    },
    successIconBadge: {
        width: 64,
        height: 64,
        borderRadius: 32,
        justifyContent: 'center',
        alignItems: 'center',
        marginBottom: 10,
        marginTop: 4,
    },
    successTitle: {
        fontSize: 17,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 10,
    },
    filesNestedContainer: {
        width: '100%',
        maxHeight: 220,
        marginVertical: 10,
    },
    filesScrollView: {
        width: '100%',
    },
    filesScrollContent: {
        paddingRight: 4,
    },
    successFilePill: {
        flexDirection: 'row',
        alignItems: 'flex-start',
        width: '100%',
        paddingVertical: 12,
        paddingHorizontal: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
    },
    successFileName: {
        fontSize: 14,
        fontWeight: '700',
    },
    successFilePath: {
        fontSize: 11,
        marginTop: 4,
    },
    renameLinkBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        alignSelf: 'flex-start',
        paddingVertical: 3,
        paddingHorizontal: 0,
        marginVertical: 3,
    },
    renameLinkText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    successActionsRow: {
        flexDirection: 'row',
        width: '100%',
        gap: 12,
        marginBottom: 16,
    },
    successPrimaryBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    successPrimaryBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    successSecondaryBtn: {
        flex: 1,
        height: 46,
        borderRadius: 12,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    successSecondaryBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
    },
    acceptBtn: {
        minWidth: 150,
        height: 42,
        paddingHorizontal: 28,
        borderRadius: 21,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    acceptBtnText: {
        fontSize: 14,
        fontWeight: 'bold',
        includeFontPadding: false,
        textAlignVertical: 'center',
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
        paddingVertical: 10,
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
});
