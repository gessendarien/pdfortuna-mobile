import React from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Switch } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

interface SettingsViewProps {
    showOffice: boolean;
    onToggleShowOffice: (value: boolean) => void;
    openOfficeInApp: boolean;
    onToggleOpenOfficeInApp: (value: boolean) => void;
    onOpenAbout: () => void;
}

export const SettingsView: React.FC<SettingsViewProps> = ({
    showOffice,
    onToggleShowOffice,
    openOfficeInApp,
    onToggleOpenOfficeInApp,
    onOpenAbout,
}) => {
    const { colors, isDarkMode, toggleDarkMode } = useTheme();

    const renderSettingRow = (
        icon: string,
        label: string,
        value: boolean,
        onValueChange: (val: boolean) => void,
        description?: string
    ) => (
        <View
            style={[
                styles.settingCard,
                {
                    backgroundColor: colors.surfaceLight,
                    borderColor: colors.border,
                },
            ]}
        >
            <View style={styles.settingLeft}>
                <View
                    style={[
                        styles.iconContainer,
                        {
                            backgroundColor: isDarkMode ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.04)',
                        },
                    ]}
                >
                    <MaterialIcon name={icon} size={22} color={colors.primary} />
                </View>
                <View style={styles.textContainer}>
                    <Text style={[styles.settingLabel, { color: colors.text }]}>{label}</Text>
                    {description && (
                        <Text style={[styles.settingDescription, { color: colors.textSecondary }]}>
                            {description}
                        </Text>
                    )}
                </View>
            </View>
            <Switch
                trackColor={{ false: colors.border, true: isDarkMode ? 'rgba(221, 31, 71, 0.45)' : '#fca5a5' }}
                thumbColor={value ? colors.primary : '#f4f3f4'}
                ios_backgroundColor="#3e3e3e"
                onValueChange={onValueChange}
                value={value}
            />
        </View>
    );

    return (
        <ScrollView
            style={styles.container}
            contentContainerStyle={styles.contentContainer}
            showsVerticalScrollIndicator={false}
        >
            {/* Direct list of setting rows without section headers */}
            {renderSettingRow(
                'dark-mode',
                t('settings.darkMode'),
                isDarkMode,
                toggleDarkMode,
                t('settings.darkModeDesc')
            )}

            {renderSettingRow(
                'description',
                t('settings.showOffice'),
                showOffice,
                onToggleShowOffice,
                t('settings.showOfficeDesc')
            )}

            {showOffice &&
                renderSettingRow(
                    'visibility',
                    t('settings.openOfficeInApp'),
                    openOfficeInApp,
                    onToggleOpenOfficeInApp,
                    t('settings.openOfficeInAppDesc')
                )}

            {/* Simple rounded About/Credits button from previous version */}
            <View style={styles.aboutContainer}>
                <TouchableOpacity
                    style={[
                        styles.aboutButton,
                        {
                            borderColor: colors.border,
                            backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)',
                        },
                    ]}
                    onPress={onOpenAbout}
                    activeOpacity={0.7}
                >
                    <Text style={[styles.aboutButtonText, { color: colors.text }]}>
                        {t('settings.about')}
                    </Text>
                </TouchableOpacity>
            </View>

            {/* Footer version */}
            <View style={styles.footer}>
                <Text style={[styles.versionText, { color: colors.textSecondary }]}>
                    PDFortuna v0.1.3
                </Text>
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
        paddingTop: 16,
        paddingBottom: 110,
    },
    settingCard: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        padding: 14,
        borderRadius: 14,
        borderWidth: 1,
        marginBottom: 10,
    },
    settingLeft: {
        flexDirection: 'row',
        alignItems: 'center',
        flex: 1,
        paddingRight: 12,
    },
    iconContainer: {
        width: 38,
        height: 38,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    textContainer: {
        flex: 1,
    },
    settingLabel: {
        fontSize: 15,
        fontWeight: '600',
        marginBottom: 2,
    },
    settingDescription: {
        fontSize: 12,
        lineHeight: 16,
    },
    aboutContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 16,
        marginBottom: 10,
    },
    aboutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 12,
        paddingHorizontal: 28,
        borderRadius: 24,
        borderWidth: 1,
    },
    aboutButtonText: {
        fontSize: 15,
        fontWeight: '600',
    },
    footer: {
        alignItems: 'center',
        marginTop: 16,
        marginBottom: 10,
    },
    versionText: {
        fontSize: 13,
        fontWeight: '500',
    },
});
