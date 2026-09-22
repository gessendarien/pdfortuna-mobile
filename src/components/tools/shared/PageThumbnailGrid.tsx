import React from 'react';
import { View, Text, TouchableOpacity, StyleSheet, FlatList, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme/ThemeContext';

interface Props {
    totalPages: number;
    selectedPages?: Set<number>; // 1-indexed
    rotations?: Record<number, number>; // page -> deg
    pageOrder?: number[]; // list of 1-indexed page numbers in current order
    onToggleSelect?: (pageNum: number) => void;
    onRotatePage?: (pageNum: number) => void;
    onMovePage?: (fromIndex: number, toIndex: number) => void;
    mode?: 'select' | 'rotate' | 'reorder';
}

const { width } = Dimensions.get('window');
const ITEM_WIDTH = (width - 48) / 3;
const ITEM_HEIGHT = ITEM_WIDTH * 1.35;

export const PageThumbnailGrid: React.FC<Props> = ({
    totalPages,
    selectedPages = new Set(),
    rotations = {},
    pageOrder,
    onToggleSelect,
    onRotatePage,
    onMovePage,
    mode = 'select',
}) => {
    const { colors } = useTheme();

    const displayPages = pageOrder || Array.from({ length: totalPages }, (_, i) => i + 1);

    const renderItem = ({ item: pageNum, index }: { item: number; index: number }) => {
        const isSelected = selectedPages.has(pageNum);
        const rot = rotations[pageNum] || 0;

        return (
            <View style={styles.cardContainer}>
                <TouchableOpacity
                    style={[
                        styles.pageCard,
                        {
                            backgroundColor: colors.surfaceLight,
                            borderColor: isSelected ? colors.primary : colors.border,
                            borderWidth: isSelected ? 2 : 1,
                        },
                    ]}
                    onPress={() => onToggleSelect && onToggleSelect(pageNum)}
                    activeOpacity={0.75}
                >
                    {/* Placeholder page preview with page number */}
                    <View
                        style={[
                            styles.pageContent,
                            {
                                transform: [{ rotate: `${rot}deg` }],
                            },
                        ]}
                    >
                        <Icon name="description" size={36} color={colors.textSecondary} />
                        <Text style={[styles.innerPageNum, { color: colors.textSecondary }]}>
                            {pageNum}
                        </Text>
                    </View>

                    {/* Checkbox badge if in select mode */}
                    {mode === 'select' && (
                        <View
                            style={[
                                styles.selectBadge,
                                {
                                    backgroundColor: isSelected ? colors.primary : 'rgba(0,0,0,0.3)',
                                    borderColor: '#ffffff',
                                },
                            ]}
                        >
                            {isSelected && <Icon name="check" size={14} color="#ffffff" />}
                        </View>
                    )}

                    {/* Rotation badge if rotated */}
                    {rot !== 0 && (
                        <View style={[styles.rotBadge, { backgroundColor: colors.primary }]}>
                            <Text style={styles.rotBadgeText}>{rot}°</Text>
                        </View>
                    )}

                    {/* Top corner page index */}
                    <View style={[styles.pageNumberBadge, { backgroundColor: colors.surfaceLight }]}>
                        <Text style={[styles.pageNumberText, { color: colors.text }]}>
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
                                { opacity: index === 0 ? 0.3 : 1, backgroundColor: colors.surfaceLight },
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
        <FlatList
            data={displayPages}
            keyExtractor={(p) => p.toString()}
            renderItem={renderItem}
            numColumns={3}
            contentContainerStyle={styles.listContainer}
            columnWrapperStyle={styles.columnWrapper}
            showsVerticalScrollIndicator={false}
        />
    );
};

const styles = StyleSheet.create({
    listContainer: {
        paddingHorizontal: 12,
        paddingTop: 12,
        paddingBottom: 24,
    },
    columnWrapper: {
        justifyContent: 'space-between',
        marginBottom: 16,
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
        alignItems: 'center',
        justifyContent: 'center',
    },
    innerPageNum: {
        fontSize: 12,
        fontWeight: '700',
        marginTop: 4,
    },
    selectBadge: {
        position: 'absolute',
        top: 6,
        right: 6,
        width: 22,
        height: 22,
        borderRadius: 11,
        borderWidth: 1.5,
        justifyContent: 'center',
        alignItems: 'center',
    },
    rotBadge: {
        position: 'absolute',
        bottom: 6,
        right: 6,
        paddingHorizontal: 5,
        paddingVertical: 2,
        borderRadius: 6,
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
    },
    pageNumberText: {
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
        borderColor: 'rgba(0,0,0,0.1)',
    },
});
