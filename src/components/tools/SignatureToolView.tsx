import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    PanResponder,
    Alert,
    ScrollView,
    Modal,
    FlatList,
    Image,
    Dimensions,
    ActivityIndicator,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Pdf from 'react-native-pdf';
import RNFS from 'react-native-fs';
import { useTheme } from '../../theme/ThemeContext';
import { SignaturePlacement, PdfToolsService } from '../../services/PdfToolsService';
import { LocalImage, scanDeviceImages } from '../../services/FileService';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (placement: SignaturePlacement, saveMode: 'original' | 'copy') => Promise<void>;
    isProcessing: boolean;
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const CANVAS_WIDTH = SCREEN_WIDTH - 32;
const CANVAS_HEIGHT = 160;
const SIGNATURE_ASPECT_RATIO = 2.4; // width / height

export const SignatureToolView: React.FC<Props> = ({
    totalPages,
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();

    // Steps: 'create' -> 'place'
    const [step, setStep] = useState<'create' | 'place'>('create');

    // Drawing state
    const [paths, setPaths] = useState<string[]>([]);
    const [currentPath, setCurrentPath] = useState('');
    const [color, setColor] = useState('#000000');

    // Image state
    const [selectedImage, setSelectedImage] = useState<LocalImage | null>(null);
    const [imagePickerVisible, setImagePickerVisible] = useState(false);
    const [deviceImages, setDeviceImages] = useState<LocalImage[]>([]);
    const [loadingImages, setLoadingImages] = useState(false);

    // Placement state in PDF reader
    const [currentPage, setCurrentPage] = useState(1);
    const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
    const [viewerLayout, setViewerLayout] = useState<{ width: number; height: number }>({ width: SCREEN_WIDTH, height: 400 });

    // Draggable box state
    const [boxWidth, setBoxWidth] = useState(160);
    const [boxPos, setBoxPos] = useState({ x: (SCREEN_WIDTH - 160) / 2, y: 150 });
    const boxPosRef = useRef({ x: (SCREEN_WIDTH - 160) / 2, y: 150 });
    boxPosRef.current = boxPos;

    // Confirmation modal state
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);

    // Drawing PanResponder
    const drawPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                setCurrentPath(`M ${locationX.toFixed(1)},${locationY.toFixed(1)}`);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY } = evt.nativeEvent;
                setCurrentPath((prev) => `${prev} L ${locationX.toFixed(1)},${locationY.toFixed(1)}`);
            },
            onPanResponderRelease: () => {
                setCurrentPath((prev) => {
                    if (prev) {
                        setPaths((old) => [...old, prev]);
                    }
                    return '';
                });
            },
        })
    ).current;

    // Draggable signature box PanResponder
    const dragPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {},
            onPanResponderMove: (_, gestureState) => {
                const newX = Math.max(0, Math.min(viewerLayout.width - boxWidth, boxPosRef.current.x + gestureState.dx));
                const boxHeight = boxWidth / SIGNATURE_ASPECT_RATIO;
                const newY = Math.max(0, Math.min(viewerLayout.height - boxHeight, boxPosRef.current.y + gestureState.dy));
                setBoxPos({ x: newX, y: newY });
            },
            onPanResponderRelease: (_, gestureState) => {
                const newX = Math.max(0, Math.min(viewerLayout.width - boxWidth, boxPosRef.current.x + gestureState.dx));
                const boxHeight = boxWidth / SIGNATURE_ASPECT_RATIO;
                const newY = Math.max(0, Math.min(viewerLayout.height - boxHeight, boxPosRef.current.y + gestureState.dy));
                setBoxPos({ x: newX, y: newY });
            },
        })
    ).current;

    // Load PDF info on mount
    useEffect(() => {
        const loadInfo = async () => {
            try {
                const info = await PdfToolsService.getPdfInfo(sourcePath);
                if (info.pages && info.pages.length > 0) {
                    setPdfDimensions({
                        width: info.pages[0].width || 595,
                        height: info.pages[0].height || 842,
                    });
                }
            } catch (e) {
                console.warn('Could not read PDF dimensions:', e);
            }
        };
        loadInfo();
    }, [sourcePath]);

    // Handle picking image
    const handleOpenImagePicker = async () => {
        setLoadingImages(true);
        setImagePickerVisible(true);
        try {
            const imgs = await scanDeviceImages();
            setDeviceImages(imgs);
        } catch (e) {
            console.warn('Error reading device images:', e);
        } finally {
            setLoadingImages(false);
        }
    };

    const handleSelectImage = (img: LocalImage) => {
        setSelectedImage(img);
        setPaths([]); // clear drawn signature if using image
        setCurrentPath('');
        setImagePickerVisible(false);
    };

    const handleClearSignature = () => {
        setPaths([]);
        setCurrentPath('');
        setSelectedImage(null);
    };

    const hasSignature = paths.length > 0 || currentPath.length > 0 || selectedImage !== null;

    // Resize controls
    const handleZoomIn = () => {
        setBoxWidth((prev) => Math.min(280, prev + 25));
    };

    const handleZoomOut = () => {
        setBoxWidth((prev) => Math.max(80, prev - 25));
    };

    // Calculate PDF coordinates and trigger placement
    const handleConfirmPlacement = async (saveMode: 'original' | 'copy') => {
        setConfirmModalVisible(false);

        // Aspect fit calculation: PDF inside viewer layout
        const pdfAspect = pdfDimensions.width / pdfDimensions.height;
        const viewerAspect = viewerLayout.width / viewerLayout.height;

        let renderedW = viewerLayout.width;
        let renderedH = viewerLayout.height;
        let offsetX = 0;
        let offsetY = 0;

        if (pdfAspect > viewerAspect) {
            // Fits by width
            renderedW = viewerLayout.width;
            renderedH = viewerLayout.width / pdfAspect;
            offsetY = (viewerLayout.height - renderedH) / 2;
        } else {
            // Fits by height
            renderedH = viewerLayout.height;
            renderedW = viewerLayout.height * pdfAspect;
            offsetX = (viewerLayout.width - renderedW) / 2;
        }

        const boxHeight = boxWidth / SIGNATURE_ASPECT_RATIO;

        // Relative coordinates on the rendered page (0.0 to 1.0)
        const relX = Math.max(0, Math.min(1, (boxPos.x - offsetX) / renderedW));
        const relY = Math.max(0, Math.min(1, (boxPos.y - offsetY) / renderedH));
        const relW = boxWidth / renderedW;
        const relH = boxHeight / renderedH;

        // Map to PDF point coordinates
        const pdfPtX = relX * pdfDimensions.width;
        const pdfPtW = relW * pdfDimensions.width;
        const pdfPtH = relH * pdfDimensions.height;
        // In PDF coordinates, 0 is at the bottom:
        const pdfPtY = pdfDimensions.height - (relY * pdfDimensions.height) - pdfPtH;

        let placement: SignaturePlacement;

        if (selectedImage) {
            const base64 = await RNFS.readFile(selectedImage.path, 'base64');
            placement = {
                pageIndex: currentPage - 1,
                signatureBase64: base64,
                x: pdfPtX,
                y: pdfPtY,
                width: pdfPtW,
                height: pdfPtH,
            };
        } else {
            // Vector stroke
            const strokeRgb =
                color === '#2563eb'
                    ? { r: 0.15, g: 0.39, b: 0.92 }
                    : color === '#dd1f47'
                    ? { r: 0.86, g: 0.12, b: 0.28 }
                    : { r: 0.05, g: 0.05, b: 0.05 };

            placement = {
                pageIndex: currentPage - 1,
                svgPaths: paths,
                strokeColor: strokeRgb,
                canvasWidth: CANVAS_WIDTH,
                canvasHeight: CANVAS_HEIGHT,
                x: pdfPtX,
                y: pdfPtY,
                width: pdfPtW,
                height: pdfPtH,
            };
        }

        onProcess(placement, saveMode);
    };

    // ==========================================
    // STEP 1: CREATE SIGNATURE (DRAW OR PICK IMAGE)
    // ==========================================
    if (step === 'create') {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Escribe tu firma con el dedo</Text>

                {/* Finger Drawing Canvas */}
                <View
                    style={[
                        styles.canvasContainer,
                        {
                            backgroundColor: '#ffffff',
                            borderColor: colors.border,
                        },
                    ]}
                    {...drawPanResponder.panHandlers}
                >
                    {selectedImage ? (
                        <Image source={{ uri: selectedImage.uri }} style={styles.imagePreview} resizeMode="contain" />
                    ) : (
                        <Svg style={StyleSheet.absoluteFill}>
                            {paths.map((p, i) => (
                                <Path key={i} d={p} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            ))}
                            {currentPath ? (
                                <Path d={currentPath} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            ) : null}
                        </Svg>
                    )}

                    {!hasSignature && (
                        <Text style={styles.canvasPlaceholder}>Firma aquí con tu dedo</Text>
                    )}
                </View>

                {/* Controls: Color & Clear */}
                <View style={styles.canvasActions}>
                    <View style={styles.colorRow}>
                        {['#000000', '#2563eb', '#dd1f47'].map((c) => (
                            <TouchableOpacity
                                key={c}
                                style={[
                                    styles.colorBtn,
                                    {
                                        backgroundColor: c,
                                        borderColor: color === c ? colors.primary : 'transparent',
                                        borderWidth: color === c ? 2 : 0,
                                    },
                                ]}
                                onPress={() => {
                                    setColor(c);
                                    if (selectedImage) setSelectedImage(null);
                                }}
                            />
                        ))}
                    </View>

                    {hasSignature && (
                        <TouchableOpacity style={styles.clearBtn} onPress={handleClearSignature}>
                            <Icon name="delete-outline" size={18} color="#ef4444" style={{ marginRight: 4 }} />
                            <Text style={{ color: '#ef4444', fontSize: 12, fontWeight: 'bold' }}>Borrar firma</Text>
                        </TouchableOpacity>
                    )}
                </View>

                {/* Pick from images option */}
                <TouchableOpacity
                    style={[styles.pickImageBtn, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                    onPress={handleOpenImagePicker}
                    activeOpacity={0.8}
                >
                    <Icon name="photo-library" size={20} color={colors.primary} style={{ marginRight: 8 }} />
                    <Text style={[styles.pickImageText, { color: colors.text }]}>Elegir desde mis imágenes</Text>
                </TouchableOpacity>

                {/* Continue button */}
                <TouchableOpacity
                    style={[
                        styles.continueBtn,
                        {
                            backgroundColor: hasSignature ? colors.primary : 'rgba(221, 31, 71, 0.4)',
                        },
                    ]}
                    onPress={() => {
                        if (!hasSignature) {
                            Alert.alert('Atención', 'Dibuja tu firma o selecciona una imagen antes de continuar.');
                            return;
                        }
                        setStep('place');
                    }}
                    disabled={!hasSignature || isProcessing}
                    activeOpacity={0.8}
                >
                    <Icon name="arrow-forward" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.continueBtnText}>Continuar a colocar firma</Text>
                </TouchableOpacity>

                {/* Image Picker Modal */}
                <Modal visible={imagePickerVisible} animationType="slide" transparent>
                    <View style={styles.modalBackdrop}>
                        <View style={[styles.modalCard, { backgroundColor: colors.surfaceLight }]}>
                            <View style={styles.modalHeader}>
                                <Text style={[styles.modalTitle, { color: colors.text }]}>Selecciona una imagen</Text>
                                <TouchableOpacity onPress={() => setImagePickerVisible(false)}>
                                    <Icon name="close" size={24} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            {loadingImages ? (
                                <ActivityIndicator size="large" color={colors.primary} style={{ marginVertical: 32 }} />
                            ) : deviceImages.length === 0 ? (
                                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                    No se encontraron imágenes en las carpetas comunes del teléfono.
                                </Text>
                            ) : (
                                <FlatList
                                    data={deviceImages}
                                    keyExtractor={(item) => item.path}
                                    numColumns={3}
                                    renderItem={({ item }) => (
                                        <TouchableOpacity
                                            style={styles.gridImageItem}
                                            onPress={() => handleSelectImage(item)}
                                            activeOpacity={0.7}
                                        >
                                            <Image source={{ uri: item.uri }} style={styles.gridImage} />
                                        </TouchableOpacity>
                                    )}
                                    style={{ maxHeight: 380 }}
                                />
                            )}
                        </View>
                    </View>
                </Modal>
            </ScrollView>
        );
    }

    // ==========================================
    // STEP 2: INTERACTIVE PDF PLACEMENT
    // ==========================================
    const boxHeight = boxWidth / SIGNATURE_ASPECT_RATIO;

    return (
        <View style={styles.placementContainer}>
            {/* Top Toolbar: Back & Page navigation */}
            <View style={[styles.placementHeader, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={styles.backToCreateBtn}
                    onPress={() => setStep('create')}
                    activeOpacity={0.7}
                >
                    <Icon name="arrow-back" size={18} color={colors.primary} style={{ marginRight: 4 }} />
                    <Text style={[styles.backToCreateText, { color: colors.primary }]}>Cambiar firma</Text>
                </TouchableOpacity>

                {/* Page Jump / Navigator */}
                <View style={styles.pageNavigator}>
                    <TouchableOpacity
                        disabled={currentPage <= 1}
                        onPress={() => setCurrentPage((p) => Math.max(1, p - 1))}
                        style={[styles.pageNavBtn, { opacity: currentPage <= 1 ? 0.3 : 1 }]}
                    >
                        <Icon name="chevron-left" size={22} color={colors.text} />
                    </TouchableOpacity>

                    <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
                        Pág. <Text style={{ fontWeight: 'bold' }}>{currentPage}</Text> de {totalPages}
                    </Text>

                    <TouchableOpacity
                        disabled={currentPage >= totalPages}
                        onPress={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
                        style={[styles.pageNavBtn, { opacity: currentPage >= totalPages ? 0.3 : 1 }]}
                    >
                        <Icon name="chevron-right" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Interactive PDF Reader with floating signature box */}
            <View
                style={styles.pdfWrapper}
                onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    setViewerLayout({ width, height });
                }}
            >
                <Pdf
                    source={{ uri: sourcePath.startsWith('file://') ? sourcePath : `file://${sourcePath}` }}
                    page={currentPage}
                    singlePage={true}
                    scale={1.0}
                    fitPolicy={2}
                    style={styles.pdfView}
                    onLoadComplete={(numberOfPages, filePath, { width, height }: any) => {
                        if (width && height) {
                            setPdfDimensions({ width, height });
                        }
                    }}
                    onError={(error) => {
                        console.warn('Pdf viewer error in signature tool:', error);
                    }}
                />

                {/* Draggable Translucent Signature Box */}
                <View
                    style={[
                        styles.draggableBox,
                        {
                            width: boxWidth,
                            height: boxHeight,
                            transform: [{ translateX: boxPos.x }, { translateY: boxPos.y }],
                            borderColor: colors.primary,
                        },
                    ]}
                    {...dragPanResponder.panHandlers}
                >
                    {/* Render Signature Inside Box */}
                    {selectedImage ? (
                        <Image source={{ uri: selectedImage.uri }} style={styles.boxInnerImage} resizeMode="contain" />
                    ) : (
                        <Svg
                            style={StyleSheet.absoluteFill}
                            viewBox={`0 0 ${CANVAS_WIDTH} ${CANVAS_HEIGHT}`}
                            preserveAspectRatio="xMidYMid meet"
                        >
                            {paths.map((p, i) => (
                                <Path key={i} d={p} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                            ))}
                        </Svg>
                    )}

                    {/* Resizing controls pill at top-right of box */}
                    <View style={styles.resizeControlsPill}>
                        <TouchableOpacity onPress={handleZoomOut} style={styles.resizeBtn} activeOpacity={0.7}>
                            <Icon name="remove" size={14} color="#ffffff" />
                        </TouchableOpacity>
                        <View style={styles.resizeDivider} />
                        <TouchableOpacity onPress={handleZoomIn} style={styles.resizeBtn} activeOpacity={0.7}>
                            <Icon name="add" size={14} color="#ffffff" />
                        </TouchableOpacity>
                    </View>

                    {/* Move indicator */}
                    <View style={styles.moveIndicator}>
                        <Icon name="open-with" size={14} color="rgba(221, 31, 71, 0.7)" />
                    </View>
                </View>
            </View>

            {/* Bottom Bar: Action to stamp signature */}
            <View style={[styles.bottomBar, { backgroundColor: colors.surfaceLight, borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={[styles.applyButton, { backgroundColor: colors.primary }]}
                    onPress={() => setConfirmModalVisible(true)}
                    activeOpacity={0.8}
                >
                    <Icon name="draw" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.applyButtonText}>Colocar firma</Text>
                </TouchableOpacity>
            </View>

            {/* Confirmation Modal: Original vs Copy */}
            <Modal visible={confirmModalVisible} transparent animationType="fade">
                <View style={styles.modalBackdrop}>
                    <View style={[styles.confirmCard, { backgroundColor: colors.surfaceLight }]}>
                        <Text style={[styles.confirmTitle, { color: colors.text }]}>¿Cómo deseas guardar el PDF?</Text>
                        <Text style={[styles.confirmSubtitle, { color: colors.textSecondary }]}>
                            Selecciona una opción para aplicar tu firma:
                        </Text>

                        {/* Option A: Make a copy */}
                        <TouchableOpacity
                            style={[styles.confirmOption, { backgroundColor: colors.backgroundLight, borderColor: colors.primary }]}
                            onPress={() => handleConfirmPlacement('copy')}
                            activeOpacity={0.8}
                        >
                            <Icon name="file-copy" size={22} color={colors.primary} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.optionMainText, { color: colors.text }]}>Hacer una copia y firmar</Text>
                                <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                                    Crea un nuevo archivo con el sufijo "_firmado"
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Option B: Sign original */}
                        <TouchableOpacity
                            style={[styles.confirmOption, { backgroundColor: colors.backgroundLight, borderColor: colors.border }]}
                            onPress={() => handleConfirmPlacement('original')}
                            activeOpacity={0.8}
                        >
                            <Icon name="save" size={22} color={colors.text} style={{ marginRight: 12 }} />
                            <View style={{ flex: 1 }}>
                                <Text style={[styles.optionMainText, { color: colors.text }]}>Firmar en el documento original</Text>
                                <Text style={[styles.optionSubText, { color: colors.textSecondary }]}>
                                    Sobrescribe directamente el archivo original
                                </Text>
                            </View>
                        </TouchableOpacity>

                        {/* Cancel */}
                        <TouchableOpacity
                            style={styles.cancelBtn}
                            onPress={() => setConfirmModalVisible(false)}
                        >
                            <Text style={[styles.cancelBtnText, { color: colors.textSecondary }]}>Cancelar</Text>
                        </TouchableOpacity>
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
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 10,
    },
    canvasContainer: {
        height: CANVAS_HEIGHT,
        borderRadius: 16,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        overflow: 'hidden',
    },
    canvasPlaceholder: {
        color: '#94a3b8',
        fontSize: 14,
        fontStyle: 'italic',
    },
    imagePreview: {
        width: '100%',
        height: '100%',
    },
    canvasActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginTop: 10,
    },
    colorRow: {
        flexDirection: 'row',
        gap: 8,
    },
    colorBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
    },
    clearBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
    },
    pickImageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        height: 48,
        borderRadius: 14,
        borderWidth: 1,
        marginTop: 18,
    },
    pickImageText: {
        fontSize: 13,
        fontWeight: '600',
    },
    continueBtn: {
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        marginTop: 24,
        elevation: 4,
    },
    continueBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    // Placement view
    placementContainer: {
        flex: 1,
    },
    placementHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    backToCreateBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
    },
    backToCreateText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    pageNavigator: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pageNavBtn: {
        padding: 4,
    },
    pageIndicatorText: {
        fontSize: 12,
    },
    pdfWrapper: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#0f172a',
    },
    pdfView: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    draggableBox: {
        position: 'absolute',
        top: 0,
        left: 0,
        backgroundColor: 'rgba(221, 31, 71, 0.18)',
        borderWidth: 2,
        borderStyle: 'dashed',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    boxInnerImage: {
        width: '100%',
        height: '100%',
    },
    resizeControlsPill: {
        position: 'absolute',
        top: -14,
        right: -8,
        flexDirection: 'row',
        backgroundColor: '#1e293b',
        borderRadius: 12,
        paddingHorizontal: 4,
        paddingVertical: 2,
        elevation: 6,
        alignItems: 'center',
    },
    resizeBtn: {
        padding: 4,
    },
    resizeDivider: {
        width: 1,
        height: 10,
        backgroundColor: '#64748b',
        marginHorizontal: 2,
    },
    moveIndicator: {
        position: 'absolute',
        bottom: 2,
        left: 4,
    },
    bottomBar: {
        padding: 14,
        borderTopWidth: 1,
    },
    applyButton: {
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    applyButtonText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    // Modals
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    modalCard: {
        width: '100%',
        borderRadius: 20,
        padding: 16,
        maxHeight: 460,
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 12,
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    emptyText: {
        textAlign: 'center',
        fontSize: 13,
        marginVertical: 24,
    },
    gridImageItem: {
        flex: 1 / 3,
        aspectRatio: 1,
        padding: 3,
    },
    gridImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    confirmCard: {
        width: '100%',
        maxWidth: 360,
        borderRadius: 20,
        padding: 20,
    },
    confirmTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    confirmSubtitle: {
        fontSize: 12,
        marginBottom: 16,
    },
    confirmOption: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1.5,
        marginBottom: 10,
    },
    optionMainText: {
        fontSize: 13,
        fontWeight: '700',
    },
    optionSubText: {
        fontSize: 11,
        marginTop: 2,
    },
    cancelBtn: {
        marginTop: 6,
        alignItems: 'center',
        paddingVertical: 10,
    },
    cancelBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
