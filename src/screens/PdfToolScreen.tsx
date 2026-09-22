import React, { useState, useEffect, useMemo } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, ActivityIndicator, Alert, BackHandler } from 'react-native';
import { useNavigation, useRoute } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Share from 'react-native-share';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';
import { LocalFile, scanDocuments } from '../services/FileService';
import { PdfToolsService, WatermarkOptions, SignaturePlacement, RedactionBox } from '../services/PdfToolsService';

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
import { EditAnnotationsView } from '../components/tools/EditAnnotationsView';

// Shared
import { ToolProgressModal } from '../components/tools/shared/ToolProgressModal';
import { ToolResultBar } from '../components/tools/shared/ToolResultBar';

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

    // Title from i18n
    const toolTitle = useMemo(() => {
        return t(`tools.${toolId}`) || 'Herramienta PDF';
    }, [toolId]);

    // Back handler
    useEffect(() => {
        const onBack = () => {
            if (resultPaths.length > 0) {
                setResultPaths([]);
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

    const handleSplit = async (ranges: string) => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Dividiendo documento...');
        try {
            const outs = await PdfToolsService.splitFile(selectedFile.path, ranges);
            setResultPaths(outs);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo dividir el documento.');
        } finally {
            setIsProcessing(false);
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

    const handleRotatePages = async (rotations: Record<number, number>) => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Girando páginas...');
        try {
            const out = await PdfToolsService.rotatePages(selectedFile.path, rotations);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo girar las páginas.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleReorderPages = async (newOrder: number[]) => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Reordenando páginas...');
        try {
            const out = await PdfToolsService.reorderPages(selectedFile.path, newOrder);
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

    const handleRedact = async (boxes: RedactionBox[]) => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Censurando información...');
        try {
            const out = await PdfToolsService.redactDocument(selectedFile.path, boxes);
            setResultPaths([out]);
        } catch (e: any) {
            Alert.alert('Error', e.message || 'No se pudo censurar el documento.');
        } finally {
            setIsProcessing(false);
        }
    };

    const handleFillForm = async (values: Record<string, string | boolean>, flatten: boolean) => {
        if (!selectedFile) return;
        setIsProcessing(true);
        setProcessMessage('Completando formulario...');
        try {
            const out = await PdfToolsService.fillForm(selectedFile.path, values, flatten);
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
            isExternal: true,
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
                <TouchableOpacity onPress={() => navigation.goBack()} style={styles.backBtn}>
                    <Icon name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>

                <View style={styles.titleContainer}>
                    <Text style={[styles.headerTitle, { color: colors.text }]} numberOfLines={1}>
                        {toolTitle}
                    </Text>
                    {selectedFile && toolId !== 'merge' && (
                        <Text style={[styles.headerSub, { color: colors.textSecondary }]} numberOfLines={1}>
                            {selectedFile.name}
                        </Text>
                    )}
                </View>

                {selectedFile && !initialPdfUri && toolId !== 'merge' && (
                    <TouchableOpacity onPress={() => setSelectedFile(null)} style={styles.changeFileBtn}>
                        <Icon name="swap-horiz" size={22} color={colors.primary} />
                    </TouchableOpacity>
                )}
            </View>

            {/* Content Body */}
            <View style={styles.body}>
                {toolId === 'merge' ? (
                    <MergeToolView
                        availableFiles={availableFiles}
                        onProcess={handleMerge}
                        isProcessing={isProcessing}
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
                                onProcess={handleFillForm}
                                isProcessing={isProcessing}
                            />
                        )}
                        {toolId === 'edit' && (
                            <EditAnnotationsView
                                totalPages={totalPages}
                                sourcePath={selectedFile.path}
                                onProcess={handleWatermark}
                                isProcessing={isProcessing}
                            />
                        )}
                    </>
                )}
            </View>

            {/* Bottom Result Bar */}
            <ToolResultBar
                resultPaths={resultPaths}
                onOpen={handleOpenResult}
                onShare={handleShareResult}
                onReset={() => setResultPaths([])}
            />

            {/* Progress Modal */}
            <ToolProgressModal
                visible={isProcessing}
                message={processMessage}
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
});
