import React, { useState, useRef, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    Alert,
    Dimensions,
    ActivityIndicator,
    Image,
    PanResponder,
} from 'react-native';
import Pdf from 'react-native-pdf';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { DocumentEditItem, PdfToolsService } from '../../services/PdfToolsService';
import { LocalImage } from '../../services/FileService';
import { ImagePickerModal } from './shared/ImagePickerModal';
import { ConfirmModal } from '../ConfirmModal';
import { SaveModeModal } from './shared/SaveModeModal';

interface Props {
    totalPages: number;
    sourcePath: string;
    onProcess: (edits: DocumentEditItem[], saveMode?: 'original' | 'copy') => Promise<void>;
    isProcessing: boolean;
}

interface CanvasItem {
    id: string;
    type: 'text' | 'image';
    page: number; // 1-indexed
    x: number;
    y: number;
    width: number;
    height: number;
    text?: string;
    fontSize?: number;
    colorKey?: 'black' | 'blue' | 'red' | 'green';
    hasBackground?: boolean; // defaults to true: covers text underneath like Word / Sejda
    imageUri?: string;
    imagePath?: string;
}

const COLOR_MAP: Record<string, { r: number; g: number; b: number; hex: string; label: string }> = {
    black: { r: 0.1, g: 0.1, b: 0.1, hex: '#111827', label: 'Negro' },
    blue: { r: 0.15, g: 0.45, b: 0.85, hex: '#2563eb', label: 'Azul' },
    red: { r: 0.86, g: 0.12, b: 0.27, hex: '#dd1f47', label: 'Rojo' },
    green: { r: 0.1, g: 0.65, b: 0.35, hex: '#16a34a', label: 'Verde' },
};

export const EditAnnotationsView: React.FC<Props> = ({
    totalPages,
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();

    const [activePage, setActivePage] = useState<number>(1);
    const [items, setItems] = useState<CanvasItem[]>([]);
    const [selectedId, setSelectedId] = useState<string | null>(null);
    const [showResetConfirm, setShowResetConfirm] = useState(false);
    const [showSaveModal, setShowSaveModal] = useState(false);

    // Zoom and pan state
    const [zoomScale, setZoomScale] = useState<number>(1.0);
    const [panOffset, setPanOffset] = useState<{ x: number; y: number }>({ x: 0, y: 0 });

    // Document & canvas dimensions
    const [pageSize, setPageSize] = useState<{ width: number; height: number }>({ width: 595, height: 842 });
    const [containerLayout, setContainerLayout] = useState<{ width: number; height: number }>({
        width: Dimensions.get('window').width - 16,
        height: 480,
    });

    // Image picker state
    const [imagePickerVisible, setImagePickerVisible] = useState(false);

    // Touch and drag refs
    const dragItemStartRef = useRef<{ id: string; x: number; y: number } | null>(null);
    const pinchStartRef = useRef<{
        distance: number;
        startScale: number;
        startX: number;
        startY: number;
        startPan: { x: number; y: number };
    } | null>(null);

    // Fetch PDF dimensions
    useEffect(() => {
        const loadDimensions = async () => {
            try {
                const info = await PdfToolsService.getPdfInfo(sourcePath);
                if (info.pages && info.pages.length > 0) {
                    const first = info.pages[0];
                    if (first.width && first.height) {
                        setPageSize({ width: first.width, height: first.height });
                    }
                }
            } catch (err) {
                console.warn('Could not read PDF dimensions for editor:', err);
            }
        };
        loadDimensions();
    }, [sourcePath]);

    // Exact page render dimensions to eliminate letterboxing and coordinate drift
    const { pageRenderW, pageRenderH } = useMemo(() => {
        const cw = Math.max(containerLayout.width, 100);
        const ch = Math.max(containerLayout.height, 100);
        const pdfAspect = pageSize.width / pageSize.height;

        let w = cw;
        let h = w / pdfAspect;

        if (h > ch) {
            h = ch;
            w = h * pdfAspect;
        }

        return { pageRenderW: Math.round(w), pageRenderH: Math.round(h) };
    }, [containerLayout, pageSize]);

    // Add direct text item (Sejda / Word style)
    const handleAddText = () => {
        const defaultW = Math.min(180, Math.round(pageRenderW * 0.55));
        const defaultH = 38;
        const newItem: CanvasItem = {
            id: `text_${Date.now()}`,
            type: 'text',
            page: activePage,
            x: Math.max(10, Math.round((pageRenderW - defaultW) / 2)),
            y: Math.max(20, Math.round((pageRenderH - defaultH) / 3)),
            width: defaultW,
            height: defaultH,
            text: '',
            fontSize: 14,
            colorKey: 'black',
            hasBackground: true, // White background enabled by default to cover original text
        };
        setItems((prev) => [...prev, newItem]);
        setSelectedId(newItem.id);
    };

    // Add Image from picker
    const handleSelectImage = (img: LocalImage) => {
        const defaultSize = Math.min(120, Math.round(pageRenderW * 0.4));
        const newItem: CanvasItem = {
            id: `image_${Date.now()}`,
            type: 'image',
            page: activePage,
            x: Math.max(10, Math.round((pageRenderW - defaultSize) / 2)),
            y: Math.max(20, Math.round((pageRenderH - defaultSize) / 3)),
            width: defaultSize,
            height: defaultSize,
            imageUri: img.uri,
            imagePath: img.path,
        };
        setItems((prev) => [...prev, newItem]);
        setSelectedId(newItem.id);
        setImagePickerVisible(false);
    };

    // Reset confirmation
    const handleConfirmReset = () => {
        if (items.length === 0) return;
        setShowResetConfirm(true);
    };

    // Update text content
    const handleUpdateText = (id: string, text: string) => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, text } : it)));
    };

    // Delete item
    const handleDeleteItem = (id: string) => {
        setItems((prev) => prev.filter((it) => it.id !== id));
        if (selectedId === id) setSelectedId(null);
    };

    // Change font size
    const handleChangeFontSize = (id: string, delta: number) => {
        setItems((prev) =>
            prev.map((it) => {
                if (it.id !== id) return it;
                const curSize = it.fontSize || 14;
                const newSize = Math.max(8, Math.min(42, curSize + delta));
                const newH = Math.max(it.height, Math.round(newSize * 1.8));
                return { ...it, fontSize: newSize, height: newH };
            })
        );
    };

    // Toggle white background (cover text underneath)
    const handleToggleBackground = (id: string) => {
        setItems((prev) =>
            prev.map((it) =>
                it.id === id ? { ...it, hasBackground: it.hasBackground === false ? true : false } : it
            )
        );
    };

    // Change text color
    const handleChangeColor = (id: string, colorKey: 'black' | 'blue' | 'red' | 'green') => {
        setItems((prev) => prev.map((it) => (it.id === id ? { ...it, colorKey } : it)));
    };

    // Resize item
    const handleResizeItem = (id: string, deltaW: number, deltaH?: number) => {
        setItems((prev) =>
            prev.map((it) => {
                if (it.id !== id) return it;
                const newW = Math.max(40, Math.min(pageRenderW - it.x, it.width + deltaW));
                const newH =
                    deltaH !== undefined
                        ? Math.max(24, Math.min(pageRenderH - it.y, it.height + deltaH))
                        : it.height;
                return { ...it, width: newW, height: newH };
            })
        );
    };

    // PanResponder for dragging canvas items (using drag handle)
    const createItemDragResponder = (item: CanvasItem) => {
        return PanResponder.create({
            onStartShouldSetPanResponder: () => true,
            onMoveShouldSetPanResponder: () => true,
            onPanResponderGrant: () => {
                setSelectedId(item.id);
                dragItemStartRef.current = { id: item.id, x: item.x, y: item.y };
            },
            onPanResponderMove: (_evt, gesture) => {
                if (dragItemStartRef.current && dragItemStartRef.current.id === item.id) {
                    const dx = gesture.dx / zoomScale;
                    const dy = gesture.dy / zoomScale;
                    const nextX = Math.max(0, Math.min(pageRenderW - item.width, dragItemStartRef.current.x + dx));
                    const nextY = Math.max(0, Math.min(pageRenderH - item.height, dragItemStartRef.current.y + dy));
                    setItems((prev) =>
                        prev.map((it) => (it.id === item.id ? { ...it, x: nextX, y: nextY } : it))
                    );
                }
            },
            onPanResponderRelease: () => {
                dragItemStartRef.current = null;
            },
        });
    };

    // Canvas background pinch-to-zoom and pan responder
    const canvasPanResponder = useRef(
        PanResponder.create({
            onStartShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length >= 2,
            onMoveShouldSetPanResponder: (evt) => evt.nativeEvent.touches.length >= 2 || zoomScale > 1.05,
            onPanResponderGrant: (evt) => {
                const touches = evt.nativeEvent.touches;
                if (touches.length >= 2) {
                    const dist = Math.hypot(
                        touches[0].pageX - touches[1].pageX,
                        touches[0].pageY - touches[1].pageY
                    );
                    pinchStartRef.current = {
                        distance: dist,
                        startScale: zoomScale,
                        startX: (touches[0].pageX + touches[1].pageX) / 2,
                        startY: (touches[0].pageY + touches[1].pageY) / 2,
                        startPan: { ...panOffset },
                    };
                } else if (touches.length === 1 && zoomScale > 1.05) {
                    pinchStartRef.current = {
                        distance: 0,
                        startScale: zoomScale,
                        startX: touches[0].pageX,
                        startY: touches[0].pageY,
                        startPan: { ...panOffset },
                    };
                }
            },
            onPanResponderMove: (evt) => {
                const touches = evt.nativeEvent.touches;
                if (touches.length >= 2 && pinchStartRef.current && pinchStartRef.current.distance > 0) {
                    const curDist = Math.hypot(
                        touches[0].pageX - touches[1].pageX,
                        touches[0].pageY - touches[1].pageY
                    );
                    const scaleFactor = curDist / pinchStartRef.current.distance;
                    const nextScale = Math.min(3.5, Math.max(1.0, pinchStartRef.current.startScale * scaleFactor));
                    setZoomScale(nextScale);
                } else if (touches.length === 1 && pinchStartRef.current && zoomScale > 1.05) {
                    const dx = touches[0].pageX - pinchStartRef.current.startX;
                    const dy = touches[0].pageY - pinchStartRef.current.startY;
                    const maxPanX = (pageRenderW * (zoomScale - 1)) / 2;
                    const maxPanY = (pageRenderH * (zoomScale - 1)) / 2;
                    setPanOffset({
                        x: Math.max(-maxPanX, Math.min(maxPanX, pinchStartRef.current.startPan.x + dx)),
                        y: Math.max(-maxPanY, Math.min(maxPanY, pinchStartRef.current.startPan.y + dy)),
                    });
                }
            },
            onPanResponderRelease: () => {
                pinchStartRef.current = null;
            },
        })
    ).current;

    // Zoom button helpers
    const handleZoomIn = () => {
        setZoomScale((z) => Math.min(3.5, Math.round((z + 0.25) * 100) / 100));
    };

    const handleZoomOut = () => {
        setZoomScale((z) => {
            const next = Math.max(1.0, Math.round((z - 0.25) * 100) / 100);
            if (next === 1.0) setPanOffset({ x: 0, y: 0 });
            return next;
        });
    };

    const handleResetZoom = () => {
        setZoomScale(1.0);
        setPanOffset({ x: 0, y: 0 });
    };

    // Save all edits to PDF
    const handleSaveDocument = () => {
        if (items.length === 0) {
            Alert.alert('Atención', 'No has agregado textos ni imágenes al documento.');
            return;
        }
        setShowSaveModal(true);
    };

    const handleConfirmSave = (saveMode: 'original' | 'copy') => {
        setShowSaveModal(false);

        const scaleX = pageSize.width / pageRenderW;
        const scaleY = pageSize.height / pageRenderH;

        const edits: DocumentEditItem[] = items.map((it) => {
            const pageIndex = it.page - 1;
            const pdfX = it.x * scaleX;
            // In PDF coordinates, (0,0) is bottom-left
            const pdfY = (pageRenderH - (it.y + it.height)) * scaleY;
            const pdfW = it.width * scaleX;
            const pdfH = it.height * scaleY;

            const editItem: DocumentEditItem = {
                id: it.id,
                type: it.type,
                pageIndex,
                x: pdfX,
                y: pdfY,
                width: pdfW,
                height: pdfH,
            };

            if (it.type === 'text') {
                editItem.text = it.text || '';
                editItem.fontSize = Math.max(8, Math.round((it.fontSize || 14) * scaleY));
                const c = COLOR_MAP[it.colorKey || 'black'];
                editItem.textColor = { r: c.r, g: c.g, b: c.b };
                editItem.hasBackground = it.hasBackground !== false;
            } else if (it.type === 'image') {
                editItem.imagePath = it.imagePath;
            }

            return editItem;
        });

        onProcess(edits, saveMode);
    };

    const activeItems = items.filter((it) => it.page === activePage);
    const selectedItem = items.find((it) => it.id === selectedId);
    const pdfUri = sourcePath.startsWith('file://') ? sourcePath : `file://${sourcePath}`;

    return (
        <View style={styles.container}>
            {/* Top Toolbar: Insertion Tools & Restablecer */}
            <View style={[styles.topBar, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
                <View style={styles.topToolsLeft}>
                    {/* Add Direct Text Button */}
                    <TouchableOpacity
                        style={[styles.toolBtn, { backgroundColor: colors.backgroundLight, borderColor: colors.border }]}
                        onPress={handleAddText}
                        activeOpacity={0.75}
                    >
                        <Icon name="text-fields" size={17} color={colors.primary} />
                        <Text style={[styles.toolBtnText, { color: colors.text }]}>Texto</Text>
                    </TouchableOpacity>

                    {/* Add Image Button */}
                    <TouchableOpacity
                        style={[styles.toolBtn, { backgroundColor: colors.backgroundLight, borderColor: colors.border }]}
                        onPress={() => setImagePickerVisible(true)}
                        activeOpacity={0.75}
                    >
                        <Icon name="add-photo-alternate" size={17} color={colors.primary} />
                        <Text style={[styles.toolBtnText, { color: colors.text }]}>Imagen</Text>
                    </TouchableOpacity>
                </View>

                {/* Restablecer Button with Confirmation Alert */}
                <TouchableOpacity
                    style={[
                        styles.resetBtn,
                        {
                            borderColor: items.length > 0 ? colors.border : 'transparent',
                            opacity: items.length > 0 ? 1 : 0.4,
                        },
                    ]}
                    onPress={handleConfirmReset}
                    disabled={items.length === 0}
                    activeOpacity={0.7}
                >
                    <Icon name="restore" size={17} color={items.length > 0 ? colors.primary : colors.textSecondary} />
                    <Text
                        style={[
                            styles.resetBtnText,
                            { color: items.length > 0 ? colors.text : colors.textSecondary },
                        ]}
                    >
                        Restablecer
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Canvas Area with Pinch-to-Zoom */}
            <View
                style={styles.canvasContainer}
                onLayout={(e) => {
                    const { width, height } = e.nativeEvent.layout;
                    setContainerLayout({ width, height });
                }}
                {...canvasPanResponder.panHandlers}
            >
                {/* Scaled & Centered Page Container */}
                <View
                    style={[
                        styles.pageWrapper,
                        {
                            width: pageRenderW,
                            height: pageRenderH,
                            transform: [
                                { scale: zoomScale },
                                { translateX: panOffset.x },
                                { translateY: panOffset.y },
                            ],
                        },
                    ]}
                >
                    {/* Native PDF View */}
                    <Pdf
                        source={{ uri: pdfUri, cache: true }}
                        page={activePage}
                        singlePage={true}
                        scale={1.0}
                        fitPolicy={2}
                        spacing={0}
                        style={{ width: pageRenderW, height: pageRenderH }}
                    />

                    {/* Edit Items Layer */}
                    <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
                        {activeItems.map((item) => {
                            const isSelected = selectedId === item.id;
                            const dragResponder = createItemDragResponder(item);

                            return (
                                <View
                                    key={item.id}
                                    style={[
                                        styles.itemBox,
                                        {
                                            left: item.x,
                                            top: item.y,
                                            width: item.width,
                                            height: item.height,
                                            backgroundColor:
                                                item.type === 'text' && item.hasBackground !== false
                                                    ? '#ffffff'
                                                    : 'transparent',
                                            borderColor: isSelected
                                                ? colors.primary
                                                : item.type === 'text' && item.hasBackground !== false
                                                ? 'rgba(0,0,0,0.12)'
                                                : 'transparent',
                                            borderWidth: isSelected ? 1.5 : item.hasBackground !== false ? 1 : 0,
                                        },
                                    ]}
                                >
                                    {/* Direct Editable Text Component (Word / Sejda style) */}
                                    {item.type === 'text' && (
                                        <View style={styles.textInnerContainer}>
                                            {/* Drag handle header (visible when selected) */}
                                            {isSelected && (
                                                <View style={styles.itemHeaderBar}>
                                                    <View
                                                        style={styles.dragGrip}
                                                        {...dragResponder.panHandlers}
                                                    >
                                                        <Icon name="drag-indicator" size={16} color="#ffffff" />
                                                        <Text style={styles.dragLabel}>Mover</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={styles.deleteGrip}
                                                        onPress={() => handleDeleteItem(item.id)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Icon name="close" size={13} color="#ffffff" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}

                                            {/* Direct Inline TextInput */}
                                            <TextInput
                                                value={item.text}
                                                onChangeText={(val) => handleUpdateText(item.id, val)}
                                                onFocus={() => setSelectedId(item.id)}
                                                multiline
                                                placeholder="Escribe texto..."
                                                placeholderTextColor="#94a3b8"
                                                style={[
                                                    styles.directInput,
                                                    {
                                                        fontSize: item.fontSize || 14,
                                                        color: COLOR_MAP[item.colorKey || 'black'].hex,
                                                        minHeight: Math.max(26, (item.fontSize || 14) * 1.5),
                                                    },
                                                ]}
                                            />

                                            {/* Width resize handle on the right */}
                                            {isSelected && (
                                                <View style={styles.widthResizeBar}>
                                                    <TouchableOpacity
                                                        onPress={() => handleResizeItem(item.id, -20)}
                                                        style={styles.resizeSmallBtn}
                                                    >
                                                        <Icon name="chevron-left" size={12} color="#ffffff" />
                                                    </TouchableOpacity>
                                                    <TouchableOpacity
                                                        onPress={() => handleResizeItem(item.id, 20)}
                                                        style={styles.resizeSmallBtn}
                                                    >
                                                        <Icon name="chevron-right" size={12} color="#ffffff" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    )}

                                    {/* Image Component */}
                                    {item.type === 'image' && item.imageUri && (
                                        <View style={styles.imageInnerContainer}>
                                            {isSelected && (
                                                <View style={styles.itemHeaderBar}>
                                                    <View
                                                        style={styles.dragGrip}
                                                        {...dragResponder.panHandlers}
                                                    >
                                                        <Icon name="drag-indicator" size={16} color="#ffffff" />
                                                        <Text style={styles.dragLabel}>Mover</Text>
                                                    </View>
                                                    <TouchableOpacity
                                                        style={styles.deleteGrip}
                                                        onPress={() => handleDeleteItem(item.id)}
                                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                    >
                                                        <Icon name="close" size={13} color="#ffffff" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}

                                            <Image
                                                source={{ uri: item.imageUri }}
                                                style={styles.imageContent}
                                                resizeMode="contain"
                                            />

                                            {isSelected && (
                                                <View style={styles.imageResizeBadge}>
                                                    <TouchableOpacity
                                                        onPress={() => handleResizeItem(item.id, -15, -15)}
                                                        style={styles.resizeSmallBtn}
                                                    >
                                                        <Icon name="remove" size={12} color="#ffffff" />
                                                    </TouchableOpacity>
                                                    <View style={styles.resizeDivider} />
                                                    <TouchableOpacity
                                                        onPress={() => handleResizeItem(item.id, 15, 15)}
                                                        style={styles.resizeSmallBtn}
                                                    >
                                                        <Icon name="add" size={12} color="#ffffff" />
                                                    </TouchableOpacity>
                                                </View>
                                            )}
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </View>
                </View>

                {/* Floating Zoom Controls (+ / 100% / -) */}
                <View style={[styles.floatingZoomCard, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                    <TouchableOpacity
                        onPress={handleZoomIn}
                        style={styles.zoomBtn}
                        activeOpacity={0.7}
                    >
                        <Icon name="add" size={18} color={colors.text} />
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleResetZoom}
                        style={styles.zoomResetBtn}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.zoomPctText, { color: colors.primary }]}>
                            {Math.round(zoomScale * 100)}%
                        </Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        onPress={handleZoomOut}
                        style={styles.zoomBtn}
                        activeOpacity={0.7}
                    >
                        <Icon name="remove" size={18} color={colors.text} />
                    </TouchableOpacity>
                </View>
            </View>

            {/* Direct Text Formatting Toolbar (Visible when text item is selected) */}
            {selectedItem && selectedItem.type === 'text' && (
                <View style={[styles.textFormatBar, { backgroundColor: colors.surfaceLight, borderTopColor: colors.border }]}>
                    {/* Font Size controls */}
                    <View style={styles.fontSizeControls}>
                        <TouchableOpacity
                            onPress={() => handleChangeFontSize(selectedItem.id, -1)}
                            style={[styles.formatBtn, { backgroundColor: colors.backgroundLight, borderColor: colors.border }]}
                        >
                            <Text style={[styles.formatBtnText, { color: colors.text }]}>A-</Text>
                        </TouchableOpacity>
                        <Text style={[styles.fontSizeLabel, { color: colors.text }]}>
                            {selectedItem.fontSize || 14} pt
                        </Text>
                        <TouchableOpacity
                            onPress={() => handleChangeFontSize(selectedItem.id, 1)}
                            style={[styles.formatBtn, { backgroundColor: colors.backgroundLight, borderColor: colors.border }]}
                        >
                            <Text style={[styles.formatBtnText, { color: colors.text }]}>A+</Text>
                        </TouchableOpacity>
                    </View>

                    <View style={[styles.barSeparator, { backgroundColor: colors.border }]} />

                    {/* White Background (Corrector) Toggle */}
                    <TouchableOpacity
                        style={[
                            styles.bgToggleBtn,
                            {
                                backgroundColor:
                                    selectedItem.hasBackground !== false ? colors.primary : colors.backgroundLight,
                                borderColor: colors.border,
                            },
                        ]}
                        onPress={() => handleToggleBackground(selectedItem.id)}
                        activeOpacity={0.75}
                    >
                        <Icon
                            name="layers"
                            size={14}
                            color={selectedItem.hasBackground !== false ? '#ffffff' : colors.text}
                        />
                        <Text
                            style={[
                                styles.bgToggleText,
                                {
                                    color: selectedItem.hasBackground !== false ? '#ffffff' : colors.text,
                                },
                            ]}
                        >
                            Fondo
                        </Text>
                    </TouchableOpacity>

                    <View style={[styles.barSeparator, { backgroundColor: colors.border }]} />

                    {/* Color Dots */}
                    <View style={styles.colorDotsRow}>
                        {(['black', 'blue', 'red', 'green'] as const).map((k) => {
                            const isCurColor = (selectedItem.colorKey || 'black') === k;
                            return (
                                <TouchableOpacity
                                    key={k}
                                    onPress={() => handleChangeColor(selectedItem.id, k)}
                                    style={[
                                        styles.colorDotWrapper,
                                        {
                                            borderColor: isCurColor ? colors.primary : 'transparent',
                                            borderWidth: isCurColor ? 2 : 0,
                                        },
                                    ]}
                                >
                                    <View style={[styles.colorDotCircle, { backgroundColor: COLOR_MAP[k].hex }]} />
                                </TouchableOpacity>
                            );
                        })}
                    </View>

                    <View style={[styles.barSeparator, { backgroundColor: colors.border }]} />

                    {/* Done / Deselect Button */}
                    <TouchableOpacity
                        style={[styles.doneBtn, { backgroundColor: colors.backgroundLight }]}
                        onPress={() => setSelectedId(null)}
                    >
                        <Icon name="check" size={18} color={colors.primary} />
                    </TouchableOpacity>
                </View>
            )}

            {/* Bottom Section: Page Navigation (Moved to bottom) & Save Button */}
            <View style={[styles.bottomSection, { backgroundColor: colors.surfaceLight, borderTopColor: colors.border }]}>
                {/* Page Navigation at bottom */}
                <View style={styles.pageNavRow}>
                    <TouchableOpacity
                        style={[
                            styles.navPageBtn,
                            {
                                backgroundColor: colors.backgroundLight,
                                borderColor: colors.border,
                                opacity: activePage <= 1 ? 0.35 : 1,
                            },
                        ]}
                        onPress={() => {
                            setActivePage((p) => Math.max(1, p - 1));
                            setSelectedId(null);
                        }}
                        disabled={activePage <= 1}
                    >
                        <Icon name="chevron-left" size={18} color={colors.text} />
                        <Text style={[styles.navPageBtnText, { color: colors.text }]}>Anterior</Text>
                    </TouchableOpacity>

                    <View style={[styles.pageIndicatorPill, { backgroundColor: colors.backgroundLight, borderColor: colors.border }]}>
                        <Text style={[styles.pageIndicatorText, { color: colors.textSecondary }]}>
                            Página <Text style={{ color: colors.text, fontWeight: 'bold' }}>{activePage}</Text> de {totalPages}
                        </Text>
                    </View>

                    <TouchableOpacity
                        style={[
                            styles.navPageBtn,
                            {
                                backgroundColor: colors.backgroundLight,
                                borderColor: colors.border,
                                opacity: activePage >= totalPages ? 0.35 : 1,
                            },
                        ]}
                        onPress={() => {
                            setActivePage((p) => Math.min(totalPages, p + 1));
                            setSelectedId(null);
                        }}
                        disabled={activePage >= totalPages}
                    >
                        <Text style={[styles.navPageBtnText, { color: colors.text }]}>Siguiente</Text>
                        <Icon name="chevron-right" size={18} color={colors.text} />
                    </TouchableOpacity>
                </View>

                {/* Primary Save Button */}
                <TouchableOpacity
                    style={[
                        styles.applyBtn,
                        {
                            backgroundColor: items.length > 0 ? colors.primary : 'rgba(221, 31, 71, 0.4)',
                        },
                    ]}
                    onPress={handleSaveDocument}
                    disabled={items.length === 0 || isProcessing}
                    activeOpacity={0.85}
                >
                    {isProcessing ? (
                        <ActivityIndicator color="#ffffff" />
                    ) : (
                        <>
                            <Icon name="save" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                            <Text style={styles.applyBtnText}>
                                {items.length === 0
                                    ? 'Guardar cambios'
                                    : `Guardar cambios (${items.length} ${items.length === 1 ? 'edición' : 'ediciones'})`}
                            </Text>
                        </>
                    )}
                </TouchableOpacity>
            </View>

            {/* Image Picker Modal */}
            <ImagePickerModal
                visible={imagePickerVisible}
                onClose={() => setImagePickerVisible(false)}
                onSelectImage={handleSelectImage}
                title="Elegir imagen para insertar"
            />

            {/* SaveModeModal */}
            <SaveModeModal
                visible={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                onConfirm={handleConfirmSave}
                title="¿Cómo deseas guardar el PDF?"
                description="Selecciona una opción para aplicar las ediciones al documento:"
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
                    setItems([]);
                    setSelectedId(null);
                    setZoomScale(1.0);
                    setPanOffset({ x: 0, y: 0 });
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
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 12,
        paddingVertical: 8,
        borderBottomWidth: 1,
    },
    topToolsLeft: {
        flexDirection: 'row',
        gap: 8,
    },
    toolBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 12,
        borderRadius: 8,
        borderWidth: 1,
        gap: 6,
    },
    toolBtnText: {
        fontSize: 13,
        fontWeight: '600',
    },
    resetBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 6,
        paddingHorizontal: 10,
        borderRadius: 8,
        borderWidth: 1,
        gap: 4,
    },
    resetBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },
    canvasContainer: {
        flex: 1,
        position: 'relative',
        backgroundColor: '#cbd5e1',
        overflow: 'hidden',
        alignItems: 'center',
        justifyContent: 'center',
    },
    pageWrapper: {
        position: 'relative',
        backgroundColor: '#ffffff',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 4,
    },
    itemBox: {
        position: 'absolute',
        borderRadius: 3,
        overflow: 'visible',
    },
    textInnerContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
        justifyContent: 'center',
    },
    directInput: {
        paddingHorizontal: 4,
        paddingVertical: 2,
        fontWeight: '600',
        textAlignVertical: 'center',
    },
    itemHeaderBar: {
        position: 'absolute',
        top: -24,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        zIndex: 20,
    },
    dragGrip: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#2563eb',
        borderRadius: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        gap: 2,
    },
    dragLabel: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: 'bold',
    },
    deleteGrip: {
        backgroundColor: '#ef4444',
        borderRadius: 10,
        width: 20,
        height: 20,
        justifyContent: 'center',
        alignItems: 'center',
    },
    widthResizeBar: {
        position: 'absolute',
        bottom: -16,
        right: -6,
        flexDirection: 'row',
        backgroundColor: '#2563eb',
        borderRadius: 6,
        paddingHorizontal: 2,
        paddingVertical: 1,
        zIndex: 20,
    },
    imageInnerContainer: {
        width: '100%',
        height: '100%',
        position: 'relative',
    },
    imageContent: {
        width: '100%',
        height: '100%',
    },
    imageResizeBadge: {
        position: 'absolute',
        bottom: -12,
        right: -10,
        flexDirection: 'row',
        backgroundColor: '#2563eb',
        borderRadius: 10,
        paddingHorizontal: 4,
        paddingVertical: 2,
        alignItems: 'center',
        zIndex: 20,
    },
    resizeSmallBtn: {
        paddingHorizontal: 3,
        paddingVertical: 1,
    },
    resizeDivider: {
        width: 1,
        height: 10,
        backgroundColor: 'rgba(255,255,255,0.4)',
    },
    floatingZoomCard: {
        position: 'absolute',
        right: 14,
        bottom: 14,
        flexDirection: 'column',
        borderRadius: 12,
        borderWidth: 1,
        elevation: 5,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.2,
        shadowRadius: 4,
        overflow: 'hidden',
    },
    zoomBtn: {
        padding: 8,
        alignItems: 'center',
        justifyContent: 'center',
    },
    zoomResetBtn: {
        paddingHorizontal: 6,
        paddingVertical: 4,
        alignItems: 'center',
        justifyContent: 'center',
        borderTopWidth: StyleSheet.hairlineWidth,
        borderBottomWidth: StyleSheet.hairlineWidth,
        borderColor: 'rgba(0,0,0,0.1)',
    },
    zoomPctText: {
        fontSize: 10,
        fontWeight: 'bold',
    },
    textFormatBar: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderTopWidth: 1,
        gap: 8,
    },
    fontSizeControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    formatBtn: {
        paddingHorizontal: 6,
        paddingVertical: 3,
        borderRadius: 6,
        borderWidth: 1,
    },
    formatBtnText: {
        fontSize: 12,
        fontWeight: 'bold',
    },
    fontSizeLabel: {
        fontSize: 12,
        fontWeight: '600',
        minWidth: 38,
        textAlign: 'center',
    },
    barSeparator: {
        width: 1,
        height: 20,
    },
    bgToggleBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 6,
        borderWidth: 1,
        gap: 4,
    },
    bgToggleText: {
        fontSize: 11,
        fontWeight: '600',
    },
    colorDotsRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    colorDotWrapper: {
        padding: 2,
        borderRadius: 12,
    },
    colorDotCircle: {
        width: 14,
        height: 14,
        borderRadius: 7,
    },
    doneBtn: {
        padding: 4,
        borderRadius: 8,
        marginLeft: 'auto',
    },
    bottomSection: {
        paddingHorizontal: 14,
        paddingTop: 10,
        paddingBottom: 14,
        borderTopWidth: 1,
        gap: 10,
    },
    pageNavRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    navPageBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
        gap: 2,
    },
    navPageBtnText: {
        fontSize: 12,
        fontWeight: '600',
    },
    pageIndicatorPill: {
        paddingHorizontal: 12,
        paddingVertical: 6,
        borderRadius: 8,
        borderWidth: 1,
    },
    pageIndicatorText: {
        fontSize: 12,
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
