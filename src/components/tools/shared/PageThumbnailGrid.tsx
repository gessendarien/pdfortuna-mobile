import React, { useState, useEffect } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    FlatList,
    Dimensions,
    Image,
    Modal,
    ActivityIndicator,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import Pdf from 'react-native-pdf';
import PdfThumbnail from 'react-native-pdf-thumbnail';
import { useTheme } from '../../../theme/ThemeContext';

interface Props {
    totalPages: number;
    sourcePath?: string;
    selectedPages?: Set<number>; // 1-indexed
    rotations?: Record<number, number>; // page -> deg
    pageOrder?: number[]; // list of 1-indexed page numbers in current order
    onToggleSelect?: (pageNum: number) => void;
    onRotatePage?: (pageNum: number) => void;
    onMovePage?: (fromIndex: number, toIndex: number) => void;
    mode?: 'select' | 'rotate' | 'reorder';
}

const { width: SCREEN_WIDTH, height: SCREEN_HEIGHT } = Dimensions.get('window');
const NUM_COLUMNS = 3;
const GAP = 12;
const PADDING_H = 16;
const TOTAL_GAP = GAP * (NUM_COLUMNS - 1);
const TOTAL_PADDING = PADDING_H * 2;
const ITEM_WIDTH = Math.floor((SCREEN_WIDTH - TOTAL_PADDING - TOTAL_GAP) / NUM_COLUMNS);
const ITEM_HEIGHT = Math.floor(ITEM_WIDTH * 1.38);

export const PageThumbnailGrid: React.FC<Props> = ({
    totalPages,
    sourcePath,
    selectedPages = new Set(),
    rotations = {},
    pageOrder,
    onToggleSelect,
    onRotatePage,
    onMovePage,
    mode = 'select',
}) => {
    const { colors } = useTheme();
    const [thumbnails, setThumbnails] = useState<Record<number, string>>({});
    const [previewModalPage, setPreviewModalPage] = useState<number | null>(null);

    const displayPages = pageOrder || Array.from({ length: totalPages }, (_, i) => i + 1);

    // Load real page thumbnails
    useEffect(() => {
        if (!sourcePath) return;
        let isMounted = true;
        const cleanPath = sourcePath.replace('file://', '');

        const loadPageThumbnails = async () => {
            for (let i = 0; i < totalPages; i++) {
                try {
                    const res = await PdfThumbnail.generate(cleanPath, i);
                    if (res?.uri && isMounted) {
                        setThumbnails((prev) => ({ ...prev, [i + 1]: res.uri }));
                    }
                } catch {
                    // Fallback to placeholder if a page fails
                }
            }
        };

        loadPageThumbnails();

        return () => {
            isMounted = false;
        };
    }, [sourcePath, totalPages]);

    const renderItem = ({ item: pageNum, index }: { item: number; index: number }) => {
        const isSelected = selectedPages.has(pageNum);
        const rot = rotations[pageNum] || 0;
        const thumbUri = thumbnails[pageNum];

        return (
            <View style={styles.cardContainer}>
                {/* Tapping on the card opens the enlarged preview modal */}
                <TouchableOpacity
                    style={[
                        styles.pageCard,
                        {
                            backgroundColor: colors.surfaceLight,
                            borderColor: isSelected && mode === 'select' ? '#ef4444' : colors.border,
                            borderWidth: isSelected && mode === 'select' ? 2 : 1,
                        },
                    ]}
                    onPress={() => setPreviewModalPage(pageNum)}
                    activeOpacity={0.8}
                >
                    {/* Page Thumbnail Image or Placeholder */}
                    <View
                        style={[
                            styles.pageContent,
                            {
                                transform: [{ rotate: `${rot}deg` }],
                            },
                        ]}
                    >
                        {thumbUri ? (
                            <Image
                                source={{ uri: thumbUri }}
                                style={styles.thumbnailImg}
                                resizeMode="cover"
                            />
                        ) : (
                            <View style={styles.placeholderBox}>
                                <Icon name="description" size={36} color={colors.textSecondary} />
                                <Text style={[styles.innerPageNum, { color: colors.textSecondary }]}>
                                    Pág. {pageNum}
                                </Text>
                            </View>
                        )}
                    </View>

                    {/* Top-right corner: Checkbox button for deleting / selecting */}
                    {mode === 'select' && (
                        <TouchableOpacity
                            style={[
                                styles.selectBadge,
                                {
                                    backgroundColor: isSelected ? '#ef4444' : 'rgba(0,0,0,0.45)',
                                    borderColor: '#ffffff',
                                },
                            ]}
                            onPress={() => onToggleSelect && onToggleSelect(pageNum)}
                            hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            activeOpacity={0.7}
                        >
                            {isSelected ? (
                                <Icon name="close" size={14} color="#ffffff" />
                            ) : (
                                <Icon name="check" size={12} color="rgba(255,255,255,0.7)" />
                            )}
                        </TouchableOpacity>
                    )}

                    {/* Semi-transparent red overlay with prominent Red "X" when marked for deletion */}
                    {mode === 'select' && isSelected && (
                        <View style={styles.deletedOverlay} pointerEvents="none">
                            <Icon name="close" size={54} color="#ef4444" />
                        </View>
                    )}

                    {/* Rotation badge if rotated */}
                    {rot !== 0 && (
                        <View style={[styles.rotBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.rotBadgeText}>{rot}°</Text>
                        </View>
                    )}

                    {/* Bottom-left page index badge */}
                    <View style={[styles.pageNumberBadge, { backgroundColor: 'rgba(0,0,0,0.65)' }]}>
                        <Text style={styles.pageNumberText}>
                            {index + 1}
                        </Text>
                    </View>
                </TouchableOpacity>

                {/* Sub-actions depending on mode */}
                {mode === 'rotate' && onRotatePage && (
                    <TouchableOpacity
                        style={[styles.actionRowButton, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}
                        onPress={() => onRotatePage(pageNum)}
                        activeOpacity={0.7}
                    >
                        <Icon name="rotate-right" size={16} color={colors.primary} />
                        <Text style={[styles.actionRowText, { color: colors.primary }]}>Girar 90°</Text>
                    </TouchableOpacity>
                )}

                {mode === 'reorder' && onMovePage && (
                    <View style={styles.reorderActions}>
                        <TouchableOpacity
                            style={[
                                styles.arrowBtn,
                                { opacity: index === 0 ? 0.3 : 1, backgroundColor: colors.surfaceLight, borderColor: colors.border },
                            ]}
                            disabled={index === 0}
                            onPress={() => onMovePage(index, index - 1)}
                        >
                            <Icon name="arrow-back" size={16} color={colors.text} />
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[
                                styles.arrowBtn,
                                {
                                    opacity: index === displayPages.length - 1 ? 0.3 : 1,
                                    backgroundColor: colors.surfaceLight,
                                    borderColor: colors.border,
                                },
                            ]}
                            disabled={index === displayPages.length - 1}
                            onPress={() => onMovePage(index, index + 1)}
                        >
                            <Icon name="arrow-forward" size={16} color={colors.text} />
                        </TouchableOpacity>
                    </View>
                )}
            </View>
        );
    };

    return (
        <View style={styles.wrapper}>
            <FlatList
                data={displayPages}
                keyExtractor={(p) => p.toString()}
                renderItem={renderItem}
                numColumns={NUM_COLUMNS}
                contentContainerStyle={styles.listContainer}
                columnWrapperStyle={styles.columnWrapper}
                showsVerticalScrollIndicator={false}
            />

            {/* Enlarged Page Preview Modal */}
            <Modal
                visible={previewModalPage !== null}
                transparent={true}
                animationType="fade"
                onRequestClose={() => setPreviewModalPage(null)}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: colors.surfaceLight }]}>
                        {/* Header */}
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <View style={styles.modalHeaderInfo}>
                                <Icon name="visibility" size={20} color={colors.primary} style={{ marginRight: 6 }} />
                                <Text style={[styles.modalTitle, { color: colors.text }]}>
                                    Página {previewModalPage} de {totalPages}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => setPreviewModalPage(null)}
                                style={styles.modalCloseBtn}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Icon name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Page Preview Content */}
                        <View style={styles.modalPreviewBody}>
                            {sourcePath && previewModalPage ? (
                                <Pdf
                                    source={{
                                        uri: sourcePath.startsWith('file://') ? sourcePath : `file://${sourcePath}`,
                                    }}
                                    page={previewModalPage}
                                    scale={1.0}
                                    minScale={1.0}
                                    maxScale={5.0}
                                    fitPolicy={0}
                                    spacing={0}
                                    enablePaging={true}
                                    enableDoubleTapZoom={true}
                                    onPageChanged={(page) => setPreviewModalPage(page)}
                                    style={styles.modalPdfView}
                                />
                            ) : previewModalPage && thumbnails[previewModalPage] ? (
                                <Image
                                    source={{ uri: thumbnails[previewModalPage] }}
                                    style={styles.modalImage}
                                    resizeMode="contain"
                                />
                            ) : (
                                <View style={styles.modalPlaceholder}>
                                    <Icon name="description" size={64} color={colors.textSecondary} />
                                    <Text style={[styles.modalPlaceholderText, { color: colors.textSecondary }]}>
                                        Página {previewModalPage}
                                    </Text>
                                </View>
                            )}
                        </View>

                        {/* Modal Navigator Controls */}
                        <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                            <TouchableOpacity
                                style={[
                                    styles.modalNavBtn,
                                    {
                                        backgroundColor: colors.backgroundLight,
                                        borderColor: colors.border,
                                        opacity: (previewModalPage || 1) <= 1 ? 0.3 : 1,
                                    },
                                ]}
                                disabled={(previewModalPage || 1) <= 1}
                                onPress={() => setPreviewModalPage((p) => Math.max(1, (p || 1) - 1))}
                            >
                                <Icon name="chevron-left" size={20} color={colors.text} />
                                <Text style={[styles.modalNavText, { color: colors.text }]}>Anterior</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[styles.modalCloseMainBtn, { backgroundColor: colors.primary }]}
                                onPress={() => setPreviewModalPage(null)}
                            >
                                <Text style={styles.modalCloseMainText}>Cerrar</Text>
                            </TouchableOpacity>

                            <TouchableOpacity
                                style={[
                                    styles.modalNavBtn,
                                    {
                                        backgroundColor: colors.backgroundLight,
                                        borderColor: colors.border,
                                        opacity: (previewModalPage || 1) >= totalPages ? 0.3 : 1,
                                    },
                                ]}
                                disabled={(previewModalPage || 1) >= totalPages}
                                onPress={() => setPreviewModalPage((p) => Math.min(totalPages, (p || 1) + 1))}
                            >
                                <Text style={[styles.modalNavText, { color: colors.text }]}>Siguiente</Text>
                                <Icon name="chevron-right" size={20} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        flex: 1,
    },
    listContainer: {
        paddingHorizontal: PADDING_H,
        paddingTop: 12,
        paddingBottom: 24,
    },
    columnWrapper: {
        gap: GAP,
        marginBottom: 14,
        justifyContent: 'flex-start',
    },
    cardContainer: {
        width: ITEM_WIDTH,
        alignItems: 'center',
    },
    pageCard: {
        width: ITEM_WIDTH,
        height: ITEM_HEIGHT,
        borderRadius: 12,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        position: 'relative',
        overflow: 'hidden',
    },
    pageContent: {
        width: '100%',
        height: '100%',
        alignItems: 'center',
        justifyContent: 'center',
    },
    thumbnailImg: {
        width: '100%',
        height: '100%',
    },
    placeholderBox: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerPageNum: {
        fontSize: 11,
        fontWeight: '700',
        marginTop: 4,
    },
    selectBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 24,
        height: 24,
        borderRadius: 12,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
        elevation: 4,
    },
    deletedOverlay: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: 'rgba(239, 68, 68, 0.28)',
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 5,
        borderWidth: 2,
        borderColor: '#ef4444',
        borderRadius: 12,
    },
    rotBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
        zIndex: 4,
    },
    rotBadgeText: {
        color: '#ffffff',
        fontSize: 9,
        fontWeight: 'bold',
    },
    pageNumberBadge: {
        position: 'absolute',
        bottom: 6,
        left: 6,
        paddingHorizontal: 6,
        paddingVertical: 2,
        borderRadius: 6,
        zIndex: 4,
    },
    pageNumberText: {
        color: '#ffffff',
        fontSize: 10,
        fontWeight: '700',
    },
    actionRowButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
        paddingVertical: 5,
        borderRadius: 8,
        borderWidth: 1,
        marginTop: 6,
        gap: 4,
    },
    actionRowText: {
        fontSize: 10,
        fontWeight: '700',
    },
    reorderActions: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        width: '100%',
        marginTop: 6,
        paddingHorizontal: 4,
    },
    arrowBtn: {
        width: 32,
        height: 26,
        borderRadius: 6,
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1,
    },
    // Modal Preview Styles
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 420,
        height: SCREEN_HEIGHT * 0.78,
        borderRadius: 20,
        overflow: 'hidden',
        elevation: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    modalHeaderInfo: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalTitle: {
        fontSize: 15,
        fontWeight: 'bold',
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalPreviewBody: {
        flex: 1,
        backgroundColor: '#0f172a',
        justifyContent: 'center',
        alignItems: 'center',
    },
    modalPdfView: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
    },
    modalImage: {
        width: '95%',
        height: '95%',
    },
    modalPlaceholder: {
        alignItems: 'center',
        justifyContent: 'center',
    },
    modalPlaceholderText: {
        marginTop: 8,
        fontSize: 14,
    },
    modalFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderTopWidth: 1,
    },
    modalNavBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        paddingHorizontal: 12,
        borderRadius: 10,
        borderWidth: 1,
        gap: 4,
    },
    modalNavText: {
        fontSize: 12,
        fontWeight: '600',
    },
    modalCloseMainBtn: {
        paddingVertical: 8,
        paddingHorizontal: 20,
        borderRadius: 10,
    },
    modalCloseMainText: {
        color: '#ffffff',
        fontSize: 13,
        fontWeight: 'bold',
    },
});

