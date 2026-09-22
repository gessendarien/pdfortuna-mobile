import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
    View,
    Text,
    Modal,
    TouchableOpacity,
    TouchableWithoutFeedback,
    StyleSheet,
    Animated,
    useWindowDimensions,
    Easing,
} from 'react-native';
import { format } from 'date-fns';
import Svg, { Path, Defs, LinearGradient, Stop } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { LocalFile } from '../services/FileService';
import { MarqueeText } from './MarqueeText';
import { t } from '../i18n';

interface Props {
    visible: boolean;
    file: LocalFile | null;
    isFavorite: boolean;
    onClose: () => void;
    onRename: () => void;
    onDelete: () => void;
    onShare: () => void;
    onFavorite: () => void;
}

const DESIGN_SIZE = 380;
const CLOSE_ORIGIN = { x: 320, y: 325 };

// Exact vector path extracted from design/menu-sostenido.png:
// Circular arc sector with straight edges and cradle notch for the close button.
const FAN_PATH = `
    M 315, 10
    C 346, 11 363, 28 363, 55
    L 363, 220
    C 363, 246 346, 253 325, 264
    C 285, 284 256, 315 248, 350
    C 244, 364 234, 370 215, 370
    L 45, 370
    C 20, 370 10, 355 10, 330
    C 10, 245 50, 155 110, 95
    C 165, 42 245, 10 315, 10
    Z
`.replace(/\s+/g, ' ').trim();

export const FileOptionsModal = ({
    visible,
    file,
    isFavorite,
    onClose,
    onRename,
    onDelete,
    onShare,
    onFavorite,
}: Props) => {
    const { colors, isDarkMode } = useTheme();
    const insets = useSafeAreaInsets();
    const { width: screenWidth, height: screenHeight } = useWindowDimensions();

    const [modalVisible, setModalVisible] = useState(visible);
    const anim = useRef(new Animated.Value(0)).current;

    useEffect(() => {
        if (visible) {
            setModalVisible(true);
            Animated.spring(anim, {
                toValue: 1,
                friction: 7,
                tension: 45,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(anim, {
                toValue: 0,
                duration: 180,
                easing: Easing.in(Easing.ease),
                useNativeDriver: true,
            }).start(() => {
                setModalVisible(false);
            });
        }
    }, [visible, anim]);

    const handleClose = (callback?: () => void) => {
        Animated.timing(anim, {
            toValue: 0,
            duration: 180,
            easing: Easing.in(Easing.ease),
            useNativeDriver: true,
        }).start(() => {
            setModalVisible(false);
            onClose();
            if (callback) {
                setTimeout(callback, 80);
            }
        });
    };

    const formattedDate = useMemo(() => {
        if (!file?.date) return '';
        try {
            return format(file.date, 'MMM dd, yyyy');
        } catch {
            return '';
        }
    }, [file?.date]);

    const formattedSize = useMemo(() => {
        if (!file) return '0 B';
        const bytes = file.size;
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }, [file?.size]);

    if (!modalVisible && !visible) return null;
    if (!file) return null;

    const fanSize = Math.min(370, screenWidth - 24);
    const scale = fanSize / DESIGN_SIZE;
    const closeBtnSize = 54 * scale;
    const actionBtnSize = 52 * scale;

    const closeCenter = {
        x: CLOSE_ORIGIN.x * scale,
        y: CLOSE_ORIGIN.y * scale,
    };

    const fanBottom = Math.max(insets.bottom, 16) + 16;
    const availableTopSpace = screenHeight - (fanBottom + fanSize);
    // Center the file card in the upper viewing space for prominent user focus
    const cardTop = Math.max(insets.top + 20, insets.top + (availableTopSpace - insets.top) / 2 - 30);

    // Order: bottom-left → mid-left → mid-upper → top-right
    // Placed along the sector curve of menu-sostenido.png
    const buttons = [
        {
            id: 'share',
            label: t('fileOptions.share') || 'Compartir',
            baseX: 90,
            baseY: 275,
            color: '#3b82f6',
            icon: 'share-social-outline',
            onPress: onShare,
        },
        {
            id: 'favorite',
            label: isFavorite ? 'Quitar fav' : 'Favorito',
            baseX: 140,
            baseY: 195,
            color: '#ec4899',
            icon: isFavorite ? 'heart' : 'heart-outline',
            onPress: onFavorite,
        },
        {
            id: 'rename',
            label: t('fileOptions.rename') || 'Renombrar',
            baseX: 215,
            baseY: 130,
            color: '#8b5cf6',
            icon: 'pencil-outline',
            onPress: onRename,
        },
        {
            id: 'delete',
            label: t('fileOptions.delete') || 'Eliminar',
            baseX: 305,
            baseY: 90,
            color: '#ef4444',
            icon: 'trash-outline',
            onPress: onDelete,
        },
    ];

    return (
        <Modal
            transparent
            visible={modalVisible}
            animationType="none"
            onRequestClose={() => handleClose()}
        >
            <View style={styles.modalRoot}>
                {/* Backdrop overlay with dimming */}
                <TouchableWithoutFeedback onPress={() => handleClose()}>
                    <Animated.View
                        style={[
                            styles.backdrop,
                            {
                                opacity: anim.interpolate({
                                    inputRange: [0, 1],
                                    outputRange: [0, 0.55],
                                }),
                            },
                        ]}
                    />
                </TouchableWithoutFeedback>

                {/* File summary card centered prominently */}
                <Animated.View
                    style={[
                        styles.fileCard,
                        {
                            top: cardTop,
                            backgroundColor: isDarkMode ? 'rgba(30, 41, 59, 0.94)' : 'rgba(255, 255, 255, 0.96)',
                            borderColor: isDarkMode ? 'rgba(255, 255, 255, 0.16)' : 'rgba(0, 0, 0, 0.08)',
                            opacity: anim,
                            transform: [
                                {
                                    scale: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [0.88, 1],
                                    }),
                                },
                                {
                                    translateY: anim.interpolate({
                                        inputRange: [0, 1],
                                        outputRange: [-20, 0],
                                    }),
                                },
                            ],
                        },
                    ]}
                >
                    <View style={[styles.fileCardIcon, { backgroundColor: isDarkMode ? 'rgba(239, 68, 68, 0.18)' : '#fee2e2' }]}>
                        <Icon name="document-text" size={22} color="#ef4444" />
                    </View>
                    <View style={styles.fileCardInfo}>
                        <MarqueeText text={file.name} style={[styles.fileName, { color: colors.text }]} />
                        <Text style={[styles.fileMeta, { color: colors.textSecondary }]}>
                            {formattedSize}
                            {` • ${formattedDate}`}
                            {file.pageCount !== undefined ? ` • ${file.pageCount} p.` : ''}
                        </Text>
                    </View>
                </Animated.View>

                {/* Floating Radial Fan Menu Container */}
                <View
                    style={[
                        styles.fanContainer,
                        {
                            bottom: Math.max(insets.bottom, 16) + 16,
                            right: 12,
                            width: fanSize,
                            height: fanSize,
                        },
                    ]}
                    pointerEvents="box-none"
                >
                    {/* Organic Frosted Shape Backdrop */}
                    <Animated.View
                        style={[
                            StyleSheet.absoluteFill,
                            {
                                transform: [
                                    {
                                        translateX: anim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [fanSize * 0.35, 0],
                                        }),
                                    },
                                    {
                                        translateY: anim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [fanSize * 0.35, 0],
                                        }),
                                    },
                                    {
                                        scale: anim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.2, 1],
                                        }),
                                    },
                                ],
                                opacity: anim.interpolate({
                                    inputRange: [0, 0.25, 1],
                                    outputRange: [0, 0.8, 1],
                                }),
                            },
                        ]}
                        pointerEvents="none"
                    >
                        <Svg width={fanSize} height={fanSize} viewBox={`0 0 ${DESIGN_SIZE} ${DESIGN_SIZE}`}>
                            <Defs>
                                <LinearGradient id="radialBlobGrad" x1="0" y1="0" x2="1" y2="1">
                                    <Stop
                                        offset="0%"
                                        stopColor={isDarkMode ? 'rgba(51, 65, 85, 0.75)' : 'rgba(255, 255, 255, 0.82)'}
                                    />
                                    <Stop
                                        offset="100%"
                                        stopColor={isDarkMode ? 'rgba(30, 41, 59, 0.88)' : 'rgba(226, 232, 240, 0.90)'}
                                    />
                                </LinearGradient>
                            </Defs>
                            <Path
                                d={FAN_PATH}
                                fill="url(#radialBlobGrad)"
                                stroke={isDarkMode ? 'rgba(255, 255, 255, 0.25)' : 'rgba(255, 255, 255, 0.65)'}
                                strokeWidth={1.5}
                            />
                        </Svg>
                    </Animated.View>

                    {/* Radial Action Buttons */}
                    {buttons.map((b) => {
                        const targetX = b.baseX * scale;
                        const targetY = b.baseY * scale;
                        const deltaX = closeCenter.x - targetX;
                        const deltaY = closeCenter.y - targetY;
                        const wrapperWidth = 76 * scale;
                        const wrapperHeight = 80 * scale;

                        return (
                            <Animated.View
                                key={b.id}
                                style={[
                                    styles.actionBtnWrapper,
                                    {
                                        left: targetX - wrapperWidth / 2,
                                        top: targetY - actionBtnSize / 2,
                                        width: wrapperWidth,
                                        height: wrapperHeight,
                                        transform: [
                                            {
                                                translateX: anim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [deltaX, 0],
                                                }),
                                            },
                                            {
                                                translateY: anim.interpolate({
                                                    inputRange: [0, 1],
                                                    outputRange: [deltaY, 0],
                                                }),
                                            },
                                            {
                                                scale: anim.interpolate({
                                                    inputRange: [0, 0.4, 1],
                                                    outputRange: [0.1, 0.6, 1],
                                                }),
                                            },
                                        ],
                                        opacity: anim.interpolate({
                                            inputRange: [0, 0.2, 1],
                                            outputRange: [0, 0.7, 1],
                                        }),
                                    },
                                ]}
                            >
                                <TouchableOpacity
                                    activeOpacity={0.8}
                                    style={styles.actionBtnTouch}
                                    onPress={() => handleClose(b.onPress)}
                                >
                                    <View
                                        style={[
                                            styles.actionBtnCircle,
                                            {
                                                width: actionBtnSize,
                                                height: actionBtnSize,
                                                borderRadius: actionBtnSize / 2,
                                                backgroundColor: b.color,
                                            },
                                        ]}
                                    >
                                        <Icon
                                            name={b.icon}
                                            size={Math.round(23 * scale)}
                                            color="#ffffff"
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.actionBtnLabel,
                                            {
                                                fontSize: Math.max(11, Math.round(12 * scale)),
                                            },
                                        ]}
                                        numberOfLines={1}
                                    >
                                        {b.label}
                                    </Text>
                                </TouchableOpacity>
                            </Animated.View>
                        );
                    })}

                    {/* Bottom-Right Close Button */}
                    <Animated.View
                        style={[
                            styles.closeBtnWrapper,
                            {
                                left: closeCenter.x - closeBtnSize / 2,
                                top: closeCenter.y - closeBtnSize / 2,
                                width: closeBtnSize,
                                height: closeBtnSize,
                                transform: [
                                    {
                                        scale: anim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: [0.5, 1],
                                        }),
                                    },
                                    {
                                        rotate: anim.interpolate({
                                            inputRange: [0, 1],
                                            outputRange: ['-90deg', '0deg'],
                                        }),
                                    },
                                ],
                            },
                        ]}
                    >
                        <TouchableOpacity
                            style={[
                                styles.closeBtn,
                                {
                                    width: closeBtnSize,
                                    height: closeBtnSize,
                                    borderRadius: closeBtnSize / 2,
                                    backgroundColor: isDarkMode ? '#1e293b' : '#0f172a',
                                },
                            ]}
                            activeOpacity={0.7}
                            onPress={() => handleClose()}
                        >
                            <Icon name="close" size={Math.round(26 * scale)} color="#ffffff" />
                        </TouchableOpacity>
                    </Animated.View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalRoot: {
        flex: 1,
    },
    backdrop: {
        ...StyleSheet.absoluteFillObject,
        backgroundColor: '#000000',
    },
    fileCard: {
        position: 'absolute',
        left: 20,
        right: 20,
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderRadius: 20,
        borderWidth: 1,
        elevation: 12,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 6 },
        shadowOpacity: 0.25,
        shadowRadius: 10,
    },
    fileCardIcon: {
        width: 42,
        height: 42,
        borderRadius: 14,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 14,
    },
    fileCardInfo: {
        flex: 1,
        justifyContent: 'center',
    },
    fileName: {
        fontSize: 15,
        fontWeight: '700',
    },
    fileMeta: {
        fontSize: 12,
        marginTop: 2,
    },
    fanContainer: {
        position: 'absolute',
    },
    actionBtnWrapper: {
        position: 'absolute',
        alignItems: 'center',
    },
    actionBtnTouch: {
        alignItems: 'center',
    },
    actionBtnCircle: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 1.5,
        borderColor: 'rgba(255, 255, 255, 0.35)',
        elevation: 8,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
    },
    actionBtnLabel: {
        color: '#ffffff',
        fontWeight: '700',
        textAlign: 'center',
        marginTop: 5,
        letterSpacing: 0.2,
        textShadowColor: 'rgba(0, 0, 0, 0.75)',
        textShadowOffset: { width: 0, height: 1 },
        textShadowRadius: 3,
    },
    closeBtnWrapper: {
        position: 'absolute',
    },
    closeBtn: {
        justifyContent: 'center',
        alignItems: 'center',
        borderWidth: 2,
        borderColor: 'rgba(255, 255, 255, 0.25)',
        elevation: 10,
        shadowColor: '#000000',
        shadowOffset: { width: 0, height: 5 },
        shadowOpacity: 0.4,
        shadowRadius: 8,
    },
});
