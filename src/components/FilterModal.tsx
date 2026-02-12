import React, { useState } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, Dimensions } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import MaterialCommunityIcons from 'react-native-vector-icons/MaterialCommunityIcons';
import { theme } from '../theme';

interface Props {
    visible: boolean;
    currentFilter: 'all' | 'pdf' | 'doc' | 'odf';
    onClose: () => void;
    onSelect: (filter: 'all' | 'pdf' | 'doc' | 'odf') => void;
    showDoc?: boolean;
    showODF?: boolean;
    showAll?: boolean;
}

export const FilterModal = ({ visible, currentFilter, onClose, onSelect, showDoc = true, showODF = true, showAll = true }: Props) => {

    // Helper for rendering an option
    const renderOption = (
        value: 'all' | 'pdf' | 'doc' | 'odf',
        label: string,
        iconName: string,
        iconColor: string,
        IconComponent: any = Icon,
        disabled: boolean = false
    ) => {
        const isSelected = currentFilter === value;

        return (
            <TouchableOpacity
                style={[styles.option, isSelected && styles.optionSelected]}
                onPress={disabled ? undefined : () => onSelect(value)}
                disabled={disabled}
            >
                <View style={[styles.optionIconContainer, { backgroundColor: isSelected ? iconColor + '20' : '#f1f5f9' }]}>
                    <IconComponent name={iconName} size={24} color={isSelected ? iconColor : theme.colors.textSecondary} />
                </View>
                <Text style={[styles.optionText, isSelected && { color: theme.colors.text, fontWeight: '600' }, disabled && { opacity: 0.5 }]}>
                    {label}
                </Text>
                {isSelected && (
                    <Icon name="check" size={20} color={theme.colors.primary} style={styles.checkIcon} />
                )}
            </TouchableOpacity>
        );
    };

    return (
        <Modal
            transparent
            visible={visible}
            animationType="fade"
            onRequestClose={onClose}
        >
            <TouchableOpacity style={styles.overlay} activeOpacity={1} onPress={onClose}>
                <TouchableOpacity activeOpacity={1} style={styles.content}>
                    <Text style={styles.title}>Filtrar por tipo</Text>

                    {showAll && renderOption('all', 'Todos', 'dashboard', theme.colors.primary)}
                    {renderOption('pdf', 'PDF', 'file-pdf-box', '#ef4444', MaterialCommunityIcons, !showAll && !showDoc && !showODF)}
                    {showDoc && renderOption('doc', 'Word', 'file-word-box', '#3b82f6', MaterialCommunityIcons)}
                    {showODF && renderOption('odf', 'ODF', 'text-box', '#f59e0b', MaterialCommunityIcons)}

                    <TouchableOpacity style={styles.buttonClose} onPress={onClose}>
                        <Text style={styles.buttonCloseText}>Cancelar</Text>
                    </TouchableOpacity>
                </TouchableOpacity>
            </TouchableOpacity>
        </Modal>
    );
};

const styles = StyleSheet.create({
    overlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    content: {
        width: '100%',
        maxWidth: 320,
        backgroundColor: '#fff',
        borderRadius: 20,
        padding: 20,
        elevation: 5,
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    title: {
        fontSize: 18,
        fontWeight: 'bold',
        color: theme.colors.text,
        marginBottom: 16,
        textAlign: 'center',
    },
    option: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        marginBottom: 8,
    },
    optionSelected: {
        backgroundColor: '#f8fafc',
    },
    optionIconContainer: {
        width: 36,
        height: 36,
        borderRadius: 18,
        justifyContent: 'center',
        alignItems: 'center',
        marginRight: 12,
    },
    optionText: {
        fontSize: 16,
        color: theme.colors.textSecondary,
        flex: 1,
    },
    checkIcon: {
        marginLeft: 8,
    },
    buttonClose: {
        marginTop: 12,
        alignItems: 'center',
        paddingVertical: 12,
    },
    buttonCloseText: {
        color: theme.colors.textSecondary,
        fontSize: 16,
        fontWeight: '500',
    }
});
