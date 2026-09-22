import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

interface ToolItem {
    id: string;
    icon: string;
    titleKey: string;
    descKey: string;
    iconColor?: string;
    bgColor?: string;
}

const TOOLS: ToolItem[] = [
    {
        id: 'sign',
        icon: 'history-edu',
        titleKey: 'tools.sign',
        descKey: 'tools.signDesc',
        iconColor: '#3b82f6',
        bgColor: 'rgba(59, 130, 246, 0.1)',
    },
    {
        id: 'merge',
        icon: 'layers',
        titleKey: 'tools.merge',
        descKey: 'tools.mergeDesc',
        iconColor: '#10b981',
        bgColor: 'rgba(16, 185, 129, 0.1)',
    },
    {
        id: 'split',
        icon: 'content-cut',
        titleKey: 'tools.split',
        descKey: 'tools.splitDesc',
        iconColor: '#f59e0b',
        bgColor: 'rgba(245, 158, 11, 0.1)',
    },
    {
        id: 'deletePages',
        icon: 'auto-delete',
        titleKey: 'tools.deletePages',
        descKey: 'tools.deletePagesDesc',
        iconColor: '#ef4444',
        bgColor: 'rgba(239, 68, 68, 0.1)',
    },
    {
        id: 'reorder',
        icon: 'swap-vert',
        titleKey: 'tools.reorder',
        descKey: 'tools.reorderDesc',
        iconColor: '#8b5cf6',
        bgColor: 'rgba(139, 92, 246, 0.1)',
    },
    {
        id: 'rotate',
        icon: 'crop-rotate',
        titleKey: 'tools.rotate',
        descKey: 'tools.rotateDesc',
        iconColor: '#06b6d4',
        bgColor: 'rgba(6, 182, 212, 0.1)',
    },
    {
        id: 'edit',
        icon: 'edit-note',
        titleKey: 'tools.edit',
        descKey: 'tools.editDesc',
        iconColor: '#ec4899',
        bgColor: 'rgba(236, 72, 153, 0.1)',
    },
    {
        id: 'form',
        icon: 'fact-check',
        titleKey: 'tools.form',
        descKey: 'tools.formDesc',
        iconColor: '#14b8a6',
        bgColor: 'rgba(20, 184, 166, 0.1)',
    },
    {
        id: 'watermark',
        icon: 'verified',
        titleKey: 'tools.watermark',
        descKey: 'tools.watermarkDesc',
        iconColor: '#6366f1',
        bgColor: 'rgba(99, 102, 241, 0.1)',
    },
    {
        id: 'redact',
        icon: 'security',
        titleKey: 'tools.redact',
        descKey: 'tools.redactDesc',
        iconColor: '#64748b',
        bgColor: 'rgba(100, 116, 139, 0.15)',
    },
];

export const PdfToolsView: React.FC = () => {
    const navigation = useNavigation<any>();
    const { colors, isDarkMode } = useTheme();

    const handleToolPress = (tool: ToolItem) => {
        navigation.navigate('PdfTool', { toolId: tool.id });
    };

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            {/* Grid of Tools */}
            <View style={styles.grid}>
                {TOOLS.map((tool) => (
                    <TouchableOpacity
                        key={tool.id}
                        style={[
                            styles.toolCard,
                            {
                                backgroundColor: colors.surfaceLight,
                                borderColor: colors.border,
                                shadowColor: '#000',
                            },
                        ]}
                        onPress={() => handleToolPress(tool)}
                        activeOpacity={0.7}
                    >
                        {/* Top row: Icon & Action arrow */}
                        <View style={styles.cardHeader}>
                            <View
                                style={[
                                    styles.iconBadge,
                                    {
                                        backgroundColor: tool.bgColor || 'rgba(0, 0, 0, 0.05)',
                                    },
                                ]}
                            >
                                <Icon name={tool.icon} size={24} color={tool.iconColor || colors.primary} />
                            </View>

                            <View
                                style={[
                                    styles.activeBadge,
                                    {
                                        backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.06)' : 'rgba(0, 0, 0, 0.04)',
                                    },
                                ]}
                            >
                                <Icon name="arrow-forward" size={14} color={colors.textSecondary} />
                            </View>
                        </View>

                        {/* Title and Description */}
                        <Text style={[styles.toolTitle, { color: colors.text }]}>
                            {t(tool.titleKey)}
                        </Text>
                        <Text style={[styles.toolDesc, { color: colors.textSecondary }]}>
                            {t(tool.descKey)}
                        </Text>
                    </TouchableOpacity>
                ))}
            </View>
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    contentContainer: {
        paddingHorizontal: 16,
        paddingTop: 12,
        paddingBottom: 110,
    },
    grid: {
        flexDirection: 'row',
        flexWrap: 'wrap',
        justifyContent: 'space-between',
        gap: 12,
    },
    toolCard: {
        width: '48%',
        borderRadius: 16,
        padding: 14,
        borderWidth: 1,
        elevation: 2,
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.06,
        shadowRadius: 3,
        justifyContent: 'space-between',
        minHeight: 125,
    },
    cardHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 10,
    },
    iconBadge: {
        width: 42,
        height: 42,
        borderRadius: 12,
        alignItems: 'center',
        justifyContent: 'center',
    },
    activeBadge: {
        width: 28,
        height: 28,
        borderRadius: 14,
        alignItems: 'center',
        justifyContent: 'center',
    },
    toolTitle: {
        fontSize: 14,
        fontWeight: 'bold',
        marginBottom: 4,
    },
    toolDesc: {
        fontSize: 11,
        lineHeight: 15,
    },
});
