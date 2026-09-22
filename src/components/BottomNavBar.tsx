import React from 'react';
import { View, TouchableOpacity, StyleSheet, ActivityIndicator, useWindowDimensions } from 'react-native';
import Svg, { Path } from 'react-native-svg';
import Icon from 'react-native-vector-icons/Ionicons';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

export type NavTabType = 'documents' | 'favorites' | 'tools' | 'settings';

interface BottomNavBarProps {
    activeTab: NavTabType;
    onTabChange: (tab: NavTabType) => void;
    onScanPress: () => void;
    isScanning: boolean;
}

const BAR_HEIGHT = 64;
const BUTTON_DIAMETER = 56;
const CORNER_RADIUS = 24;

export const BottomNavBar: React.FC<BottomNavBarProps> = ({
    activeTab,
    onTabChange,
    onScanPress,
    isScanning,
}) => {
    const insets = useSafeAreaInsets();
    const { colors, isDarkMode } = useTheme();
    const { width } = useWindowDimensions();

    const bottomPadding = Math.max(insets.bottom, 8);
    const accentRed = colors.accentRed || '#dd1f47';

    const W = width;
    const H = BAR_HEIGHT;
    const R = CORNER_RADIUS;
    const cx = W / 2;

    // Smooth continuous Bezier cradle notch path
    // Button center is at (cx, 4) with radius 28.
    // Cutout dips to y=40, creating an even 8px cradle around the bottom half of the button.
    const path = `
        M 0,${H}
        L 0,${R}
        A ${R},${R} 0 0 1 ${R},0
        L ${cx - 50},0
        C ${cx - 32},0 ${cx - 34},40 ${cx},40
        C ${cx + 34},40 ${cx + 32},0 ${cx + 50},0
        L ${W - R},0
        A ${R},${R} 0 0 1 ${W},${R}
        L ${W},${H}
        Z
    `;

    const renderTab = (
        tab: NavTabType,
        iconActive: string,
        iconInactive: string,
        label: string,
        size: number
    ) => {
        const isActive = activeTab === tab;
        const activeColor = isDarkMode ? '#ffffff' : colors.primary;
        return (
            <TouchableOpacity
                style={styles.tabButton}
                onPress={() => onTabChange(tab)}
                activeOpacity={0.7}
                accessibilityLabel={label}
                accessibilityRole="tab"
            >
                <Icon
                    name={isActive ? iconActive : iconInactive}
                    size={size}
                    color={isActive ? activeColor : colors.textSecondary}
                />
            </TouchableOpacity>
        );
    };

    return (
        <View style={[styles.wrapper, { paddingBottom: 0 }]} pointerEvents="box-none">
            {/* SVG Background Bar with Bezier Notch */}
            <View style={styles.svgContainer}>
                <Svg width={W} height={H}>
                    <Path
                        d={path}
                        fill={colors.surfaceLight}
                        stroke={colors.border}
                        strokeWidth={1}
                    />
                </Svg>
            </View>

            {/* Bottom safe area filler matching the bar surface */}
            <View
                style={[
                    styles.safeAreaFiller,
                    {
                        height: bottomPadding,
                        backgroundColor: colors.surfaceLight,
                    },
                ]}
            />

            {/* Navigation Tabs Overlay */}
            <View style={[styles.tabOverlay, { width: W, height: H }]}>
                {/* Left Tabs: Documentos & Favoritos */}
                <View style={styles.tabSection}>
                    {renderTab('documents', 'document-text', 'document-text-outline', t('tabs.documents'), 26)}
                    {renderTab('favorites', 'heart', 'heart-outline', t('tabs.favorites'), 26)}
                </View>

                {/* Center spacing gap for the floating button */}
                <View style={styles.centerGap} pointerEvents="none" />

                {/* Right Tabs: Herramientas & Configuración */}
                <View style={styles.tabSection}>
                    {renderTab('tools', 'grid', 'grid-outline', t('tabs.tools'), 25)}
                    {renderTab('settings', 'settings', 'settings-outline', t('tabs.settings'), 25)}
                </View>
            </View>

            {/* Elevated Red Center Scan Button */}
            <View style={styles.floatingButtonContainer} pointerEvents="box-none">
                <TouchableOpacity
                    style={[
                        styles.floatingButton,
                        {
                            backgroundColor: accentRed,
                            shadowColor: accentRed,
                        },
                    ]}
                    onPress={onScanPress}
                    activeOpacity={0.8}
                    disabled={isScanning}
                >
                    {isScanning ? (
                        <ActivityIndicator size="small" color="#ffffff" />
                    ) : (
                        <Icon name="scan" size={26} color="#ffffff" />
                    )}
                </TouchableOpacity>
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        alignItems: 'center',
    },
    svgContainer: {
        width: '100%',
        height: BAR_HEIGHT,
        alignItems: 'center',
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: -3 },
        shadowOpacity: 0.08,
        shadowRadius: 6,
    },
    safeAreaFiller: {
        width: '100%',
    },
    tabOverlay: {
        position: 'absolute',
        top: 0,
        left: 0,
        right: 0,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 8,
        zIndex: 2,
    },
    tabSection: {
        flex: 1,
        flexDirection: 'row',
        justifyContent: 'space-around',
        alignItems: 'center',
        height: '100%',
    },
    centerGap: {
        width: 100,
        height: '100%',
    },
    tabButton: {
        flex: 1,
        alignItems: 'center',
        justifyContent: 'center',
        height: '100%',
    },
    floatingButtonContainer: {
        position: 'absolute',
        top: -24,
        left: 0,
        right: 0,
        alignItems: 'center',
        zIndex: 10,
    },
    floatingButton: {
        width: BUTTON_DIAMETER,
        height: BUTTON_DIAMETER,
        borderRadius: BUTTON_DIAMETER / 2,
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 8,
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 6,
    },
});
