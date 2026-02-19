import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Switch, Linking } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

interface Props {
    visible: boolean;
    onClose: () => void;
    showPreviews: boolean;
    onTogglePreviews: (value: boolean) => void;
    showWord: boolean;
    onToggleShowWord: (value: boolean) => void;
    openWordInApp: boolean;
    onToggleOpenWordInApp: (value: boolean) => void;
    startupViewMode: boolean;
    onToggleStartupViewMode: (value: boolean) => void;
    showODF: boolean;
    onToggleShowODF: (value: boolean) => void;
}

export const SettingsModal = ({
    visible,
    onClose,
    showPreviews,
    onTogglePreviews,
    showWord,
    onToggleShowWord,
    openWordInApp,
    onToggleOpenWordInApp,
    startupViewMode,
    onToggleStartupViewMode,
    showODF,
    onToggleShowODF
}: Props) => {
    const { colors, isDarkMode, toggleDarkMode } = useTheme();

    const renderSwitch = (label: string, value: boolean, onValueChange: (val: boolean) => void, description?: string) => (
        <View style={styles.optionRow}>
            <View style={styles.textContainer}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
                {description && <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>{description}</Text>}
            </View>
            <Switch
                trackColor={{ false: colors.border, true: "#a5b4fc" }}
                thumbColor={value ? colors.primary : "#f4f3f4"}
                ios_backgroundColor="#3e3e3e"
                onValueChange={onValueChange}
                value={value}
            />
        </View>
    );

    return (
        <Modal
            animationType="slide"
            transparent={true}
            visible={visible}
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.centeredView} activeOpacity={1} onPress={onClose}>
                <View style={[styles.modalView, { backgroundColor: colors.surfaceLight }]} onStartShouldSetResponder={() => true}>
                    <View style={styles.header}>
                        <Text style={[styles.modalTitle, { color: colors.text }]}>{t('settings.title')}</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcon name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {renderSwitch(
                            t('settings.gridView'),
                            startupViewMode,
                            onToggleStartupViewMode,
                            t('settings.gridViewDesc')
                        )}

                        {renderSwitch(
                            t('settings.previews'),
                            showPreviews,
                            onTogglePreviews,
                            t('settings.previewsDesc')
                        )}

                        {renderSwitch(
                            t('settings.showWord'),
                            showWord,
                            onToggleShowWord,
                            t('settings.showWordDesc')
                        )}

                        {showWord && renderSwitch(
                            t('settings.openWordInApp'),
                            openWordInApp,
                            onToggleOpenWordInApp,
                            t('settings.openWordInAppDesc')
                        )}

                        {renderSwitch(
                            t('settings.showODF'),
                            showODF,
                            onToggleShowODF,
                            t('settings.showODFDesc')
                        )}

                        {renderSwitch(
                            t('settings.darkMode'),
                            isDarkMode,
                            toggleDarkMode,
                            t('settings.darkModeDesc')
                        )}

                        {/* Remove Ads Option */}
                        <TouchableOpacity
                            style={styles.optionRow}
                            onPress={() => Linking.openURL("https://play.google.com/store/apps/details?id=com.gess.pdfortunapro")}
                        >
                            <View style={styles.textContainer}>
                                <Text style={[styles.optionLabel, { color: colors.text }]}>
                                    {t('settings.removeAds')}
                                </Text>
                                <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>
                                    {t('settings.removeAdsDesc')}
                                </Text>
                            </View>
                            <MaterialIcon name="star" size={24} color={colors.primary} />
                        </TouchableOpacity>
                    </View>
                </View>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    centeredView: {
        flex: 1,
        justifyContent: "flex-end",
        backgroundColor: "rgba(0,0,0,0.5)"
    },
    modalView: {
        borderTopLeftRadius: 20,
        borderTopRightRadius: 20,
        padding: 24,
        shadowColor: "#000",
        shadowOffset: {
            width: 0,
            height: -2
        },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 5,
        width: '100%',
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
    },
    content: {
        paddingBottom: 24,
    },
    optionRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 24,
    },
    textContainer: {
        flex: 1,
        paddingRight: 16,
    },
    optionLabel: {
        fontSize: 16,
        fontWeight: '500',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 12,
    }
});
