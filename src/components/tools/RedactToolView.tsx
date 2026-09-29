import React, { useState, useRef, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Dimensions,
    ActivityIndicator,
    ScrollView,
    LayoutAnimation,
} from 'react-native';
import Pdf from 'react-native-pdf';
import Svg, { Path, Rect, G } from 'react-native-svg';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { RedactionBox, PdfToolsService } from '../../services/PdfToolsService';
import { SaveModeModal } from './shared/SaveModeModal';
import { ConfirmModal } from '../ConfirmModal';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (boxes: RedactionBox[], saveMode?: 'original' | 'copy') => Promise<void>;
    isProcessing: boolean;
}

interface Point {
    x: number;
    y: number;
}

interface MosaicTile {
    x: number;
    y: number;
    size: number;
    fill: string;
}

interface Stroke {
    id: string;
    page: number; // 1-indexed
    strokeWidth: number;
    points: Point[];
    isBlur: boolean;
    color: string;
    mosaicTiles?: MosaicTile[];
}

const SCREEN_WIDTH = Dimensions.get('window').width;

const SOLID_COLORS = [
    { hex: '#0f172a', r: 0.06, g: 0.09, b: 0.16, label: 'Negro', isBlack: true },
    { hex: '#ffffff', r: 1.0, g: 1.0, b: 1.0, label: 'Blanco', border: '#cbd5e1' },
    { hex: '#ef4444', r: 0.93, g: 0.27, b: 0.27, label: 'Rojo' },
    { hex: '#eab308', r: 0.92, g: 0.70, b: 0.03, label: 'Amarillo' },
    { hex: '#22c55e', r: 0.13, g: 0.77, b: 0.37, label: 'Verde' },
    { hex: '#3b82f6', r: 0.23, g: 0.51, b: 0.96, label: 'Azul' },
    { hex: '#64748b', r: 0.39, g: 0.45, b: 0.55, label: 'Gris' },
    { hex: '#f97316', r: 0.98, g: 0.45, b: 0.09, label: 'Naranja' },
];

const samplePoints = (pts: Point[], minGap: number): Point[] => {
    if (pts.length <= 1) return pts;
    const res: Point[] = [pts[0]];
    let last = pts[0];
    for (let i = 1; i < pts.length; i++) {
        if (Math.hypot(pts[i].x - last.x, pts[i].y - last.y) >= minGap) {
            res.push(pts[i]);
            last = pts[i];
        }
    }
    return res;
};

const BLUR_PALETTE = [
    '#94a3b8', // slate-400
    '#cbd5e1', // slate-300
    '#e2e8f0', // slate-200
    '#64748b', // slate-500
    '#f1f5f9', // slate-100
    '#475569', // slate-600
    '#d1d5db', // gray-300
    '#9ca3af', // gray-400
    '#e5e7eb', // gray-200
];

const getMosaicRects = (points: Point[], strokeWidth: number): MosaicTile[] => {
    if (points.length === 0) return [];
    const tileSize = Math.max(4, Math.min(10, Math.round(strokeWidth / 2.2)));
    const radius = strokeWidth / 2;
    const tiles: MosaicTile[] = [];
    const visited = new Set<string>();

    const sampled = samplePoints(points, tileSize * 0.5);

    for (let i = 0; i < sampled.length; i++) {
        const pt = sampled[i];
        const minX = Math.floor((pt.x - radius) / tileSize) * tileSize;
        const maxX = Math.ceil((pt.x + radius) / tileSize) * tileSize;
        const minY = Math.floor((pt.y - radius) / tileSize) * tileSize;
        const maxY = Math.ceil((pt.y + radius) / tileSize) * tileSize;

        for (let tx = minX; tx <= maxX; tx += tileSize) {
            for (let ty = minY; ty <= maxY; ty += tileSize) {
                const cx = tx + tileSize / 2;
                const cy = ty + tileSize / 2;
                if (Math.hypot(cx - pt.x, cy - pt.y) <= radius + 0.5) {
                    const key = `${tx}_${ty}`;
                    if (!visited.has(key)) {
                        visited.add(key);
                        const seed = (Math.abs(Math.sin(tx * 12.9898 + ty * 78.233)) * 43758.5453);
                        const colorIdx = Math.floor(seed) % BLUR_PALETTE.length;
                        tiles.push({
                            x: tx,
                            y: ty,
                            size: tileSize,
                            fill: BLUR_PALETTE[colorIdx],
                        });
                    }
                }
            }
        }
    }
    return tiles;
};

export const RedactToolView: React.FC<Props> = ({
    totalPages,
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors, isDarkMode } = useTheme();

    const [activePage, setActivePage] = useState(1);

    // Default mode is 'solid' as requested
    const [brushMode, setBrushMode] = useState<'solid' | 'blur'>('solid');
    const [brushSize, setBrushSize] = useState<number>(14); // 6 (fino), 14 (medio), 28 (grueso)
    const [selectedColor, setSelectedColor] = useState(SOLID_COLORS[0]);

    const [strokes, setStrokes] = useState<Stroke[]>([]);
    const [currentStroke, setCurrentStroke] = useState<Point[]>([]);

    // Zoom & pan states
    const [zoomScale, setZoomScale] = useState<number>(1.0);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
    const [containerSize, setContainerSize] = useState<{ width: number; height: number }>({
        width: SCREEN_WIDTH - 24,
        height: 480,
    });

    // Modals
    const [saveModeModalVisible, setSaveModeModalVisible] = useState(false);
    const [showClearConfirm, setShowClearConfirm] = useState(false);

    const isDrawingRef = useRef(false);
    const containerLayoutRef = useRef<{ pageX: number; pageY: number }>({ pageX: 0, pageY: 0 });
    const containerRef = useRef<View>(null);

    const touchGestureRef = useRef<{
        isPinching: boolean;
        initialDist: number;
        initialScale: number;
        initialPan: { x: number; y: number };
        initialMid: { x: number; y: number };
    }>({
        isPinching: false,
        initialDist: 0,
        initialScale: 1.0,
        initialPan: { x: 0, y: 0 },
        initialMid: { x: 0, y: 0 },
    });

    // Fetch PDF actual page size
    useEffect(() => {
        const loadInfo = async () => {
            try {
                const info = await PdfToolsService.getPdfInfo(sourcePath);
                if (info.pages && info.pages.length > 0) {
                    const first = info.pages[0];
                    if (first.width && first.height) {
                        setPageSize({ width: first.width, height: first.height });
                    }
                }
            } catch (e) {
                console.warn('Could not read PDF dimensions for redact:', e);
            }
        };
        loadInfo();
    }, [sourcePath]);

    const measureContainer = () => {
        if (containerRef.current) {
            containerRef.current.measure((_x, _y, _width, _height, pageX, pageY) => {
                containerLayoutRef.current = { pageX, pageY };
            });
        }
    };

    // Calculate document-space coordinate from absolute screen touch
    const getDocPoint = (pageX: number, pageY: number) => {
        const cx = containerSize.width / 2;
        const cy = containerSize.height / 2;
        const screenRelX = pageX - containerLayoutRef.current.pageX;
        const screenRelY = pageY - containerLayoutRef.current.pageY;

        // Inverse coordinate transform:
        // screenRelX = cx + panOffset.x + (docX - cx) * zoomScale
        // docX = (screenRelX - cx - panOffset.x) / zoomScale + cx
        const docX = (screenRelX - cx - panOffset.x) / zoomScale + cx;
        const docY = (screenRelY - cy - panOffset.y) / zoomScale + cy;

        return {
            x: Math.max(0, Math.min(containerSize.width, docX)),
            y: Math.max(0, Math.min(containerSize.height, docY)),
        };
    };

    const handleTouchStart = (evt: any) => {
        measureContainer();
        const touches = evt.nativeEvent.touches;

        if (touches && touches.length >= 2) {
            // Two-finger pinch & pan start
            touchGestureRef.current.isPinching = true;
            isDrawingRef.current = false;
            setCurrentStroke([]);

            const t0 = touches[0];
            const t1 = touches[1];
            const dist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
            const midX = (t0.pageX + t1.pageX) / 2;
            const midY = (t0.pageY + t1.pageY) / 2;

            touchGestureRef.current.initialDist = Math.max(10, dist);
            touchGestureRef.current.initialScale = zoomScale;
            touchGestureRef.current.initialPan = { ...panOffset };
            touchGestureRef.current.initialMid = { x: midX, y: midY };
            return;
        }

        if (touchGestureRef.current.isPinching) {
            return;
        }

        // Single finger: paint censorship stroke
        const pageX = touches && touches.length > 0 ? touches[0].pageX : evt.nativeEvent.pageX;
        const pageY = touches && touches.length > 0 ? touches[0].pageY : evt.nativeEvent.pageY;

        const pt = getDocPoint(pageX, pageY);
        isDrawingRef.current = true;
        setCurrentStroke([pt]);
    };

    const handleTouchMove = (evt: any) => {
        const touches = evt.nativeEvent.touches;

        if (touches && touches.length >= 2) {
            // Two-finger pinch & pan in progress
            touchGestureRef.current.isPinching = true;
            if (isDrawingRef.current) {
                isDrawingRef.current = false;
                setCurrentStroke([]);
            }

            const t0 = touches[0];
            const t1 = touches[1];
            const dist = Math.hypot(t0.pageX - t1.pageX, t0.pageY - t1.pageY);
            const midX = (t0.pageX + t1.pageX) / 2;
            const midY = (t0.pageY + t1.pageY) / 2;

            if (touchGestureRef.current.initialDist === 0) {
                touchGestureRef.current.initialDist = Math.max(10, dist);
                touchGestureRef.current.initialScale = zoomScale;
                touchGestureRef.current.initialPan = { ...panOffset };
                touchGestureRef.current.initialMid = { x: midX, y: midY };
                return;
            }

            const factor = dist / touchGestureRef.current.initialDist;
            const targetScale = Math.min(3.5, Math.max(1.0, touchGestureRef.current.initialScale * factor));

            const dX = midX - touchGestureRef.current.initialMid.x;
            const dY = midY - touchGestureRef.current.initialMid.y;

            const maxPanX = (targetScale - 1) * (containerSize.width / 2);
            const maxPanY = (targetScale - 1) * (containerSize.height / 2);

            let targetPanX = touchGestureRef.current.initialPan.x + dX;
            let targetPanY = touchGestureRef.current.initialPan.y + dY;

            if (targetScale <= 1.05) {
                targetPanX = 0;
                targetPanY = 0;
            } else {
                targetPanX = Math.max(-maxPanX, Math.min(maxPanX, targetPanX));
                targetPanY = Math.max(-maxPanY, Math.min(maxPanY, targetPanY));
            }

            setZoomScale(targetScale);
            setPanOffset({ x: targetPanX, y: targetPanY });
            return;
        }

        if (touchGestureRef.current.isPinching) {
            return;
        }

        if (!isDrawingRef.current) return;

        const pageX = touches && touches.length > 0 ? touches[0].pageX : evt.nativeEvent.pageX;
        const pageY = touches && touches.length > 0 ? touches[0].pageY : evt.nativeEvent.pageY;

        const pt = getDocPoint(pageX, pageY);
        setCurrentStroke((prev) => [...prev, pt]);
    };

    const handleTouchEnd = (evt: any) => {
        const touches = evt.nativeEvent.touches;

        if (!touches || touches.length === 0) {
            if (touchGestureRef.current.isPinching) {
                touchGestureRef.current.isPinching = false;
                touchGestureRef.current.initialDist = 0;
                return;
            }

            if (!isDrawingRef.current) return;
            isDrawingRef.current = false;

            if (currentStroke.length > 0) {
                const isBlur = brushMode === 'blur';
                const newStroke: Stroke = {
                    id: `${Date.now()}_${Math.random()}`,
                    page: activePage,
                    strokeWidth: brushSize,
                    points: currentStroke,
                    isBlur,
                    color: selectedColor.hex,
                    mosaicTiles: isBlur ? getMosaicRects(currentStroke, brushSize) : undefined,
                };
                setStrokes((prev) => [...prev, newStroke]);
                setCurrentStroke([]);
            }
        }
    };

    const handleZoomIn = () => {
        setZoomScale((prev) => Math.min(3.5, Number((prev + 0.5).toFixed(1))));
    };

    const handleZoomOut = () => {
        setZoomScale((prev) => {
            const next = Math.max(1.0, Number((prev - 0.5).toFixed(1)));
            if (next <= 1.05) {
                setPanOffset({ x: 0, y: 0 });
                return 1.0;
            }
            setPanOffset((p) => {
                const maxPanX = (next - 1) * (containerSize.width / 2);
                const maxPanY = (next - 1) * (containerSize.height / 2);
                return {
                    x: Math.max(-maxPanX, Math.min(maxPanX, p.x)),
                    y: Math.max(-maxPanY, Math.min(maxPanY, p.y)),
                };
            });
            return next;
        });
    };

    const handleResetZoom = () => {
        setZoomScale(1.0);
        setPanOffset({ x: 0, y: 0 });
    };

    const handlePageChange = (newPage: number) => {
        setActivePage(newPage);
        handleResetZoom();
    };

    const handleUndo = () => {
        setStrokes((prev) => {
            const pageStrokes = prev.filter((s) => s.page === activePage);
            if (pageStrokes.length === 0) return prev;
            const lastPageStrokeId = pageStrokes[pageStrokes.length - 1].id;
            return prev.filter((s) => s.id !== lastPageStrokeId);
        });
    };

    const handleResetAll = () => {
        if (strokes.length === 0) return;
        setShowClearConfirm(true);
    };

    // Convert array of points to SVG path string
    const pointsToSvgPath = (points: Point[]): string => {
        if (points.length === 0) return '';
        if (points.length === 1) {
            return `M ${points[0].x} ${points[0].y} L ${points[0].x + 0.1} ${points[0].y + 0.1}`;
        }
        let d = `M ${points[0].x} ${points[0].y}`;
        for (let i = 1; i < points.length; i++) {
            d += ` L ${points[i].x} ${points[i].y}`;
        }
        return d;
    };

    // Trigger save mode choice modal
    const handlePressApply = () => {
        if (strokes.length === 0) {
            Alert.alert('Atención', 'No has marcado ninguna zona para censurar con el pincel.');
            return;
        }
        setSaveModeModalVisible(true);
    };

    const handleConfirmSaveMode = (saveMode: 'original' | 'copy') => {
        setSaveModeModalVisible(false);

        const scaleX = pageSize.width / containerSize.width;
        const scaleY = pageSize.height / containerSize.height;

        const allBoxes: RedactionBox[] = [];

        for (const stroke of strokes) {
            const pageIndex = stroke.page - 1;
            const r = stroke.strokeWidth / 2;
            const stepDist = Math.max(2, stroke.strokeWidth * 0.35);

            let lastSampled: Point | null = null;

            const colorObj = stroke.isBlur
                ? undefined
                : {
                      r: SOLID_COLORS.find((c) => c.hex === stroke.color)?.r ?? 0,
                      g: SOLID_COLORS.find((c) => c.hex === stroke.color)?.g ?? 0,
                      b: SOLID_COLORS.find((c) => c.hex === stroke.color)?.b ?? 0,
                  };

            for (const pt of stroke.points) {
                if (!lastSampled || Math.hypot(pt.x - lastSampled.x, pt.y - lastSampled.y) >= stepDist) {
                    lastSampled = pt;

                    // Screen box
                    const screenLeft = Math.max(0, pt.x - r);
                    const screenTop = Math.max(0, pt.y - r);
                    const screenW = stroke.strokeWidth;
                    const screenH = stroke.strokeWidth;

                    // PDF coordinates (origin at bottom-left)
                    const pdfX = screenLeft * scaleX;
                    const pdfY = (containerSize.height - (screenTop + screenH)) * scaleY;
                    const pdfW = screenW * scaleX;
                    const pdfH = screenH * scaleY;

                    allBoxes.push({
                        pageIndex,
                        x: pdfX,
                        y: pdfY,
                        width: pdfW,
                        height: pdfH,
                        isBlur: stroke.isBlur,
                        color: colorObj,
                    });
                }
            }
        }

        onProcess(allBoxes, saveMode);
    };

    const activeStrokes = strokes.filter((s) => s.page === activePage);
    const pdfUri = sourcePath.startsWith('file://') ? sourcePath : `file://${sourcePath}`;

    return (
        <View style={styles.container}>
            {/* Top Toolbar: Page Navigation */}
            <View style={[styles.topBar, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                <View style={styles.pageSelector}>
                    <TouchableOpacity
                        onPress={() => handlePageChange(Math.max(1, activePage - 1))}
                        disabled={activePage <= 1}
                        style={[styles.navBtn, activePage <= 1 && styles.btnDisabled]}
                    >
                        <Icon name="chevron-left" size={22} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.pageText, { color: colors.text }]}>
                        Pág. <Text style={{ fontWeight: 'bold' }}>{activePage}</Text> de {totalPages}
                    </Text>
                    <TouchableOpacity
                        onPress={() => handlePageChange(Math.min(totalPages, activePage + 1))}
                        disabled={activePage >= totalPages}
                        style={[styles.navBtn, activePage >= totalPages && styles.btnDisabled]}
                    >
                        <Icon name="chevron-right" size={22} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Undo / Reset Actions */}
                <View style={styles.actionIcons}>
                    <TouchableOpacity
                        style={[styles.iconBtn, activeStrokes.length === 0 && styles.btnDisabled]}
                        onPress={handleUndo}
                        disabled={activeStrokes.length === 0}
                    >
                        <Icon name="undo" size={20} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.iconBtn, strokes.length === 0 && styles.btnDisabled]}
                        onPress={handleResetAll}
                        disabled={strokes.length === 0}
                    >
                        <Icon name="delete-sweep" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Horizontal Toolbar */}
            <View style={[styles.horizontalToolbar, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                <View style={styles.toolsRow}>
                    {/* Mode Toggle: Sólido vs Difuso (Sólido first) */}
                    <View style={[styles.modeToggleGroup, { backgroundColor: colors.backgroundLight, borderColor: colors.border }]}>
                        <TouchableOpacity
                            style={[
                                styles.modeSegmentBtn,
                                brushMode === 'solid' && { backgroundColor: colors.primary },
                            ]}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setBrushMode('solid');
                            }}
                            activeOpacity={0.7}
                        >
                            <Icon
                                name="brush"
                                size={16}
                                color={brushMode === 'solid' ? '#ffffff' : colors.textSecondary}
                                style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.modeSegmentText, { color: brushMode === 'solid' ? '#ffffff' : colors.text }]}>
                                Sólido
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.modeSegmentBtn,
                                brushMode === 'blur' && { backgroundColor: '#3b82f6' },
                            ]}
                            onPress={() => {
                                LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
                                setBrushMode('blur');
                            }}
                            activeOpacity={0.7}
                        >
                            <Icon
                                name="blur-on"
                                size={16}
                                color={brushMode === 'blur' ? '#ffffff' : colors.textSecondary}
                                style={{ marginRight: 4 }}
                            />
                            <Text style={[styles.modeSegmentText, { color: brushMode === 'blur' ? '#ffffff' : colors.text }]}>
                                Difuso
                            </Text>
                        </TouchableOpacity>
                    </View>

                    {/* Thickness Dots: chiquito, mediano, grande */}
                    <View style={styles.thicknessGroup}>
                        {[
                            { size: 6, dotSize: 4, label: 'Fino' },
                            { size: 14, dotSize: 9, label: 'Medio' },
                            { size: 28, dotSize: 16, label: 'Grueso' },
                        ].map((item) => {
                            const isSelected = brushSize === item.size;
                            return (
                                <TouchableOpacity
                                    key={item.size}
                                    style={[
                                        styles.thicknessCircleBtn,
                                        {
                                            backgroundColor: isSelected
                                                ? brushMode === 'blur'
                                                    ? '#3b82f6'
                                                    : colors.primary
                                                : colors.backgroundLight,
                                            borderColor: isSelected
                                                ? brushMode === 'blur'
                                                    ? '#3b82f6'
                                                    : colors.primary
                                                : colors.border,
                                        },
                                    ]}
                                    onPress={() => setBrushSize(item.size)}
                                    activeOpacity={0.7}
                                    accessibilityLabel={item.label}
                                >
                                    <View
                                        style={{
                                            width: item.dotSize,
                                            height: item.dotSize,
                                            borderRadius: item.dotSize / 2,
                                            backgroundColor: isSelected ? '#ffffff' : colors.text,
                                        }}
                                    />
                                </TouchableOpacity>
                            );
                        })}
                    </View>
                </View>

                {/* Color Palette (only shown in Solid mode) */}
                {brushMode === 'solid' && (
                    <View style={styles.colorPaletteWrapper}>
                        <ScrollView
                            horizontal
                            showsHorizontalScrollIndicator={false}
                            contentContainerStyle={styles.colorPaletteScroll}
                        >
                            {SOLID_COLORS.map((c) => {
                                const isSelected = selectedColor.hex === c.hex;
                                const isBlack = (c as any).isBlack;
                                const borderColor = isBlack
                                    ? isSelected
                                        ? colors.primary
                                        : '#94a3b8'
                                    : c.border || (isSelected ? colors.primary : 'rgba(0,0,0,0.15)');
                                const borderWidth = isBlack
                                    ? isSelected
                                        ? 2.5
                                        : 1.5
                                    : c.border
                                    ? 1.5
                                    : isSelected
                                    ? 2.5
                                    : 1;

                                return (
                                    <TouchableOpacity
                                        key={c.hex}
                                        style={[
                                            styles.colorDot,
                                            {
                                                backgroundColor: c.hex,
                                                borderColor,
                                                borderWidth,
                                                transform: [{ scale: isSelected ? 1.15 : 1.0 }],
                                            },
                                        ]}
                                        onPress={() => setSelectedColor(c)}
                                        activeOpacity={0.8}
                                    >
                                        {isSelected && (
                                            <Icon
                                                name="check"
                                                size={14}
                                                color={c.hex === '#ffffff' || c.hex === '#eab308' ? '#0f172a' : '#ffffff'}
                                            />
                                        )}
                                    </TouchableOpacity>
                                );
                            })}
                        </ScrollView>
                    </View>
                )}
            </View>

            {/* PDF Canvas Area */}
            <View
                ref={containerRef}
                style={styles.canvasContainer}
                onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    setContainerSize({ width, height });
                    measureContainer();
                }}
            >
                {/* Scaled & Panned Document Content */}
                <View
                    style={[
                        styles.zoomContentWrapper,
                        {
                            transform: [
                                { translateX: panOffset.x },
                                { translateY: panOffset.y },
                                { scale: zoomScale },
                            ],
                        },
                    ]}
                >
                    {/* PDF Single Page View */}
                    <Pdf
                        source={{ uri: pdfUri, cache: true }}
                        page={activePage}
                        singlePage={true}
                        scale={1.0}
                        fitPolicy={2}
                        spacing={0}
                        style={styles.pdfBackground}
                    />

                    {/* Svg strokes layer */}
                    <Svg style={StyleSheet.absoluteFillObject} pointerEvents="none">
                        {/* Completed strokes on active page */}
                        {activeStrokes.map((s) => {
                            if (s.isBlur) {
                                return (
                                    <G key={s.id}>
                                        {/* Layer 1: Solid opaque slate base that completely hides text */}
                                        <Path
                                            d={pointsToSvgPath(s.points)}
                                            stroke="#94a3b8"
                                            strokeWidth={s.strokeWidth}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            fill="none"
                                            opacity={1.0}
                                        />
                                        {/* Layer 2: Opaque pixelated blur mosaic tiles */}
                                        {s.mosaicTiles && s.mosaicTiles.map((tile, tIdx) => (
                                            <Rect
                                                key={tIdx}
                                                x={tile.x}
                                                y={tile.y}
                                                width={tile.size}
                                                height={tile.size}
                                                fill={tile.fill}
                                                stroke="rgba(255, 255, 255, 0.45)"
                                                strokeWidth={0.4}
                                            />
                                        ))}
                                        {/* Layer 3: Soft feathered core highlight */}
                                        <Path
                                            d={pointsToSvgPath(s.points)}
                                            stroke="rgba(255, 255, 255, 0.35)"
                                            strokeWidth={s.strokeWidth * 0.35}
                                            strokeLinecap="round"
                                            strokeLinejoin="round"
                                            fill="none"
                                        />
                                    </G>
                                );
                            }
                            return (
                                <Path
                                    key={s.id}
                                    d={pointsToSvgPath(s.points)}
                                    stroke={s.color}
                                    strokeWidth={s.strokeWidth}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                    opacity={1.0}
                                />
                            );
                        })}

                        {/* Current in-progress stroke: multi-pass opaque textured blur for instant 60 FPS drawing */}
                        {currentStroke.length > 0 && brushMode === 'blur' && (
                            <G opacity={1.0}>
                                <Path
                                    d={pointsToSvgPath(currentStroke)}
                                    stroke="#94a3b8"
                                    strokeWidth={brushSize}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    fill="none"
                                    opacity={1.0}
                                />
                                <Path
                                    d={pointsToSvgPath(currentStroke)}
                                    stroke="#cbd5e1"
                                    strokeWidth={brushSize * 0.75}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray="4, 4"
                                    fill="none"
                                />
                                <Path
                                    d={pointsToSvgPath(currentStroke)}
                                    stroke="#f1f5f9"
                                    strokeWidth={brushSize * 0.4}
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray="2, 3"
                                    fill="none"
                                />
                            </G>
                        )}

                        {currentStroke.length > 0 && brushMode === 'solid' && (
                            <Path
                                d={pointsToSvgPath(currentStroke)}
                                stroke={selectedColor.hex}
                                strokeWidth={brushSize}
                                strokeLinecap="round"
                                strokeLinejoin="round"
                                fill="none"
                                opacity={1.0}
                            />
                        )}
                    </Svg>
                </View>

                {/* Interactive Paint & Gesture Overlay (covers full canvasContainer) */}
                <View
                    style={styles.paintOverlay}
                    onStartShouldSetResponder={() => true}
                    onMoveShouldSetResponder={() => true}
                    onResponderGrant={handleTouchStart}
                    onResponderMove={handleTouchMove}
                    onResponderRelease={handleTouchEnd}
                    onResponderTerminate={handleTouchEnd}
                    onResponderTerminationRequest={() => false}
                />

                {/* Floating Zoom Controls Card */}
                <View
                    style={[
                        styles.floatingZoomCard,
                        {
                            backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.94)' : 'rgba(255, 255, 255, 0.94)',
                            borderColor: colors.border,
                        },
                    ]}
                >
                    <TouchableOpacity
                        style={[styles.floatingZoomBtn, zoomScale <= 1.05 && styles.floatingZoomBtnDisabled]}
                        onPress={handleZoomOut}
                        disabled={zoomScale <= 1.05}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                        <Icon name="remove" size={18} color={zoomScale <= 1.05 ? colors.border : colors.text} />
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={styles.floatingZoomValueBtn}
                        onPress={handleResetZoom}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.floatingZoomText, { color: zoomScale > 1.05 ? colors.primary : colors.textSecondary }]}>
                            {Math.round(zoomScale * 100)}%
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        style={[styles.floatingZoomBtn, zoomScale >= 3.45 && styles.floatingZoomBtnDisabled]}
                        onPress={handleZoomIn}
                        disabled={zoomScale >= 3.45}
                        hitSlop={{ top: 6, bottom: 6, left: 6, right: 6 }}
                    >
                        <Icon name="add" size={18} color={zoomScale >= 3.45 ? colors.border : colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Bottom Bar: Apply Redaction */}
            <View style={[styles.bottomBar, { backgroundColor: colors.surfaceLight, borderTopColor: colors.border }]}>
                <TouchableOpacity
                    style={[
                        styles.applyBtn,
                        {
                            backgroundColor: strokes.length > 0 ? '#ef4444' : 'rgba(239, 68, 68, 0.4)',
                        },
                    ]}
                    onPress={handlePressApply}
                    disabled={strokes.length === 0 || isProcessing}
                    activeOpacity={0.85}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <Icon name="visibility-off" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.applyBtnText}>
                                {strokes.length === 0
                                    ? 'Censurar documento'
                                    : `Aplicar censura (${strokes.length} ${strokes.length === 1 ? 'trazo' : 'trazos'})`}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* SaveModeModal */}
            <SaveModeModal
                visible={saveModeModalVisible}
                onClose={() => setSaveModeModalVisible(false)}
                onConfirm={handleConfirmSaveMode}
                title="¿Cómo deseas guardar la censura?"
                description="La información censurada se ocultará de forma irreversible:"
            />

            {/* ConfirmModal for document reset */}
            <ConfirmModal
                visible={showClearConfirm}
                title="Restablecer documento"
                message="¿Estás seguro de que deseas restablecer el documento editado a su forma original?"
                confirmText="Restablecer"
                cancelText="Cancelar"
                confirmColor="#ef4444"
                onConfirm={() => {
                    setStrokes([]);
                    setShowClearConfirm(false);
                }}
                onCancel={() => setShowClearConfirm(false)}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    topBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    pageSelector: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    navBtn: {
        padding: 4,
        borderRadius: 6,
    },
    btnDisabled: {
        opacity: 0.3,
    },
    pageText: {
        fontSize: 13,
    },
    modeIndicatorBadge: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 12,
        backgroundColor: 'rgba(0, 0, 0, 0.05)',
    },
    modeIndicatorText: {
        fontSize: 11,
        fontWeight: 'bold',
    },
    actionIcons: {
        flexDirection: 'row',
        gap: 4,
    },
    iconBtn: {
        padding: 6,
        borderRadius: 8,
    },
    horizontalToolbar: {
        borderBottomWidth: 1,
        paddingHorizontal: 12,
        paddingVertical: 8,
    },
    toolsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        gap: 8,
    },
    modeToggleGroup: {
        flexDirection: 'row',
        borderRadius: 10,
        borderWidth: 1,
        padding: 2,
    },
    modeSegmentBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 5,
        borderRadius: 8,
    },
    modeSegmentText: {
        fontSize: 12,
        fontWeight: '700',
    },
    thicknessGroup: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    thicknessCircleBtn: {
        width: 34,
        height: 34,
        borderRadius: 17,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    colorPaletteWrapper: {
        marginTop: 8,
        paddingTop: 6,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(150, 150, 150, 0.2)',
    },
    colorPaletteScroll: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        paddingVertical: 2,
    },
    colorDot: {
        width: 28,
        height: 28,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.18,
        shadowRadius: 2,
    },
    canvasContainer: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#cbd5e1',
        overflow: 'hidden',
    },
    zoomContentWrapper: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    pdfBackground: {
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
    },
    paintOverlay: {
        ...StyleSheet.absoluteFillObject,
    },
    floatingZoomCard: {
        position: 'absolute',
        bottom: 12,
        right: 12,
        flexDirection: 'row',
        alignItems: 'center',
        borderRadius: 22,
        borderWidth: 1,
        paddingHorizontal: 4,
        paddingVertical: 3,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 4,
        zIndex: 20,
    },
    floatingZoomBtn: {
        width: 30,
        height: 30,
        borderRadius: 15,
        justifyContent: 'center',
        alignItems: 'center',
    },
    floatingZoomBtnDisabled: {
        opacity: 0.35,
    },
    floatingZoomValueBtn: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    floatingZoomText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    bottomBar: {
        padding: 14,
        borderTopWidth: 1,
    },
    applyBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 14,
        borderRadius: 14,
    },
    applyBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
});
