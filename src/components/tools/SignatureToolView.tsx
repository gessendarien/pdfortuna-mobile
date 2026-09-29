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
    TextInput,
    LayoutAnimation,
} from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Pdf from 'react-native-pdf';
import RNFS from 'react-native-fs';
import { useTheme } from '../../theme/ThemeContext';
import { SignaturePlacement, PdfToolsService } from '../../services/PdfToolsService';
import { LocalImage, scanDeviceImages } from '../../services/FileService';
import { ConfirmModal } from '../ConfirmModal';
import { SaveModeModal } from './shared/SaveModeModal';
import { PageJumpBalloon } from './shared/PageJumpBalloon';

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

const parsePageRangeString = (input: string, totalPages: number): number[] => {
    const pagesSet = new Set<number>();
    const parts = input.split(',').map((p) => p.trim()).filter(Boolean);

    for (const part of parts) {
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-').map((s) => s.trim());
            const start = parseInt(startStr, 10);
            const end = parseInt(endStr, 10);
            if (!isNaN(start) && !isNaN(end)) {
                const min = Math.max(1, Math.min(start, end));
                const max = Math.min(totalPages, Math.max(start, end));
                for (let p = min; p <= max; p++) {
                    pagesSet.add(p);
                }
            }
        } else {
            const single = parseInt(part, 10);
            if (!isNaN(single) && single >= 1 && single <= totalPages) {
                pagesSet.add(single);
            }
        }
    }

    return Array.from(pagesSet).sort((a, b) => a - b);
};

export const SignatureToolView: React.FC<Props> = ({
    totalPages,
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();

    // Steps: 'create' -> 'place'
    const [step, setStep] = useState<'create' | 'place'>('create');

    // Page scope state: 'single' | 'multiple'
    const [pageScope, setPageScope] = useState<'single' | 'multiple'>('single');
    const [customPagesInput, setCustomPagesInput] = useState<string>('');

    // Rotation state: 0, 90, 180, 270
    const [rotationDeg, setRotationDeg] = useState<number>(0);

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
    const [pageJumpVisible, setPageJumpVisible] = useState(false);
    const pdfRef = useRef<any>(null);
    const [pdfDimensions, setPdfDimensions] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
    const [viewerLayout, setViewerLayout] = useState<{ width: number; height: number }>({ width: SCREEN_WIDTH, height: 500 });
    const viewerLayoutRef = useRef<{ width: number; height: number }>({ width: SCREEN_WIDTH, height: 500 });
    viewerLayoutRef.current = viewerLayout;

    // Rotation slider refs and updater
    const rotSliderWidthRef = useRef<number>(200);
    const rotSliderContainerRef = useRef<View>(null);
    const rotSliderPageXRef = useRef<number>(0);

    const updateRotationTouch = (pageX: number) => {
        const trackWidth = Math.max(80, rotSliderWidthRef.current);
        const relativeX = pageX - rotSliderPageXRef.current;
        const pct = Math.max(0, Math.min(1.0, relativeX / trackWidth));
        const deg = Math.round(pct * 360);
        setRotationDeg(deg);
    };

    const handlePageChange = (page: number) => {
        const clamped = Math.max(1, Math.min(totalPages, page));
        setCurrentPage(clamped);
        try {
            pdfRef.current?.setPage(clamped);
        } catch (e) {
            // ignore
        }
    };

    // Draggable box state
    const [boxWidth, setBoxWidth] = useState(160);
    const [boxPos, setBoxPos] = useState({ x: (SCREEN_WIDTH - 160) / 2, y: 150 });
    const boxPosRef = useRef({ x: (SCREEN_WIDTH - 160) / 2, y: 150 });
    boxPosRef.current = boxPos;

    // Confirmation modal state
    const [confirmModalVisible, setConfirmModalVisible] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    // Canvas measurement & layout
    const canvasViewRef = useRef<View>(null);
    const canvasLayoutRef = useRef<{ pageX: number; pageY: number }>({ pageX: 0, pageY: 0 });

    const updateCanvasLayout = () => {
        canvasViewRef.current?.measure((_x, _y, _w, _h, pageX, pageY) => {
            if (pageX !== undefined && pageY !== undefined) {
                canvasLayoutRef.current = { pageX, pageY };
            }
        });
    };

    // Drawing PanResponder (accurate start coordinate, never jumps to 0,0)
    const drawPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: (evt) => {
                const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
                let x = locationX;
                let y = locationY;
                if (canvasLayoutRef.current.pageX > 0 && pageX !== undefined && pageY !== undefined) {
                    x = pageX - canvasLayoutRef.current.pageX;
                    y = pageY - canvasLayoutRef.current.pageY;
                }
                x = Math.max(0, Math.min(CANVAS_WIDTH, x));
                y = Math.max(0, Math.min(CANVAS_HEIGHT, y));
                setCurrentPath(`M ${x.toFixed(1)},${y.toFixed(1)}`);
            },
            onPanResponderMove: (evt) => {
                const { locationX, locationY, pageX, pageY } = evt.nativeEvent;
                let x = locationX;
                let y = locationY;
                if (canvasLayoutRef.current.pageX > 0 && pageX !== undefined && pageY !== undefined) {
                    x = pageX - canvasLayoutRef.current.pageX;
                    y = pageY - canvasLayoutRef.current.pageY;
                }
                x = Math.max(0, Math.min(CANVAS_WIDTH, x));
                y = Math.max(0, Math.min(CANVAS_HEIGHT, y));
                setCurrentPath((prev) => `${prev} L ${x.toFixed(1)},${y.toFixed(1)}`);
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

    // Draggable & pinch-resizable signature box PanResponder
    const dragStartPos = useRef({ x: (SCREEN_WIDTH - 160) / 2, y: 150 });
    const initialPinchDistance = useRef<number | null>(null);
    const initialBoxWidth = useRef(160);
    const initialBoxCenter = useRef({ x: (SCREEN_WIDTH - 160) / 2 + 80, y: 150 + 40 });
    const boxWidthRef = useRef(160);
    boxWidthRef.current = boxWidth;

    const dragPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (evt) => {
                dragStartPos.current = { x: boxPosRef.current.x, y: boxPosRef.current.y };
                const curW = boxWidthRef.current;
                const curH = curW / SIGNATURE_ASPECT_RATIO;
                initialBoxCenter.current = { x: boxPosRef.current.x + curW / 2, y: boxPosRef.current.y + curH / 2 };
                if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
                    const t1 = evt.nativeEvent.touches[0];
                    const t2 = evt.nativeEvent.touches[1];
                    initialPinchDistance.current = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
                    initialBoxWidth.current = curW;
                } else {
                    initialPinchDistance.current = null;
                }
            },
            onPanResponderMove: (evt, gestureState) => {
                const vWidth = viewerLayoutRef.current.width || SCREEN_WIDTH;
                const vHeight = viewerLayoutRef.current.height || 500;

                // Two-finger pinch to resize signature box symmetrically from center
                if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
                    const t1 = evt.nativeEvent.touches[0];
                    const t2 = evt.nativeEvent.touches[1];
                    const distance = Math.hypot(t1.pageX - t2.pageX, t1.pageY - t2.pageY);
                    if (initialPinchDistance.current && initialPinchDistance.current > 10) {
                        const scale = distance / initialPinchDistance.current;
                        const newWidth = Math.round(
                            Math.max(60, Math.min(vWidth * 0.95, initialBoxWidth.current * scale))
                        );
                        const newHeight = newWidth / SIGNATURE_ASPECT_RATIO;
                        const newX = Math.round(initialBoxCenter.current.x - newWidth / 2);
                        const newY = Math.round(initialBoxCenter.current.y - newHeight / 2);

                        setBoxWidth(newWidth);
                        setBoxPos({
                            x: Math.max(-newWidth + 20, Math.min(vWidth - 20, newX)),
                            y: Math.max(-newHeight + 20, Math.min(vHeight - 20, newY)),
                        });
                    } else {
                        initialPinchDistance.current = distance;
                        initialBoxWidth.current = boxWidthRef.current;
                        const curW = boxWidthRef.current;
                        const curH = curW / SIGNATURE_ASPECT_RATIO;
                        initialBoxCenter.current = { x: boxPosRef.current.x + curW / 2, y: boxPosRef.current.y + curH / 2 };
                    }
                    return;
                }

                // Single finger drag without restrictive limits (allows placing anywhere on the document)
                const currentWidth = boxWidthRef.current;
                const currentHeight = currentWidth / SIGNATURE_ASPECT_RATIO;
                const newX = Math.max(
                    -currentWidth + 20,
                    Math.min(vWidth - 20, dragStartPos.current.x + gestureState.dx)
                );
                const newY = Math.max(
                    -currentHeight + 20,
                    Math.min(vHeight - 20, dragStartPos.current.y + gestureState.dy)
                );
                setBoxPos({ x: newX, y: newY });
            },
            onPanResponderRelease: () => {
                initialPinchDistance.current = null;
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
        if (paths.length === 0 && currentPath.length === 0 && !selectedImage) return;
        setShowClearConfirm(true);
    };

    const hasSignature = paths.length > 0 || currentPath.length > 0 || selectedImage !== null;

    // Resize controls: step-by-step natural zoom from center
    const handleZoomIn = () => {
        const vWidth = viewerLayoutRef.current.width || SCREEN_WIDTH;
        const vHeight = viewerLayoutRef.current.height || 500;
        const curW = boxWidthRef.current;
        const newW = Math.min(vWidth * 0.95, curW + 20);
        const deltaW = newW - curW;
        const deltaH = deltaW / SIGNATURE_ASPECT_RATIO;
        setBoxWidth(newW);
        setBoxPos((prev) => ({
            x: Math.max(-newW + 20, Math.min(vWidth - 20, prev.x - deltaW / 2)),
            y: Math.max(-((newW / SIGNATURE_ASPECT_RATIO)) + 20, Math.min(vHeight - 20, prev.y - deltaH / 2)),
        }));
    };

    const handleZoomOut = () => {
        const vWidth = viewerLayoutRef.current.width || SCREEN_WIDTH;
        const vHeight = viewerLayoutRef.current.height || 500;
        const curW = boxWidthRef.current;
        const newW = Math.max(60, curW - 20);
        const deltaW = newW - curW;
        const deltaH = deltaW / SIGNATURE_ASPECT_RATIO;
        setBoxWidth(newW);
        setBoxPos((prev) => ({
            x: Math.max(-newW + 20, Math.min(vWidth - 20, prev.x - deltaW / 2)),
            y: Math.max(-((newW / SIGNATURE_ASPECT_RATIO)) + 20, Math.min(vHeight - 20, prev.y - deltaH / 2)),
        }));
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

        // Relative coordinates on the rendered page
        const relX = (boxPos.x - offsetX) / renderedW;
        const relY = (boxPos.y - offsetY) / renderedH;
        const relW = boxWidth / renderedW;
        const relH = boxHeight / renderedH;

        // Map to PDF point coordinates (in PDF coordinates, 0 is at bottom)
        const pdfPtX = Math.max(0, Math.min(pdfDimensions.width - 10, relX * pdfDimensions.width));
        const pdfPtW = relW * pdfDimensions.width;
        const pdfPtH = relH * pdfDimensions.height;
        const pdfPtY = Math.max(0, Math.min(pdfDimensions.height - pdfPtH, pdfDimensions.height - (relY * pdfDimensions.height) - pdfPtH));

        let targetPages: number[] = [currentPage - 1];
        if (pageScope === 'multiple') {
            const parsed = parsePageRangeString(customPagesInput, totalPages);
            if (parsed.length > 0) {
                targetPages = parsed.map((p) => p - 1);
            }
        }

        let placement: SignaturePlacement;

        if (selectedImage) {
            const base64 = await RNFS.readFile(selectedImage.path, 'base64');
            placement = {
                pageIndex: currentPage - 1,
                pages: targetPages,
                rotationDeg,
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
                pages: targetPages,
                rotationDeg,
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

    const handleProceedToPlace = () => {
        if (!hasSignature) {
            Alert.alert('Atención', 'Dibuja tu firma o selecciona una imagen antes de continuar.');
            return;
        }
        if (pageScope === 'multiple') {
            const parsed = parsePageRangeString(customPagesInput, totalPages);
            if (parsed.length === 0) {
                Alert.alert(
                    'Páginas requeridas',
                    'Escribe las páginas que deseas firmar (ej: 1-3, 5) o pulsa "Firmar todas las páginas".'
                );
                return;
            }
        }
        setStep('place');
    };

    // ==========================================
    // STEP 1: CREATE SIGNATURE (DRAW OR PICK IMAGE)
    // ==========================================
    if (step === 'create') {
        return (
            <View style={styles.container}>
                <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                    <Text style={[styles.sectionTitle, { color: colors.text }]}>Escribe tu firma con el dedo</Text>

                    {/* Finger Drawing Canvas */}
                    <View
                        ref={canvasViewRef}
                        onLayout={updateCanvasLayout}
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
                            <Svg style={StyleSheet.absoluteFill} pointerEvents="none">
                                {paths.map((p, i) => (
                                    <Path key={i} d={p} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                ))}
                                {currentPath ? (
                                    <Path d={currentPath} stroke={color} strokeWidth={3} fill="none" strokeLinecap="round" strokeLinejoin="round" />
                                ) : null}
                            </Svg>
                        )}

                        {!hasSignature && (
                            <Text style={styles.canvasPlaceholder} pointerEvents="none">Firma aquí con tu dedo</Text>
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

                    {/* Page Scope Selection */}
                    <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 22 }]}>
                        ¿Dónde deseas estampar la firma?
                    </Text>

                    {/* Option 1: Firmar una sola página */}
                    <TouchableOpacity
                        style={[
                            styles.scopeOptionCard,
                            {
                                backgroundColor: colors.surfaceLight,
                                borderColor: pageScope === 'single' ? colors.primary : colors.border,
                                borderWidth: pageScope === 'single' ? 2 : 1,
                            },
                        ]}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setPageScope('single');
                        }}
                        activeOpacity={0.8}
                    >
                        <Icon
                            name={pageScope === 'single' ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={20}
                            color={pageScope === 'single' ? colors.primary : colors.textSecondary}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.scopeOptionTitle, { color: colors.text }]}>Firmar una página</Text>
                            <Text style={[styles.scopeOptionDesc, { color: colors.textSecondary }]}>
                                Elige la página específica donde colocarás la firma
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* Option 2: Firmar en varias páginas */}
                    <TouchableOpacity
                        style={[
                            styles.scopeOptionCard,
                            {
                                backgroundColor: colors.surfaceLight,
                                borderColor: pageScope === 'multiple' ? colors.primary : colors.border,
                                borderWidth: pageScope === 'multiple' ? 2 : 1,
                                marginTop: 10,
                            },
                        ]}
                        onPress={() => {
                            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                            setPageScope('multiple');
                        }}
                        activeOpacity={0.8}
                    >
                        <Icon
                            name={pageScope === 'multiple' ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={20}
                            color={pageScope === 'multiple' ? colors.primary : colors.textSecondary}
                        />
                        <View style={{ flex: 1, marginLeft: 10 }}>
                            <Text style={[styles.scopeOptionTitle, { color: colors.text }]}>Firmar en varias páginas</Text>
                            <Text style={[styles.scopeOptionDesc, { color: colors.textSecondary }]}>
                                Aplica la firma en la misma posición en todas las páginas elegidas
                            </Text>
                        </View>
                    </TouchableOpacity>

                    {/* If multiple, range input and all pages quick button */}
                    {pageScope === 'multiple' && (
                        <View
                            style={[
                                styles.customRangeBox,
                                { backgroundColor: colors.surfaceLight, borderColor: colors.border },
                            ]}
                        >
                            <Text style={[styles.customRangeHint, { color: colors.textSecondary }]}>
                                {"Escribe las páginas separadas por guión (-) para rangos y coma (,) para páginas sueltas.\nEj: 1-3, 5"}
                            </Text>
                            <TextInput
                                style={[
                                    styles.customRangeInput,
                                    {
                                        backgroundColor: colors.backgroundLight,
                                        borderColor: colors.border,
                                        color: colors.text,
                                    },
                                ]}
                                value={customPagesInput}
                                onChangeText={setCustomPagesInput}
                                keyboardType="numbers-and-punctuation"
                                autoCapitalize="none"
                                autoCorrect={false}
                            />
                            <TouchableOpacity
                                style={[
                                    styles.allPagesBtn,
                                    {
                                        backgroundColor: customPagesInput === `1-${totalPages}` ? colors.primary : colors.backgroundLight,
                                        borderColor: customPagesInput === `1-${totalPages}` ? colors.primary : colors.border,
                                    },
                                ]}
                                onPress={() => {
                                    setCustomPagesInput(`1-${totalPages}`);
                                }}
                                activeOpacity={0.8}
                            >
                                <Icon
                                    name="done-all"
                                    size={16}
                                    color={customPagesInput === `1-${totalPages}` ? '#ffffff' : colors.primary}
                                    style={{ marginRight: 6 }}
                                />
                                <Text
                                    style={[
                                        styles.allPagesBtnText,
                                        { color: customPagesInput === `1-${totalPages}` ? '#ffffff' : colors.text },
                                    ]}
                                >
                                    Firmar todas las páginas ({totalPages})
                                </Text>
                            </TouchableOpacity>
                        </View>
                    )}
                </ScrollView>

                {/* Fixed bottom bar for continue button */}
                <View style={[styles.bottomBar, { backgroundColor: colors.surfaceLight, borderTopColor: colors.border }]}>
                    <TouchableOpacity
                        style={[
                            styles.continueBtn,
                            {
                                backgroundColor: hasSignature ? colors.primary : 'rgba(221, 31, 71, 0.4)',
                            },
                        ]}
                        onPress={handleProceedToPlace}
                        disabled={!hasSignature || isProcessing}
                        activeOpacity={0.8}
                    >
                        <Icon name="arrow-forward" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                        <Text style={styles.continueBtnText}>Continuar a colocar firma</Text>
                    </TouchableOpacity>
                </View>

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

                {/* Clear Signature Modal */}
                <ConfirmModal
                    visible={showClearConfirm}
                    title="Borrar firma"
                    message="¿Estás seguro de que deseas borrar la firma?"
                    confirmText="Borrar"
                    cancelText="Cancelar"
                    confirmColor="#ef4444"
                    onConfirm={() => {
                        setPaths([]);
                        setCurrentPath('');
                        setSelectedImage(null);
                        setShowClearConfirm(false);
                    }}
                    onCancel={() => setShowClearConfirm(false)}
                />
            </View>
        );
    }

    // ==========================================
    // STEP 2: INTERACTIVE PDF PLACEMENT
    // ==========================================
    const boxHeight = boxWidth / SIGNATURE_ASPECT_RATIO;
    const multiPagesCount = pageScope === 'multiple' ? parsePageRangeString(customPagesInput, totalPages).length : 1;

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
                    {pageScope === 'multiple' && (
                        <View style={[styles.multiPagesBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.multiPagesBadgeText}>
                                {multiPagesCount} {multiPagesCount === 1 ? 'pág' : 'págs'}
                            </Text>
                        </View>
                    )}
                    <TouchableOpacity
                        disabled={currentPage <= 1}
                        onPress={() => handlePageChange(currentPage - 1)}
                        style={[styles.pageNavBtn, { opacity: currentPage <= 1 ? 0.3 : 1 }]}
                    >
                        <Icon name="chevron-left" size={22} color={colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setPageJumpVisible(true)}
                        activeOpacity={0.7}
                        style={[
                            styles.pageSelectorPill,
                            {
                                backgroundColor: colors.backgroundLight,
                                borderColor: pageJumpVisible ? colors.primary : colors.border,
                            },
                        ]}
                    >
                        <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
                            Pág. <Text style={{ fontWeight: 'bold', color: colors.primary }}>{currentPage}</Text> de {totalPages}
                        </Text>
                        <Icon name="arrow-drop-down" size={16} color={colors.primary} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        disabled={currentPage >= totalPages}
                        onPress={() => handlePageChange(currentPage + 1)}
                        style={[styles.pageNavBtn, { opacity: currentPage >= totalPages ? 0.3 : 1 }]}
                    >
                        <Icon name="chevron-right" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Rotation Slider Bar */}
            <View style={[styles.quickControlsBar, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                <Icon name="rotate-right" size={18} color={colors.primary} style={{ marginRight: 6 }} />
                <Text style={[styles.quickControlsLabel, { color: colors.textSecondary }]}>Giro:</Text>

                <View
                    ref={rotSliderContainerRef}
                    style={styles.quickSliderTouchWrapper}
                    onLayout={() => {
                        rotSliderContainerRef.current?.measure((_x, _y, width, _h, pageX) => {
                            if (width) rotSliderWidthRef.current = width;
                            if (pageX !== undefined) rotSliderPageXRef.current = pageX;
                        });
                    }}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(evt) => {
                        rotSliderContainerRef.current?.measure((_x, _y, width, _h, pageX) => {
                            if (width) rotSliderWidthRef.current = width;
                            if (pageX !== undefined) rotSliderPageXRef.current = pageX;
                            updateRotationTouch(evt.nativeEvent.pageX);
                        });
                    }}
                    onResponderMove={(evt) => {
                        updateRotationTouch(evt.nativeEvent.pageX);
                    }}
                >
                    <View style={[styles.sliderTrack, { backgroundColor: colors.border }]} pointerEvents="none">
                        <View
                            style={[
                                styles.sliderFill,
                                {
                                    width: `${(rotationDeg / 360) * 100}%`,
                                    backgroundColor: colors.primary,
                                },
                            ]}
                        />
                        <View
                            style={[
                                styles.sliderThumb,
                                {
                                    left: `${Math.max(0, Math.min(96, (rotationDeg / 360) * 100 - 3))}%`,
                                    backgroundColor: colors.primary,
                                },
                            ]}
                        />
                    </View>
                </View>

                <Text style={[styles.quickSliderValueText, { color: colors.primary }]}>
                    {rotationDeg}°
                </Text>
            </View>

            {/* Page Jump Balloon for direct page input */}
            <PageJumpBalloon
                visible={pageJumpVisible}
                currentPage={currentPage}
                totalPages={totalPages}
                onPageChange={handlePageChange}
                onClose={() => setPageJumpVisible(false)}
                topOffset={46}
                rightOffset={16}
            />

            {/* Interactive PDF Reader with floating signature box */}
            <View
                style={styles.pdfWrapper}
                onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    viewerLayoutRef.current = { width, height };
                    setViewerLayout({ width, height });
                }}
            >
                <Pdf
                    ref={pdfRef}
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
                            left: boxPos.x,
                            top: boxPos.y,
                            borderColor: colors.primary,
                        },
                    ]}
                    {...dragPanResponder.panHandlers}
                >
                    {/* Render Signature Inside Box with rotation */}
                    <View
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                transform: [{ rotate: `${rotationDeg}deg` }],
                                alignItems: 'center',
                                justifyContent: 'center',
                            },
                        ]}
                        pointerEvents="none"
                    >
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
                    </View>

                    {/* Move indicator */}
                    <View style={styles.moveIndicator} pointerEvents="none">
                        <Icon name="open-with" size={14} color="rgba(221, 31, 71, 0.7)" />
                    </View>
                </View>

                {/* Resizing and rotating controls pill outside draggableBox so touches always fire */}
                <View
                    style={[
                        styles.resizeControlsPill,
                        {
                            left: Math.max(10, Math.min(viewerLayout.width - 105, boxPos.x + boxWidth / 2 - 50)),
                            top: boxPos.y > 44 ? boxPos.y - 36 : boxPos.y + boxHeight + 8,
                        },
                    ]}
                >
                    <TouchableOpacity
                        onPress={handleZoomOut}
                        style={styles.resizeBtn}
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Icon name="remove" size={15} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.resizeDivider} />
                    <TouchableOpacity
                        onPress={handleZoomIn}
                        style={styles.resizeBtn}
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Icon name="add" size={15} color="#ffffff" />
                    </TouchableOpacity>
                    <View style={styles.resizeDivider} />
                    <TouchableOpacity
                        onPress={() => setRotationDeg((prev) => (prev + 90) % 360)}
                        style={styles.resizeBtn}
                        activeOpacity={0.6}
                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                    >
                        <Icon name="rotate-right" size={15} color="#ffffff" />
                    </TouchableOpacity>
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
            <SaveModeModal
                visible={confirmModalVisible}
                onClose={() => setConfirmModalVisible(false)}
                onConfirm={(saveMode) => {
                    setConfirmModalVisible(false);
                    handleConfirmPlacement(saveMode);
                }}
                title="¿Cómo deseas guardar el PDF?"
                description="Selecciona una opción para aplicar tu firma:"
            />
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
        elevation: 4,
    },
    continueBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    scopeOptionCard: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
    },
    scopeOptionTitle: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    scopeOptionDesc: {
        fontSize: 11,
        marginTop: 2,
    },
    customRangeBox: {
        marginTop: 10,
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
    },
    customRangeHint: {
        fontSize: 11,
        lineHeight: 16,
        marginBottom: 8,
    },
    customRangeInput: {
        height: 42,
        borderRadius: 8,
        borderWidth: 1,
        paddingHorizontal: 12,
        fontSize: 14,
        fontWeight: '500',
    },
    allPagesBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 8,
    },
    allPagesBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },
    multiPagesBadge: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 6,
        marginRight: 4,
    },
    multiPagesBadgeText: {
        color: '#ffffff',
        fontSize: 11,
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
    pageSelectorPill: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
        gap: 2,
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
        flexDirection: 'row',
        backgroundColor: '#1e293b',
        borderRadius: 14,
        paddingHorizontal: 6,
        paddingVertical: 3,
        elevation: 8,
        zIndex: 99,
        alignItems: 'center',
    },
    resizeBtn: {
        paddingHorizontal: 5,
        paddingVertical: 3,
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
    confirmButtonsRow: {
        marginTop: 14,
        gap: 8,
    },
    confirmContinueBtn: {
        height: 44,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
    },
    confirmContinueBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    confirmCancelBtn: {
        height: 40,
        borderRadius: 12,
        borderWidth: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    quickControlsBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomWidth: 1,
    },
    quickControlsLabel: {
        fontSize: 12,
        fontWeight: '600',
        marginRight: 6,
    },
    quickSliderTouchWrapper: {
        flex: 1,
        height: 32,
        justifyContent: 'center',
        paddingHorizontal: 4,
    },
    quickSliderValueText: {
        fontSize: 13,
        fontWeight: 'bold',
        marginLeft: 8,
        minWidth: 38,
        textAlign: 'right',
    },
    sliderTrack: {
        height: 6,
        borderRadius: 3,
        width: '100%',
        position: 'relative',
        justifyContent: 'center',
    },
    sliderFill: {
        height: '100%',
        borderRadius: 3,
    },
    sliderThumb: {
        position: 'absolute',
        width: 18,
        height: 18,
        borderRadius: 9,
        top: -6,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
    },
});
