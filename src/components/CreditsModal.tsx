import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export const CreditsModal = ({ visible, onClose }: Props) => {
    const { colors } = useTheme();
    const githubUrl = 'https://github.com/gessendarien/pdfortuna-mobile';

    const handleLink = () => {
        Linking.openURL(githubUrl).catch(err => console.error("Couldn't load page", err));
    };

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
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcon name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.logoContainer}>
                            <Text style={[styles.appName, { color: colors.primary }]}>PDFortuna</Text>
                            <Text style={[styles.version, { color: colors.textSecondary }]}>v0.0.1</Text>
                        </View>

                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('credits.credits')}</Text>
                        <Text style={[styles.text, { color: colors.textSecondary }]}>
                            {t('credits.developedBy')}
                        </Text>

                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('credits.privacyTitle')}</Text>
                        <Text style={[styles.text, { color: colors.textSecondary }]}>
                            {t('credits.privacyText')}
                            <Text style={{ color: colors.primary, fontWeight: 'bold' }} onPress={handleLink}>
                                {t('credits.sourceCode')}
                            </Text>
                        </Text>

                        <Text style={[styles.sectionTitle, { color: colors.text }]}>{t('credits.proTitle')}</Text>
                        <Text style={[styles.text, { color: colors.textSecondary }]}>
                            {t('credits.proText')}
                        </Text>

                        <TouchableOpacity
                            style={[styles.proButton, { backgroundColor: colors.primary }]}
                            onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.pdfortuna.pro').catch(() => { })}
                        >
                            <MaterialIcon name="verified" size={24} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.githubButtonText}>{t('credits.proButton')}</Text>
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
        justifyContent: 'flex-end',
        alignItems: 'center',
        marginBottom: 24,
    },
    content: {
        paddingBottom: 24,
        alignItems: 'center'
    },
    logoContainer: {
        alignItems: 'center',
        marginBottom: 24,
    },
    appName: {
        fontSize: 24,
        fontWeight: 'bold',
        marginTop: 8,
    },
    version: {
        fontSize: 14,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 16,
        marginBottom: 8,
        alignSelf: 'flex-start',
        width: '100%',
    },
    text: {
        fontSize: 14,
        marginBottom: 8,
        lineHeight: 20,
        alignSelf: 'flex-start',
    },
    githubButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    proButton: {
        flexDirection: 'row',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 24,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    }
});
