import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Linking } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme';

interface Props {
    visible: boolean;
    onClose: () => void;
}

export const CreditsModal = ({ visible, onClose }: Props) => {
    // Replace with the actual repository URL
    const githubUrl = 'https://github.com/gessperera/PDFortuna';

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
                <View style={styles.modalView} onStartShouldSetResponder={() => true}>
                    <View style={styles.header}>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcon name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        <View style={styles.logoContainer}>
                            <Text style={styles.appName}>PDFortuna</Text>
                            <Text style={styles.version}>v0.0.1</Text>
                        </View>

                        <Text style={styles.sectionTitle}>Créditos</Text>
                        <Text style={styles.text}>
                            Desarrollado con 💚 por Gessén Darién de Cassca Studios.
                        </Text>

                        <Text style={styles.sectionTitle}>Privacidad y Licencia</Text>
                        <Text style={styles.text}>
                            Esta app no envía ninguna información a servidores externos y todos los datos permanecen en tu dispositivo por lo que tu privacidad está protegida, además es libre y de {""}
                            <Text style={{ color: theme.colors.primary, fontWeight: 'bold' }} onPress={handleLink}>
                                código abierto.
                            </Text>
                        </Text>

                        <Text style={styles.sectionTitle}>Versión Pro</Text>
                        <Text style={styles.text}>
                            Esta es una app gratuita y libre pero puedes eliminar la publicidad y apoyar el proyecto comprando la versión PRO sin anuncios.
                        </Text>

                        <TouchableOpacity
                            style={styles.proButton}
                            onPress={() => Linking.openURL('https://play.google.com/store/apps/details?id=com.pdfortuna.pro').catch(() => { })}
                        >
                            <MaterialIcon name="verified" size={24} color="#fff" style={{ marginRight: 8 }} />
                            <Text style={styles.githubButtonText}>Obtener Versión PRO</Text>
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
        backgroundColor: "white",
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
    modalTitle: {
        fontSize: 20,
        fontWeight: "bold",
        color: theme.colors.text,
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
        color: theme.colors.primary,
        marginTop: 8,
    },
    version: {
        fontSize: 14,
        color: theme.colors.textSecondary,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginTop: 16,
        marginBottom: 8,
        alignSelf: 'flex-start',
        width: '100%',
    },
    text: {
        fontSize: 14,
        color: theme.colors.textSecondary,
        marginBottom: 8,
        lineHeight: 20,
        alignSelf: 'flex-start',
    },
    githubButton: {
        flexDirection: 'row',
        backgroundColor: '#333',
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 24,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    },
    githubButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    proButton: {
        flexDirection: 'row',
        backgroundColor: theme.colors.primary,
        paddingVertical: 12,
        paddingHorizontal: 24,
        borderRadius: 8,
        marginTop: 24,
        alignItems: 'center',
        width: '100%',
        justifyContent: 'center',
    }
});
