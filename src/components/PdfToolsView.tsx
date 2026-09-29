import React from 'react';
import {
    View,
    Text,
    StyleSheet,
    ScrollView,
    TouchableOpacity,
    Image,
    Platform,
    ImageSourcePropType,
} from 'react-native';
import { useNavigation } from '@react-navigation/native';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

interface ToolItem {
    id: string;
    image: ImageSourcePropType;
    titleKey: string;
    descKey: string;
}

const TOOLS: ToolItem[] = [
    {
        id: 'sign',
        image: require('../assets/tools/sign.png'),
        titleKey: 'tools.sign',
        descKey: 'tools.signDesc',
    },
    {
        id: 'merge',
        image: require('../assets/tools/merge.png'),
        titleKey: 'tools.merge',
        descKey: 'tools.mergeDesc',
    },
    {
        id: 'split',
        image: require('../assets/tools/split.png'),
        titleKey: 'tools.split',
        descKey: 'tools.splitDesc',
    },
    {
        id: 'deletePages',
        image: require('../assets/tools/delete_pages.png'),
        titleKey: 'tools.deletePages',
        descKey: 'tools.deletePagesDesc',
    },
    {
        id: 'rotate',
        image: require('../assets/tools/rotate.png'),
        titleKey: 'tools.rotate',
        descKey: 'tools.rotateDesc',
    },
    {
        id: 'edit',
        image: require('../assets/tools/edit.png'),
        titleKey: 'tools.edit',
        descKey: 'tools.editDesc',
    },
    {
        id: 'reorder',
        image: require('../assets/tools/reorder.png'),
        titleKey: 'tools.reorder',
        descKey: 'tools.reorderDesc',
    },
    {
        id: 'form',
        image: require('../assets/tools/form.png'),
        titleKey: 'tools.form',
        descKey: 'tools.formDesc',
    },
    {
        id: 'redact',
        image: require('../assets/tools/redact.png'),
        titleKey: 'tools.redact',
        descKey: 'tools.redactDesc',
    },
    {
        id: 'watermark',
        image: require('../assets/tools/watermark.png'),
        titleKey: 'tools.watermark',
        descKey: 'tools.watermarkDesc',
    },
];

export const PdfToolsView: React.FC = () => {
    const navigation = useNavigation<any>();
    const { colors } = useTheme();

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
                        {/* 1. Arriba: Ícono */}
                        <View style={styles.iconContainer}>
                            <Image
                                source={tool.image}
                                style={styles.toolIconImage}
                                resizeMode="contain"
                            />
                        </View>

                        {/* 2. Abajo: Título (fuente más grande y destacada) */}
                        <Text style={[styles.toolTitle, { color: colors.text }]}>
                            {t(tool.titleKey)}
                        </Text>

                        {/* 3. Abajo: Descripción (fuente más chica y diferente tipografía) */}
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
        minHeight: 145,
    },
    iconContainer: {
        width: '100%',
        height: 56,
        alignItems: 'center',
        justifyContent: 'center',
        marginBottom: 10,
    },
    toolIconImage: {
        width: 52,
        height: 52,
    },
    toolTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        fontFamily: Platform.select({ ios: 'System', android: 'sans-serif-medium' }),
        marginBottom: 4,
        textAlign: 'center',
    },
    toolDesc: {
        fontSize: 11.5,
        fontWeight: 'normal',
        fontFamily: Platform.select({ ios: 'HelveticaNeue', android: 'sans-serif' }),
        lineHeight: 16,
        textAlign: 'center',
    },
});

