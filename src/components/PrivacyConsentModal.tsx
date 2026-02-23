import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';
import Icon from 'react-native-vector-icons/MaterialIcons';

const PRIVACY_URL = 'https://gessendarien.github.io/pdfortuna-mobile/#policy';

interface Props {
    visible: boolean;
    onAccept: () => void;
}

export const PrivacyConsentModal = ({ visible, onAccept }: Props) => {
    const { colors } = useTheme();
    const [declined, setDeclined] = useState(false);

    const handleLinkPress = () => {
        Linking.openURL(PRIVACY_URL);
    };

    const handleDecline = () => {
        setDeclined(true);
    };

    const message = declined ? t('privacy.requiredMessage') : t('privacy.message');

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={() => { }}
        >
            <View style={styles.overlay}>
                <View style={[styles.content, { backgroundColor: colors.surfaceLight }]}>
                    <View style={styles.iconContainer}>
                        <Icon name="privacy-tip" size={48} color={colors.primary} />
                    </View>

                    <Text style={[styles.title, { color: colors.text }]}>
                        {t('privacy.title')}
                    </Text>

                    {declined && (
                        <View style={[styles.warningBanner, { backgroundColor: colors.error + '18' }]}>
                            <Icon name="warning" size={18} color={colors.error} />
                            <Text style={[styles.warningText, { color: colors.error }]}>
                                {t('privacy.requiredMessage').split('.')[0]}.
                            </Text>
                        </View>
                    )}

                    <Text style={[styles.message, { color: colors.textSecondary }]}>
                        {declined
                            ? message.split('.').slice(1).join('.').trim()
                            : message
                        }
                    </Text>

                    <TouchableOpacity onPress={handleLinkPress} style={styles.linkContainer}>
                        <Icon name="open-in-new" size={16} color={colors.primary} />
                        <Text style={[styles.linkText, { color: colors.primary }]}>
                            {t('privacy.linkText')}
                        </Text>
                    </TouchableOpacity>

                    <View style={styles.buttonsContainer}>
                        <TouchableOpacity style={styles.declineButton} onPress={handleDecline}>
                            <Text style={[styles.declineButtonText, { color: colors.textSecondary }]}>
                                {t('privacy.decline')}
                            </Text>
                        </TouchableOpacity>

                        <TouchableOpacity
                            style={[styles.acceptButton, { backgroundColor: colors.primary }]}
                            onPress={onAccept}
                        >
                            <Text style={styles.acceptButtonText}>
                                {t('privacy.accept')}
                            </Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.6)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        width: '100%',
        maxWidth: 340,
        borderRadius: 20,
        padding: 24,
        elevation: 8,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 6,
    },
    iconContainer: {
        alignItems: 'center',
        marginBottom: 12,
    },
    title: {
        fontSize: 22,
        fontWeight: 'bold',
        textAlign: 'center',
        marginBottom: 16,
    },
    warningBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 10,
        borderRadius: 10,
        marginBottom: 12,
        gap: 8,
    },
    warningText: {
        fontSize: 13,
        fontWeight: '600',
        flex: 1,
        lineHeight: 18,
    },
    message: {
        fontSize: 15,
        lineHeight: 22,
        textAlign: 'center',
        marginBottom: 16,
    },
    linkContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        marginBottom: 24,
        paddingVertical: 8,
    },
    linkText: {
        fontSize: 15,
        fontWeight: '600',
        textDecorationLine: 'underline',
    },
    buttonsContainer: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        gap: 12,
    },
    declineButton: {
        paddingVertical: 12,
        paddingHorizontal: 16,
        borderRadius: theme.borderRadius.m,
    },
    declineButtonText: {
        fontSize: 16,
        fontWeight: '500',
    },
    acceptButton: {
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: theme.borderRadius.m,
    },
    acceptButtonText: {
        fontSize: 16,
        color: '#fff',
        fontWeight: '600',
    },
});
