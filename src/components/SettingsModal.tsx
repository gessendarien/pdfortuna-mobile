import React from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Switch } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { theme } from '../theme';

interface Props {
    visible: boolean;
    onClose: () => void;
    showPreviews: boolean;
    onTogglePreviews: (value: boolean) => void;
    showWord: boolean;
    onToggleShowWord: (value: boolean) => void;
    openWordInApp: boolean;
    onToggleOpenWordInApp: (value: boolean) => void;
    currentViewMode: boolean;
    onToggleViewMode: (value: boolean) => void;
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
    currentViewMode,
    onToggleViewMode,
    showODF,
    onToggleShowODF
}: Props) => {

    const renderSwitch = (label: string, value: boolean, onValueChange: (val: boolean) => void, description?: string) => (
        <View style={styles.optionRow}>
            <View style={styles.textContainer}>
                <Text style={styles.optionLabel}>{label}</Text>
                {description && <Text style={styles.optionDescription}>{description}</Text>}
            </View>
            <Switch
                trackColor={{ false: "#e2e8f0", true: "#a5b4fc" }}
                thumbColor={value ? theme.colors.primary : "#f4f3f4"}
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
                <View style={styles.modalView} onStartShouldSetResponder={() => true}>
                    <View style={styles.header}>
                        <Text style={styles.modalTitle}>Configuración</Text>
                        <TouchableOpacity onPress={onClose}>
                            <MaterialIcon name="close" size={24} color={theme.colors.text} />
                        </TouchableOpacity>
                    </View>

                    <View style={styles.content}>
                        {renderSwitch(
                            "Vista de inicio en cuadrícula",
                            currentViewMode,
                            onToggleViewMode,
                            "Muestra los archivos en modo cuadrícula por defecto"
                        )}

                        {renderSwitch(
                            "Mostrar vista previa",
                            showPreviews,
                            onTogglePreviews,
                            "Muestra miniaturas de la primera página en PDFs (puede consumir más batería)"
                        )}

                        {renderSwitch(
                            "Mostrar documentos Word",
                            showWord,
                            onToggleShowWord,
                            "Incluye archivos .doc y .docx en la lista"
                        )}

                        {showWord && renderSwitch(
                            "Abrir Word en la App",
                            openWordInApp,
                            onToggleOpenWordInApp,
                            "Usa el visor rápido integrado en lugar de abrir una app externa"
                        )}

                        {renderSwitch(
                            "Mostrar documentos ODF",
                            showODF,
                            onToggleShowODF,
                            "Incluye archivos .odt y .odf en la lista"
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
        justifyContent: 'space-between',
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
        color: theme.colors.text,
        fontWeight: '500',
        marginBottom: 4,
    },
    optionDescription: {
        fontSize: 12,
        color: theme.colors.textSecondary,
    }
});
