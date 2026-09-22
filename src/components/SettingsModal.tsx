import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

interface Props {
    visible: boolean;
    onClose: () => void;
    showOffice: boolean;
    onToggleShowOffice: (value: boolean) => void;
    openOfficeInApp: boolean;
    onToggleOpenOfficeInApp: (value: boolean) => void;
    onOpenAbout?: () => void;
}

export const SettingsModal = ({
    visible,
    onClose,
    showOffice,
    onToggleShowOffice,
    openOfficeInApp,
    onToggleOpenOfficeInApp,
    onOpenAbout,
}: Props) => {
    const { colors, isDarkMode, toggleDarkMode } = useTheme();

    const renderSwitch = (label: string, value: boolean, onValueChange: (val: boolean) => void, description?: string) => (
        <View style={styles.optionRow}>
            <View style={styles.textContainer}>
                <Text style={[styles.optionLabel, { color: colors.text }]}>{label}</Text>
                {description && <Text style={[styles.optionDescription, { color: colors.textSecondary }]}>{description}</Text>}
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
                            t('settings.darkMode'),
                            isDarkMode,
                            toggleDarkMode,
                            t('settings.darkModeDesc')
                        )}

                        {renderSwitch(
                            t('settings.showOffice'),
                            showOffice,
                            onToggleShowOffice,
                            t('settings.showOfficeDesc')
                        )}

                        {showOffice && renderSwitch(
                            t('settings.openOfficeInApp'),
                            openOfficeInApp,
                            onToggleOpenOfficeInApp,
                            t('settings.openOfficeInAppDesc')
                        )}

                        {onOpenAbout && (
                            <View style={styles.aboutContainer}>
                                <TouchableOpacity
                                    style={[styles.aboutButton, { borderColor: colors.border, backgroundColor: isDarkMode ? 'rgba(255, 255, 255, 0.05)' : 'rgba(0, 0, 0, 0.03)' }]}
                                    onPress={onOpenAbout}
                                    activeOpacity={0.7}
                                >
                                    <Text style={[styles.aboutButtonText, { color: colors.text }]}>
                                        {t('settings.about')}
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        )}
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
        marginBottom: 20,
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
        lineHeight: 16,
    },
    aboutContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        marginTop: 12,
    },
    aboutButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 20,
        borderWidth: 1,
    },
    aboutButtonText: {
        fontSize: 15,
        fontWeight: '600',
    }
});
