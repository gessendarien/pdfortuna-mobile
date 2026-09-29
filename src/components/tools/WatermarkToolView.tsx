import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    ScrollView,
    Image,
    PanResponder,
    Dimensions,
    ActivityIndicator,
    LayoutAnimation,
    Platform,
    UIManager,
} from 'react-native';
import Pdf from 'react-native-pdf';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { WatermarkOptions, PdfToolsService } from '../../services/PdfToolsService';
import { LocalImage } from '../../services/FileService';
import { ImagePickerModal } from './shared/ImagePickerModal';
import { SaveModeModal } from './shared/SaveModeModal';
import { ConfirmModal } from '../ConfirmModal';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (opts: WatermarkOptions) => Promise<void>;
    isProcessing: boolean;
}

const SCREEN_WIDTH = Dimensions.get('window').width;

// Color palette: pastel to vivid tones, with RGB values for PDF drawing
const COLOR_PALETTE = [
    { hex: '#f87171', r: 0.97, g: 0.44, b: 0.44 }, // Pastel Red
    { hex: '#ef4444', r: 0.93, g: 0.27, b: 0.27 }, // Vivid Red
    { hex: '#fb923c', r: 0.98, g: 0.57, b: 0.24 }, // Pastel Orange
    { hex: '#f97316', r: 0.97, g: 0.45, b: 0.09 }, // Vivid Orange
    { hex: '#facc15', r: 0.98, g: 0.80, b: 0.08 }, // Pastel Yellow
    { hex: '#4ade80', r: 0.29, g: 0.87, b: 0.50 }, // Pastel Green
    { hex: '#10b981', r: 0.06, g: 0.72, b: 0.51 }, // Vivid Emerald
    { hex: '#38bdf8', r: 0.22, g: 0.74, b: 0.97 }, // Pastel Sky
    { hex: '#2563eb', r: 0.15, g: 0.39, b: 0.92 }, // Vivid Blue
    { hex: '#818cf8', r: 0.51, g: 0.55, b: 0.97 }, // Pastel Indigo
    { hex: '#c084fc', r: 0.75, g: 0.52, b: 0.99 }, // Pastel Purple
    { hex: '#f472b6', r: 0.96, g: 0.45, b: 0.71 }, // Pastel Pink
    { hex: '#64748b', r: 0.39, g: 0.45, b: 0.55 }, // Gray
    { hex: '#0f172a', r: 0.06, g: 0.09, b: 0.16, isBlack: true }, // Black with thin border
];

// Helper to parse page range strings like "1-3, 5, 8"
function parsePageRangeString(rangeStr: string, totalPages: number): number[] {
    const parts = rangeStr.split(',').map((p) => p.trim()).filter(Boolean);
    const pagesSet = new Set<number>();
    for (const part of parts) {
        if (part.includes('-')) {
            const [startStr, endStr] = part.split('-').map((s) => s.trim());
            const start = Math.max(1, parseInt(startStr, 10));
            const end = Math.min(totalPages, parseInt(endStr, 10));
            if (!isNaN(start) && !isNaN(end) && start <= end) {
                for (let p = start; p <= end; p++) {
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
}

export const WatermarkToolView: React.FC<Props> = ({
    totalPages,
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();

    // Step state: 1 = Config, 2 = Interactive Preview & Placement
    const [step, setStep] = useState<1 | 2>(1);

    // Config state
    const [watermarkType, setWatermarkType] = useState<'text' | 'image'>('text');
    const [text, setText] = useState('CONFIDENCIAL');
    const [selectedImage, setSelectedImage] = useState<LocalImage | null>(null);
    const [imagePickerVisible, setImagePickerVisible] = useState(false);
    const [layout, setLayout] = useState<'single' | 'repeat'>('single');
    const [opacity, setOpacity] = useState(0.3);
    const [selectedColor, setSelectedColor] = useState(COLOR_PALETTE[1]); // Default Vivid Red

    // Step 2 interactive state
    const [activePage, setActivePage] = useState(1);
    const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
    const [previewContainerSize, setPreviewContainerSize] = useState({ width: SCREEN_WIDTH - 32, height: 420 });

    // Scope: all, even, odd, custom
    const [pageScope, setPageScope] = useState<'all' | 'even' | 'odd' | 'custom'>('all');
    const [customRangeInput, setCustomRangeInput] = useState('');

    // Line spacing for repeat mosaic: 100 (dense), 160 (normal), 240 (spaced)
    const [lineSpacing, setLineSpacing] = useState(160);

    // Single watermark position, dimensions & rotation degrees
    const [boxPos, setBoxPos] = useState({ x: 40, y: 150 });
    const [boxSize, setBoxSize] = useState({ width: 180, height: 60 });
    const [rotationDeg, setRotationDeg] = useState(0);

    // Modals
    const [saveModeModalVisible, setSaveModeModalVisible] = useState(false);
    const [showResetConfirm, setShowResetConfirm] = useState(false);

    // Layout refs with fresh current values
    const dragStartPos = useRef({ x: 40, y: 150 });
    const initialTouchDistance = useRef<number | null>(null);
    const initialBoxSize = useRef({ width: 180, height: 60 });
    const sliderWidthRef = useRef<number>(SCREEN_WIDTH - 64);
    const sliderContainerRef = useRef<View>(null);
    const sliderPageXRef = useRef<number>(0);

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

    const boxPosRef = useRef({ x: 40, y: 150 });
    boxPosRef.current = boxPos;
    const boxSizeRef = useRef({ width: 180, height: 60 });
    boxSizeRef.current = boxSize;
    const rotationDegRef = useRef(0);
    rotationDegRef.current = rotationDeg;
    const previewContainerSizeRef = useRef({ width: SCREEN_WIDTH - 32, height: 420 });
    previewContainerSizeRef.current = previewContainerSize;

    // Load actual PDF dimensions
    useEffect(() => {
        const loadPdfDimensions = async () => {
            try {
                const info = await PdfToolsService.getPdfInfo(sourcePath);
                if (info.pages && info.pages.length > 0) {
                    const first = info.pages[0];
                    if (first.width && first.height) {
                        setPageSize({ width: first.width, height: first.height });
                    }
                }
            } catch (err) {
                console.warn('Could not load PDF page size:', err);
            }
        };
        loadPdfDimensions();
    }, [sourcePath]);

    // Handle switch between text and image
    const handleSwitchType = (newType: 'text' | 'image') => {
        if (newType === 'text') {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setSelectedImage(null);
            setWatermarkType('text');
        } else {
            setImagePickerVisible(true);
        }
    };

    // PanResponder for single watermark dragging & pinch-to-resize
    const panResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderTerminationRequest: () => false,
            onPanResponderGrant: (evt) => {
                dragStartPos.current = { x: boxPosRef.current.x, y: boxPosRef.current.y };
                if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2) {
                    const t1 = evt.nativeEvent.touches[0];
                    const t2 = evt.nativeEvent.touches[1];
                    initialTouchDistance.current = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
                    initialBoxSize.current = { ...boxSizeRef.current };
                } else {
                    initialTouchDistance.current = null;
                }
            },
            onPanResponderMove: (evt, gestureState) => {
                const containerW = previewContainerSizeRef.current.width || (SCREEN_WIDTH - 32);
                const containerH = previewContainerSizeRef.current.height || 420;

                // Two finger pinch to resize
                if (evt.nativeEvent.touches && evt.nativeEvent.touches.length >= 2 && initialTouchDistance.current) {
                    const t1 = evt.nativeEvent.touches[0];
                    const t2 = evt.nativeEvent.touches[1];
                    const currentDist = Math.hypot(t2.pageX - t1.pageX, t2.pageY - t1.pageY);
                    const scaleFactor = currentDist / initialTouchDistance.current;

                    const newW = Math.max(50, Math.min(containerW * 0.95, initialBoxSize.current.width * scaleFactor));
                    const newH = Math.max(25, Math.min(containerH * 0.95, initialBoxSize.current.height * scaleFactor));
                    setBoxSize({ width: newW, height: newH });
                    return;
                }

                // Single finger drag: smooth and never snaps back
                const curW = boxSizeRef.current.width;
                const curH = boxSizeRef.current.height;
                const nextX = Math.max(-curW + 40, Math.min(containerW - 40, dragStartPos.current.x + gestureState.dx));
                const nextY = Math.max(-curH + 40, Math.min(containerH - 40, dragStartPos.current.y + gestureState.dy));
                setBoxPos({ x: nextX, y: nextY });
            },
            onPanResponderRelease: () => {
                initialTouchDistance.current = null;
            },
        })
    ).current;

    // Zoom and rotate handlers for the floating controls pill
    const handleZoomIn = () => {
        const containerW = previewContainerSizeRef.current.width || (SCREEN_WIDTH - 32);
        const containerH = previewContainerSizeRef.current.height || 420;
        const curW = boxSizeRef.current.width;
        const curH = boxSizeRef.current.height;
        const aspect = Math.max(0.2, curW / curH);
        const newW = Math.min(containerW * 0.95, curW + 20);
        const newH = Math.max(25, newW / aspect);
        const deltaW = newW - curW;
        const deltaH = newH - curH;
        setBoxSize({ width: newW, height: newH });
        setBoxPos((prev) => ({
            x: Math.max(-newW + 30, Math.min(containerW - 30, prev.x - deltaW / 2)),
            y: Math.max(-newH + 30, Math.min(containerH - 30, prev.y - deltaH / 2)),
        }));
    };

    const handleZoomOut = () => {
        const containerW = previewContainerSizeRef.current.width || (SCREEN_WIDTH - 32);
        const containerH = previewContainerSizeRef.current.height || 420;
        const curW = boxSizeRef.current.width;
        const curH = boxSizeRef.current.height;
        const aspect = Math.max(0.2, curW / curH);
        const newW = Math.max(50, curW - 20);
        const newH = Math.max(25, newW / aspect);
        const deltaW = newW - curW;
        const deltaH = newH - curH;
        setBoxSize({ width: newW, height: newH });
        setBoxPos((prev) => ({
            x: Math.max(-newW + 30, Math.min(containerW - 30, prev.x - deltaW / 2)),
            y: Math.max(-newH + 30, Math.min(containerH - 30, prev.y - deltaH / 2)),
        }));
    };

    const handleQuickRotate = () => {
        setRotationDeg((prev) => (prev + 45) % 360);
    };

    const handleNextStep = () => {
        if (watermarkType === 'text' && !text.trim()) {
            Alert.alert('Atención', 'Por favor ingresa el texto de la marca de agua.');
            return;
        }
        if (watermarkType === 'image' && !selectedImage) {
            Alert.alert('Atención', 'Por favor selecciona una imagen de la galería.');
            return;
        }

        // Adjust default box dimensions
        if (watermarkType === 'image') {
            setBoxSize({ width: 140, height: 140 });
        } else {
            setBoxSize({ width: 180, height: 60 });
        }
        setStep(2);
    };

    const getTargetPages = (): number[] => {
        const total = totalPages || 1;
        if (pageScope === 'all') {
            return Array.from({ length: total }, (_, i) => i + 1);
        }
        if (pageScope === 'even') {
            return Array.from({ length: total }, (_, i) => i + 1).filter((p) => p % 2 === 0);
        }
        if (pageScope === 'odd') {
            return Array.from({ length: total }, (_, i) => i + 1).filter((p) => p % 2 !== 0);
        }
        if (pageScope === 'custom') {
            const parsed = parsePageRangeString(customRangeInput, total);
            return parsed.length > 0 ? parsed : [activePage];
        }
        return [activePage];
    };

    const handleConfirmSaveMode = (saveMode: 'original' | 'copy') => {
        setSaveModeModalVisible(false);

        // Coordinates in PDF point space
        const scaleX = pageSize.width / previewContainerSize.width;
        const scaleY = pageSize.height / previewContainerSize.height;

        const pdfX = boxPos.x * scaleX;
        const pdfY = (previewContainerSize.height - (boxPos.y + boxSize.height)) * scaleY;
        const pdfW = boxSize.width * scaleX;
        const pdfH = boxSize.height * scaleY;

        const targetPages = getTargetPages();

        const opts: WatermarkOptions = {
            opacity,
            layout,
            color: { r: selectedColor.r, g: selectedColor.g, b: selectedColor.b },
            pageIndex: pageScope === 'all' ? -1 : activePage - 1,
            pages: targetPages,
            x: pdfX,
            y: pdfY,
            width: pdfW,
            height: pdfH,
            rotation: layout === 'repeat' ? 45 : rotationDeg,
            lineSpacing,
            saveMode,
        };

        if (watermarkType === 'text') {
            opts.text = text.trim();
            opts.size = layout === 'repeat' ? 26 : Math.max(16, Math.round(boxSize.height * 0.48));
        } else if (selectedImage) {
            opts.imagePath = selectedImage.path;
        }

        onProcess(opts);
    };

    // Continuous slider component with reliable pageX tracking and quick preset chips
    const renderOpacitySlider = () => {
        const updateOpacityTouch = (pageX: number) => {
            const trackWidth = Math.max(100, sliderWidthRef.current);
            const relativeX = pageX - sliderPageXRef.current;
            const pct = Math.max(0.05, Math.min(1.0, relativeX / trackWidth));
            setOpacity(parseFloat(pct.toFixed(2)));
        };

        return (
            <View style={styles.sliderContainer}>
                <View style={styles.sliderHeader}>
                    <Text style={[styles.sliderLabel, { color: colors.textSecondary }]}>
                        Nivel de opacidad:
                    </Text>
                    <Text style={[styles.sliderValueText, { color: colors.primary }]}>
                        {Math.round(opacity * 100)}%
                    </Text>
                </View>

                <View
                    ref={sliderContainerRef}
                    style={styles.sliderTouchWrapper}
                    onLayout={() => {
                        sliderContainerRef.current?.measure((_x, _y, width, _h, pageX) => {
                            if (width) sliderWidthRef.current = width;
                            if (pageX !== undefined) sliderPageXRef.current = pageX;
                        });
                    }}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={(evt) => {
                        sliderContainerRef.current?.measure((_x, _y, width, _h, pageX) => {
                            if (width) sliderWidthRef.current = width;
                            if (pageX !== undefined) sliderPageXRef.current = pageX;
                            updateOpacityTouch(evt.nativeEvent.pageX);
                        });
                    }}
                    onResponderMove={(evt) => {
                        updateOpacityTouch(evt.nativeEvent.pageX);
                    }}
                >
                    <View style={[styles.sliderTrack, { backgroundColor: colors.border }]} pointerEvents="none">
                        <View style={[styles.sliderFill, { width: `${opacity * 100}%`, backgroundColor: colors.primary }]} />
                        <View
                            style={[
                                styles.sliderThumb,
                                {
                                    left: `${Math.max(0, Math.min(97, opacity * 100 - 3))}%`,
                                    backgroundColor: colors.primary,
                                },
                            ]}
                        />
                    </View>
                </View>
            </View>
        );
    };

    // ==========================================
    // STEP 1: CONFIGURATION
    // ==========================================
    if (step === 1) {
        return (
            <ScrollView style={styles.container} contentContainerStyle={styles.content}>
                {/* Type Selector: Texto vs Imagen */}
                <Text style={[styles.sectionTitle, { color: colors.text }]}>Tipo de marca de agua</Text>
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[
                            styles.typeBtn,
                            {
                                backgroundColor: watermarkType === 'text' ? colors.primary : colors.surfaceLight,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => handleSwitchType('text')}
                        activeOpacity={0.8}
                    >
                        <Icon name="title" size={20} color={watermarkType === 'text' ? '#fff' : colors.text} />
                        <Text style={[styles.typeBtnText, { color: watermarkType === 'text' ? '#fff' : colors.text }]}>
                            Texto
                        </Text>
                    </TouchableOpacity>

                    {/* Image button formatted in 2 rows as requested */}
                    <TouchableOpacity
                        style={[
                            styles.typeBtnTwoRows,
                            {
                                backgroundColor: watermarkType === 'image' ? colors.primary : colors.surfaceLight,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => handleSwitchType('image')}
                        activeOpacity={0.8}
                    >
                        <Icon name="photo-library" size={20} color={watermarkType === 'image' ? '#fff' : colors.text} />
                        <View style={{ alignItems: 'center' }}>
                            <Text style={[styles.typeBtnTextSmall, { color: watermarkType === 'image' ? '#fff' : colors.text }]}>
                                Imagen de
                            </Text>
                            <Text style={[styles.typeBtnTextSmall, { color: watermarkType === 'image' ? '#fff' : colors.text }]}>
                                galería
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Text Input or Image Picker */}
                {watermarkType === 'text' ? (
                    <View style={{ marginTop: 16 }}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Texto de la marca</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.surfaceLight,
                                    borderColor: colors.border,
                                    color: colors.text,
                                },
                            ]}
                            placeholder="Ejemplo: CONFIDENCIAL, COPIA, BORRADOR..."
                            placeholderTextColor={colors.textSecondary}
                            value={text}
                            onChangeText={setText}
                        />

                        {/* Color Selector: Circular dots from pastel to vivid, no text labels */}
                        <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 16 }]}>Paleta de color</Text>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.colorPaletteRow}
                        >
                            {COLOR_PALETTE.map((c) => {
                                const isSelected = selectedColor.hex === c.hex;
                                return (
                                    <TouchableOpacity
                                        key={c.hex}
                                        style={[
                                            styles.colorDot,
                                            {
                                                backgroundColor: c.hex,
                                                borderColor: c.isBlack ? '#94a3b8' : isSelected ? colors.primary : 'transparent',
                                                borderWidth: c.isBlack ? 1.5 : isSelected ? 2.5 : 0,
                                                transform: [{ scale: isSelected ? 1.15 : 1 }],
                                            },
                                        ]}
                                        onPress={() => setSelectedColor(c)}
                                        activeOpacity={0.8}
                                    >
                                        {isSelected && (
                                            <Icon
                                                name="check"
                                                size={15}
                                                color={c.hex === '#facc15' || c.hex === '#86efac' || c.hex === '#fef08a' ? '#0f172a' : '#ffffff'}
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                ) : selectedImage ? (
                    <View style={{ marginTop: 16 }}>
                        <Text style={[styles.sectionTitle, { color: colors.text }]}>Imagen seleccionada</Text>
                        <View style={[styles.imagePreviewBox, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                            <Image source={{ uri: selectedImage.uri }} style={styles.previewThumb} resizeMode="contain" />
                            <View style={{ flex: 1, marginLeft: 12 }}>
                                <Text style={[styles.imageName, { color: colors.text }]} numberOfLines={1}>
                                    {selectedImage.name}
                                </Text>
                                <TouchableOpacity
                                    style={[styles.changeImgBtn, { borderColor: colors.primary }]}
                                    onPress={() => setImagePickerVisible(true)}
                                >
                                    <Text style={{ color: colors.primary, fontSize: 13, fontWeight: 'bold' }}>
                                        Cambiar imagen
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ) : null}

                {/* Layout Selector: Una vez vs Mosaico repetido */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 18 }]}>Disposición</Text>
                <View style={styles.row}>
                    <TouchableOpacity
                        style={[
                            styles.layoutOption,
                            {
                                backgroundColor: colors.surfaceLight,
                                borderColor: layout === 'single' ? colors.primary : colors.border,
                                borderWidth: layout === 'single' ? 2 : 1,
                            },
                        ]}
                        onPress={() => setLayout('single')}
                        activeOpacity={0.8}
                    >
                        <Icon
                            name={layout === 'single' ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={20}
                            color={layout === 'single' ? colors.primary : colors.textSecondary}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={[styles.layoutTitle, { color: colors.text }]}>Una vez</Text>
                            <Text style={[styles.layoutDesc, { color: colors.textSecondary }]}>
                                Sello único con rotación libre y escala
                            </Text>
                        </View>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[
                            styles.layoutOption,
                            {
                                backgroundColor: colors.surfaceLight,
                                borderColor: layout === 'repeat' ? colors.primary : colors.border,
                                borderWidth: layout === 'repeat' ? 2 : 1,
                            },
                        ]}
                        onPress={() => setLayout('repeat')}
                        activeOpacity={0.8}
                    >
                        <Icon
                            name={layout === 'repeat' ? 'radio-button-checked' : 'radio-button-unchecked'}
                            size={20}
                            color={layout === 'repeat' ? colors.primary : colors.textSecondary}
                        />
                        <View style={{ flex: 1, marginLeft: 8 }}>
                            <Text style={[styles.layoutTitle, { color: colors.text }]}>Mosaico continuo</Text>
                            <Text style={[styles.layoutDesc, { color: colors.textSecondary }]}>
                                Cuadrícula continua inclinada cubriendo la hoja
                            </Text>
                        </View>
                    </TouchableOpacity>
                </View>

                {/* Opacity Slider */}
                <Text style={[styles.sectionTitle, { color: colors.text, marginTop: 18 }]}>Opacidad predeterminada</Text>
                {renderOpacitySlider()}

                {/* Next button */}
                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 24 }]}
                    onPress={handleNextStep}
                    activeOpacity={0.85}
                >
                    <Icon name="arrow-forward" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                    <Text style={styles.actionBtnText}>Continuar a vista previa</Text>
                </TouchableOpacity>

                <ImagePickerModal
                    visible={imagePickerVisible}
                    onClose={() => {
                        setImagePickerVisible(false);
                        if (!selectedImage) {
                            setWatermarkType('text');
                        }
                    }}
                    onSelectImage={(img) => {
                        setSelectedImage(img);
                        setWatermarkType('image');
                        setImagePickerVisible(false);
                    }}
                    title="Elegir imagen de marca de agua"
                />
            </ScrollView>
        );
    }

    // ==========================================
    // STEP 2: INTERACTIVE PREVIEW & PLACEMENT
    // ==========================================
    const pdfUri = sourcePath.startsWith('file://') ? sourcePath : `file://${sourcePath}`;

    return (
        <View style={styles.step2Container}>
            {/* Top Bar with back, page navigation and scope */}
            <View style={[styles.step2TopBar, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                <TouchableOpacity
                    style={styles.backBtn}
                    onPress={() => setStep(1)}
                    activeOpacity={0.7}
                >
                    <Icon name="arrow-back" size={20} color={colors.text} />
                    <Text style={[styles.backBtnText, { color: colors.text }]}>Ajustes</Text>
                </TouchableOpacity>

                {/* Page Nav */}
                <View style={styles.pageSelectorPill}>
                    <TouchableOpacity
                        onPress={() => setActivePage((p) => Math.max(1, p - 1))}
                        disabled={activePage <= 1}
                        style={{ opacity: activePage <= 1 ? 0.3 : 1 }}
                    >
                        <Icon name="chevron-left" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.pageIndicator, { color: colors.text }]}>
                        {activePage} / {totalPages}
                    </Text>
                    <TouchableOpacity
                        onPress={() => setActivePage((p) => Math.min(totalPages, p + 1))}
                        disabled={activePage >= totalPages}
                        style={{ opacity: activePage >= totalPages ? 0.3 : 1 }}
                    >
                        <Icon name="chevron-right" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Scope Chips: all, even, odd, custom (NO 'Aplicar a:' label) */}
            <View style={[styles.scopeBar, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.scopeChipsContainer}>
                    {([
                        { mode: 'all', label: 'Todas las páginas' },
                        { mode: 'even', label: 'Solo pares' },
                        { mode: 'odd', label: 'Solo impares' },
                        { mode: 'custom', label: 'Elegir páginas' },
                    ] as const).map(({ mode, label }) => {
                        const isSelected = pageScope === mode;
                        return (
                            <TouchableOpacity
                                key={mode}
                                style={[
                                    styles.scopeChip,
                                    {
                                        backgroundColor: isSelected ? colors.primary : colors.backgroundLight,
                                        borderColor: isSelected ? colors.primary : colors.border,
                                    },
                                ]}
                                onPress={() => {
                                    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                    setPageScope(mode);
                                }}
                                activeOpacity={0.7}
                            >
                                <Text style={[styles.scopeChipText, { color: isSelected ? '#ffffff' : colors.text }]}>
                                    {label}
                                </Text>
                            </TouchableOpacity>
                        );
                    })}
                </ScrollView>
            </View>

            {/* If 'custom', animated input dropdown with guide */}
            {pageScope === 'custom' && (
                <View style={[styles.customRangeContainer, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
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
                        value={customRangeInput}
                        onChangeText={setCustomRangeInput}
                        keyboardType="numbers-and-punctuation"
                        autoCapitalize="none"
                        autoCorrect={false}
                    />
                </View>
            )}

            {/* If Single: Rotation slider. If Repeat: Line Spacing frequency buttons */}
            {layout === 'single' ? (
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
            ) : (
                <View style={[styles.quickControlsBar, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                    <Icon name="format-line-spacing" size={16} color={colors.primary} style={{ marginRight: 6 }} />
                    <Text style={[styles.quickControlsLabel, { color: colors.textSecondary }]}>Frecuencia:</Text>
                    <View style={styles.quickAngleRow}>
                        {[
                            { label: 'Densa', val: 100 },
                            { label: 'Normal', val: 160 },
                            { label: 'Espaciada', val: 240 },
                        ].map((item) => (
                            <TouchableOpacity
                                key={item.val}
                                style={[
                                    styles.angleChip,
                                    {
                                        backgroundColor: lineSpacing === item.val ? colors.primary : colors.backgroundLight,
                                        borderColor: lineSpacing === item.val ? colors.primary : colors.border,
                                    },
                                ]}
                                onPress={() => setLineSpacing(item.val)}
                            >
                                <Text style={[styles.angleChipText, { color: lineSpacing === item.val ? '#fff' : colors.text }]}>
                                    {item.label}
                                </Text>
                            </TouchableOpacity>
                        ))}
                    </View>
                </View>
            )}

            {/* PDF View Container */}
            <View
                style={styles.previewCanvas}
                onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    setPreviewContainerSize({ width, height });
                }}
            >
                <Pdf
                    source={{ uri: pdfUri, cache: true }}
                    page={activePage}
                    singlePage={true}
                    scale={1.0}
                    fitPolicy={2}
                    spacing={0}
                    style={styles.pdfBackground}
                />

                {/* Overlays */}
                {layout === 'repeat' ? (
                    /* Continuous mosaic watermark overlay without word cuts */
                    <View style={styles.mosaicOverlay} pointerEvents="none">
                        {Array.from({ length: Math.round(500 / (lineSpacing / 2.5)) }).map((_, i) => (
                            <View key={i} style={[styles.mosaicLine, { marginVertical: lineSpacing / 14 }]}>
                                {watermarkType === 'text' ? (
                                    <Text
                                        numberOfLines={1}
                                        style={[
                                            styles.mosaicTextContinuous,
                                            {
                                                opacity,
                                                color: selectedColor.hex,
                                            },
                                        ]}
                                    >
                                        {Array(10).fill(text.trim()).join('   ')}
                                    </Text>
                                ) : selectedImage ? (
                                    <View style={styles.mosaicImageRow}>
                                        {Array.from({ length: 4 }).map((__, j) => (
                                            <Image
                                                key={j}
                                                source={{ uri: selectedImage.uri }}
                                                style={[styles.mosaicImage, { opacity }]}
                                                resizeMode="contain"
                                            />
                                        ))}
                                    </View>
                                ) : null}
                            </View>
                        ))}
                    </View>
                ) : (
                    /* Single movable & pinch-resizable watermark box */
                    <>
                        <View
                            style={[
                                styles.singleWatermarkBox,
                                {
                                    left: boxPos.x,
                                    top: boxPos.y,
                                    width: boxSize.width,
                                    height: boxSize.height,
                                    borderColor: colors.primary,
                                    transform: [{ rotate: `${rotationDeg}deg` }],
                                },
                            ]}
                            {...panResponder.panHandlers}
                        >
                            {watermarkType === 'text' ? (
                                <Text
                                    style={[
                                        styles.singleWatermarkText,
                                        {
                                            opacity,
                                            fontSize: Math.max(14, Math.round(boxSize.height * 0.45)),
                                            color: selectedColor.hex,
                                        },
                                    ]}
                                    numberOfLines={2}
                                >
                                    {text}
                                </Text>
                            ) : selectedImage ? (
                                <Image
                                    source={{ uri: selectedImage.uri }}
                                    style={[styles.singleWatermarkImage, { opacity }]}
                                    resizeMode="contain"
                                />
                            ) : null}

                            {/* Move icon indicator */}
                            <View style={styles.boxBadge} pointerEvents="none">
                                <Icon name="open-with" size={12} color="#ffffff" />
                            </View>
                        </View>

                        {/* Floating controls pill with - / + zoom and quick rotate */}
                        <View
                            style={[
                                styles.resizeControlsPill,
                                {
                                    left: Math.max(10, Math.min(previewContainerSize.width - 130, boxPos.x + boxSize.width / 2 - 55)),
                                    top: boxPos.y > 44 ? boxPos.y - 38 : boxPos.y + boxSize.height + 8,
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
                                onPress={handleQuickRotate}
                                style={[styles.resizeBtn, { flexDirection: 'row', alignItems: 'center' }]}
                                activeOpacity={0.6}
                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                            >
                                <Icon name="rotate-right" size={15} color="#ffffff" />
                                <Text style={{ color: '#fff', fontSize: 10, fontWeight: 'bold', marginLeft: 2 }}>{rotationDeg}°</Text>
                            </TouchableOpacity>
                        </View>
                    </>
                )}
            </View>

            {/* Bottom Controls: Opacity Slider & Apply Button */}
            <View style={[styles.bottomControlCard, { backgroundColor: colors.surfaceLight, borderTopColor: colors.border }]}>
                {renderOpacitySlider()}

                <TouchableOpacity
                    style={[styles.actionBtn, { backgroundColor: colors.primary, marginTop: 10 }]}
                    onPress={() => setSaveModeModalVisible(true)}
                    disabled={isProcessing}
                    activeOpacity={0.85}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <Icon name="check" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.actionBtnText}>Aplicar marca de agua</Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* SaveModeModal */}
            <SaveModeModal
                visible={saveModeModalVisible}
                onClose={() => setSaveModeModalVisible(false)}
                onConfirm={handleConfirmSaveMode}
                title="¿Cómo deseas guardar la marca de agua?"
                description="Selecciona una opción para aplicar los cambios al documento:"
            />

            {/* ConfirmModal for reset */}
            <ConfirmModal
                visible={showResetConfirm}
                title="Restablecer documento"
                message="¿Estás seguro de que deseas restablecer el documento editado a su forma original?"
                confirmText="Restablecer"
                cancelText="Cancelar"
                confirmColor="#ef4444"
                onConfirm={() => {
                    setText('CONFIDENCIAL');
                    setSelectedImage(null);
                    setRotationDeg(0);
                    setOpacity(0.3);
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
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    sectionTitle: {
        fontSize: 13,
        fontWeight: '700',
        marginBottom: 8,
    },
    row: {
        flexDirection: 'row',
        gap: 10,
    },
    typeBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    typeBtnTwoRows: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 8,
        borderRadius: 12,
        borderWidth: 1,
        gap: 8,
    },
    typeBtnText: {
        fontSize: 14,
        fontWeight: '600',
    },
    typeBtnTextSmall: {
        fontSize: 12,
        fontWeight: '600',
        lineHeight: 15,
    },
    input: {
        height: 48,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 14,
        fontSize: 14,
    },
    colorPaletteRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
        paddingVertical: 6,
        paddingHorizontal: 2,
    },
    colorDot: {
        width: 34,
        height: 34,
        borderRadius: 17,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.15,
        shadowRadius: 2,
    },
    imagePreviewBox: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 14,
        borderWidth: 1,
    },
    previewThumb: {
        width: 60,
        height: 60,
        borderRadius: 8,
    },
    imageName: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    changeImgBtn: {
        alignSelf: 'flex-start',
        borderWidth: 1,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    selectImgCard: {
        padding: 24,
        borderRadius: 14,
        borderWidth: 1.5,
        borderStyle: 'dashed',
        alignItems: 'center',
        justifyContent: 'center',
    },
    selectImgTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginTop: 10,
    },
    selectImgSub: {
        fontSize: 12,
        marginTop: 4,
        textAlign: 'center',
    },
    layoutOption: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
    },
    layoutTitle: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    layoutDesc: {
        fontSize: 11,
        marginTop: 2,
        lineHeight: 14,
    },
    sliderContainer: {
        marginTop: 4,
    },
    sliderHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    sliderLabel: {
        fontSize: 12,
    },
    sliderValueText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    sliderTouchWrapper: {
        height: 38,
        justifyContent: 'center',
    },
    sliderTrack: {
        height: 8,
        borderRadius: 4,
        overflow: 'visible',
        position: 'relative',
        justifyContent: 'center',
    },
    sliderFill: {
        height: 8,
        borderRadius: 4,
    },
    sliderThumb: {
        position: 'absolute',
        width: 20,
        height: 20,
        borderRadius: 10,
        top: -6,
        elevation: 3,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.25,
        shadowRadius: 2,
    },
    actionBtn: {
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 14,
        fontWeight: 'bold',
    },
    step2Container: {
        flex: 1,
    },
    step2TopBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    backBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 6,
    },
    backBtnText: {
        fontSize: 13,
        fontWeight: '600',
        marginLeft: 4,
    },
    pageSelectorPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    pageIndicator: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    scopeBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderBottomWidth: 1,
        gap: 8,
    },
    scopeLabel: {
        fontSize: 12,
        fontWeight: '600',
    },
    scopeChipsContainer: {
        flexDirection: 'row',
        gap: 6,
        paddingVertical: 2,
    },
    scopeChip: {
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 12,
        borderWidth: 1,
    },
    scopeChipText: {
        fontSize: 11,
        fontWeight: 'bold',
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
    quickAngleRow: {
        flexDirection: 'row',
        gap: 6,
    },
    angleChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 10,
        borderWidth: 1,
    },
    angleChipText: {
        fontSize: 11,
        fontWeight: '600',
    },
    previewCanvas: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#1e293b',
        overflow: 'hidden',
    },
    pdfBackground: {
        flex: 1,
        width: '100%',
        backgroundColor: 'transparent',
    },
    mosaicOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'space-evenly',
        alignItems: 'center',
        transform: [{ rotate: '-30deg' }, { scale: 1.3 }],
    },
    mosaicLine: {
        width: '180%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    mosaicTextContinuous: {
        fontSize: 18,
        fontWeight: '900',
        letterSpacing: 2,
    },
    mosaicImageRow: {
        flexDirection: 'row',
        gap: 40,
        justifyContent: 'center',
    },
    mosaicImage: {
        width: 50,
        height: 50,
    },
    singleWatermarkBox: {
        position: 'absolute',
        borderWidth: 1.5,
        borderStyle: 'dashed',
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 4,
    },
    singleWatermarkText: {
        fontWeight: '900',
        textAlign: 'center',
    },
    singleWatermarkImage: {
        width: '100%',
        height: '100%',
    },
    boxBadge: {
        position: 'absolute',
        top: -10,
        left: -10,
        width: 22,
        height: 22,
        borderRadius: 11,
        backgroundColor: '#dd1f47',
        justifyContent: 'center',
        alignItems: 'center',
    },
    rotationHandle: {
        position: 'absolute',
        top: -12,
        right: -12,
        width: 26,
        height: 26,
        borderRadius: 13,
        backgroundColor: '#3b82f6',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.3,
        shadowRadius: 3,
    },
    bottomControlCard: {
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
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
        paddingHorizontal: 6,
        paddingVertical: 3,
    },
    resizeDivider: {
        width: 1,
        height: 12,
        backgroundColor: '#64748b',
        marginHorizontal: 3,
    },
    customRangeContainer: {
        paddingHorizontal: 16,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    customRangeHint: {
        fontSize: 11,
        marginBottom: 6,
    },
    customRangeInput: {
        height: 38,
        borderWidth: 1,
        borderRadius: 8,
        paddingHorizontal: 10,
        fontSize: 13,
    },
    quickOpacityRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 6,
    },
    quickOpacityChip: {
        paddingHorizontal: 8,
        paddingVertical: 3,
        borderRadius: 8,
        borderWidth: 1,
    },
    quickOpacityText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
});
