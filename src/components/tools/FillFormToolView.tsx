import React, { useState, useEffect, useMemo } from 'react';
import {
    View,
    Text,
    TextInput,
    TouchableOpacity,
    StyleSheet,
    ScrollView,
    ActivityIndicator,
    Alert,
    Switch,
    Modal,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { PdfToolsService, FormFieldInfo } from '../../services/PdfToolsService';
import { PdfCompactPreview } from './shared/PdfCompactPreview';
import { SaveModeModal } from './shared/SaveModeModal';

interface Props {
    sourcePath: string;
    totalPages?: number;
    onProcess: (
        values: Record<string, string | boolean>,
        flatten: boolean,
        saveMode?: 'original' | 'copy'
    ) => Promise<void>;
    isProcessing: boolean;
}

interface YesNoPair {
    kind: 'yes_no_pair';
    question: string;
    yesField: FormFieldInfo;
    noField: FormFieldInfo;
}

interface SingleItem {
    kind: 'single';
    field: FormFieldInfo;
}

type FormItem = YesNoPair | SingleItem;

const formatFieldLabel = (rawName: string): string => {
    if (!rawName) return 'Campo sin nombre';
    let clean = rawName.trim();
    // Strip technical AcroForm prefixes: e.g. "topmostSubform[0].Page1[0].", "txt_", "chk_", "rad_"
    clean = clean.replace(/^[a-zA-Z0-9_#]+\[\d+\]\./g, '');
    clean = clean.replace(/^(txt_|chk_|rad_|btn_|fld_|text_|checkbox_|radio_)/i, '');

    // If it has underscores but no spaces, replace underscores with spaces
    if (clean.includes('_') && !clean.includes(' ')) {
        clean = clean.replace(/_+/g, ' ');
    }

    if (clean.length > 0) {
        clean = clean.charAt(0).toUpperCase() + clean.slice(1);
    }
    return clean;
};

const groupFormFields = (fields: FormFieldInfo[]): FormItem[] => {
    const items: FormItem[] = [];
    const consumed = new Set<string>();

    const yesPattern = /([_\s:-]|\b)(s[ií]|yes|true)([_\s:-]|\b|$)/i;
    const noPattern = /([_\s:-]|\b)(no|false)([_\s:-]|\b|$)/i;

    const getStem = (name: string): string => {
        return name
            .replace(yesPattern, '')
            .replace(noPattern, '')
            .replace(/[_\s:-]+$/g, '')
            .trim();
    };

    for (let i = 0; i < fields.length; i++) {
        const f1 = fields[i];
        if (consumed.has(f1.name)) continue;

        if (f1.type === 'checkbox') {
            const isF1Yes = yesPattern.test(f1.name);
            const isF1No = noPattern.test(f1.name);

            if (isF1Yes || isF1No) {
                const stem1 = getStem(f1.name);
                let matchIdx = -1;

                for (let j = 0; j < fields.length; j++) {
                    if (i === j) continue;
                    const f2 = fields[j];
                    if (consumed.has(f2.name) || f2.type !== 'checkbox') continue;

                    const isF2Yes = yesPattern.test(f2.name);
                    const isF2No = noPattern.test(f2.name);

                    if ((isF1Yes && isF2No) || (isF1No && isF2Yes)) {
                        const stem2 = getStem(f2.name);
                        if (
                            stem1.toLowerCase() === stem2.toLowerCase() ||
                            stem1.length === 0 ||
                            stem2.length === 0
                        ) {
                            matchIdx = j;
                            break;
                        }
                    }
                }

                if (matchIdx !== -1) {
                    const f2 = fields[matchIdx];
                    consumed.add(f1.name);
                    consumed.add(f2.name);

                    const yesField = isF1Yes ? f1 : f2;
                    const noField = isF1No ? f1 : f2;
                    const rawQuestion = stem1 || getStem(f2.name) || f1.name;

                    items.push({
                        kind: 'yes_no_pair',
                        question: formatFieldLabel(rawQuestion),
                        yesField,
                        noField,
                    });
                    continue;
                }
            }
        }

        consumed.add(f1.name);
        items.push({
            kind: 'single',
            field: f1,
        });
    }

    return items;
};

export const FillFormToolView: React.FC<Props> = ({
    sourcePath,
    totalPages = 1,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    const [fields, setFields] = useState<FormFieldInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [values, setValues] = useState<Record<string, string | boolean>>({});
    const [flatten, setFlatten] = useState(true);

    const [showSaveModal, setShowSaveModal] = useState(false);
    const [dropdownModalField, setDropdownModalField] = useState<FormFieldInfo | null>(null);

    useEffect(() => {
        const loadFields = async () => {
            try {
                const detected = await PdfToolsService.getFormFields(sourcePath);
                setFields(detected);

                // Initialize values with detected values from the document
                const initialValues: Record<string, string | boolean> = {};
                for (const f of detected) {
                    if (f.value !== undefined && f.value !== null && f.value !== '') {
                        initialValues[f.name] = f.value;
                    }
                }
                setValues(initialValues);
            } catch (e) {
                console.warn('Error reading form fields:', e);
            } finally {
                setLoading(false);
            }
        };
        loadFields();
    }, [sourcePath]);

    const formItems = useMemo(() => groupFormFields(fields), [fields]);

    const handleTextChange = (name: string, val: string) => {
        setValues((prev) => ({ ...prev, [name]: val }));
    };

    const handleCheckChange = (name: string, val: boolean) => {
        setValues((prev) => ({ ...prev, [name]: val }));
    };

    const handlePressSave = () => {
        if (Object.keys(values).length === 0) {
            Alert.alert('Atención', 'No has modificado ningún campo del formulario.');
            return;
        }
        setShowSaveModal(true);
    };

    const handleConfirmSave = (saveMode: 'original' | 'copy') => {
        setShowSaveModal(false);
        onProcess(values, flatten, saveMode);
    };

    if (loading) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color={colors.primary} />
                <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                    Detectando campos de formulario...
                </Text>
            </View>
        );
    }

    if (fields.length === 0) {
        return (
            <View style={styles.emptyContainer}>
                <Icon name="assignment-late" size={54} color={colors.textSecondary} />
                <Text style={[styles.emptyTitle, { color: colors.text }]}>Sin campos interactivos</Text>
                <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                    Este PDF no contiene campos AcroForm estándar para rellenar de forma automática.
                </Text>
            </View>
        );
    }

    return (
        <ScrollView style={styles.container} contentContainerStyle={styles.content}>
            <PdfCompactPreview
                sourcePath={sourcePath}
                totalPages={totalPages}
                height={220}
            />

            <View style={[styles.infoBanner, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                <Icon name="check-circle" size={18} color="#10b981" />
                <Text style={[styles.infoText, { color: colors.text }]}>
                    Se encontraron {fields.length} campos editables en este documento.
                </Text>
            </View>

            {formItems.map((item, index) => {
                if (item.kind === 'yes_no_pair') {
                    const isYes = Boolean(values[item.yesField.name]);
                    const isNo = Boolean(values[item.noField.name]);

                    return (
                        <View key={`pair_${item.yesField.name}_${index}`} style={styles.fieldBox}>
                            <Text style={[styles.fieldLabel, { color: colors.text }]}>
                                {item.question}
                            </Text>

                            <View style={styles.radioRow}>
                                <TouchableOpacity
                                    style={[
                                        styles.radioOptionBtn,
                                        {
                                            backgroundColor: isYes
                                                ? 'rgba(221, 31, 71, 0.08)'
                                                : colors.surfaceLight,
                                            borderColor: isYes ? colors.primary : colors.border,
                                        },
                                    ]}
                                    onPress={() => {
                                        setValues((prev) => ({
                                            ...prev,
                                            [item.yesField.name]: true,
                                            [item.noField.name]: false,
                                        }));
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Icon
                                        name={isYes ? 'radio-button-checked' : 'radio-button-unchecked'}
                                        size={22}
                                        color={isYes ? colors.primary : colors.textSecondary}
                                    />
                                    <Text
                                        style={[
                                            styles.radioOptionText,
                                            {
                                                color: isYes ? colors.primary : colors.text,
                                                fontWeight: isYes ? '700' : '500',
                                            },
                                        ]}
                                    >
                                        Sí
                                    </Text>
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={[
                                        styles.radioOptionBtn,
                                        {
                                            backgroundColor: isNo
                                                ? 'rgba(221, 31, 71, 0.08)'
                                                : colors.surfaceLight,
                                            borderColor: isNo ? colors.primary : colors.border,
                                        },
                                    ]}
                                    onPress={() => {
                                        setValues((prev) => ({
                                            ...prev,
                                            [item.yesField.name]: false,
                                            [item.noField.name]: true,
                                        }));
                                    }}
                                    activeOpacity={0.7}
                                >
                                    <Icon
                                        name={isNo ? 'radio-button-checked' : 'radio-button-unchecked'}
                                        size={22}
                                        color={isNo ? colors.primary : colors.textSecondary}
                                    />
                                    <Text
                                        style={[
                                            styles.radioOptionText,
                                            {
                                                color: isNo ? colors.primary : colors.text,
                                                fontWeight: isNo ? '700' : '500',
                                            },
                                        ]}
                                    >
                                        No
                                    </Text>
                                </TouchableOpacity>
                            </View>
                        </View>
                    );
                }

                // Single field item
                const f = item.field;
                const label = formatFieldLabel(f.name || `Campo ${index + 1}`);

                if (f.type === 'radio') {
                    const rawOptions = f.options && f.options.length > 0 ? f.options : ['Sí', 'No'];
                    const currentVal = (values[f.name] as string) || (f.value as string) || '';
                    const isCompactRow =
                        rawOptions.length <= 3 && rawOptions.every((o) => o.length <= 10);

                    return (
                        <View key={`${f.name}_${index}`} style={styles.fieldBox}>
                            <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>

                            <View style={isCompactRow ? styles.radioRow : styles.radioCol}>
                                {rawOptions.map((opt) => {
                                    const isSel = currentVal === opt;
                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            style={[
                                                styles.radioOptionBtn,
                                                {
                                                    backgroundColor: isSel
                                                        ? 'rgba(221, 31, 71, 0.08)'
                                                        : colors.surfaceLight,
                                                    borderColor: isSel ? colors.primary : colors.border,
                                                },
                                            ]}
                                            onPress={() => setValues((prev) => ({ ...prev, [f.name]: opt }))}
                                            activeOpacity={0.7}
                                        >
                                            <Icon
                                                name={isSel ? 'radio-button-checked' : 'radio-button-unchecked'}
                                                size={22}
                                                color={isSel ? colors.primary : colors.textSecondary}
                                            />
                                            <Text
                                                style={[
                                                    styles.radioOptionText,
                                                    {
                                                        color: isSel ? colors.primary : colors.text,
                                                        fontWeight: isSel ? '700' : '500',
                                                    },
                                                ]}
                                            >
                                                {opt}
                                            </Text>
                                        </TouchableOpacity>
                                    );
                                })}
                            </View>
                        </View>
                    );
                }

                if (f.type === 'dropdown') {
                    const currentVal =
                        (values[f.name] as string) ||
                        (f.value as string) ||
                        (f.options && f.options[0]) ||
                        '';

                    return (
                        <View key={`${f.name}_${index}`} style={styles.fieldBox}>
                            <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>

                            <TouchableOpacity
                                style={[
                                    styles.selectBox,
                                    {
                                        backgroundColor: colors.surfaceLight,
                                        borderColor: colors.border,
                                    },
                                ]}
                                onPress={() => setDropdownModalField(f)}
                                activeOpacity={0.7}
                            >
                                <Text
                                    style={[
                                        styles.selectBoxText,
                                        { color: currentVal ? colors.text : colors.textSecondary },
                                    ]}
                                    numberOfLines={1}
                                >
                                    {currentVal || 'Seleccionar opción...'}
                                </Text>
                                <Icon name="arrow-drop-down" size={24} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                    );
                }

                if (f.type === 'checkbox') {
                    const isChecked = Boolean(values[f.name]);
                    return (
                        <View key={`${f.name}_${index}`} style={styles.fieldBox}>
                            <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>

                            <TouchableOpacity
                                style={[
                                    styles.standaloneCheckbox,
                                    {
                                        backgroundColor: isChecked
                                            ? 'rgba(221, 31, 71, 0.08)'
                                            : colors.surfaceLight,
                                        borderColor: isChecked ? colors.primary : colors.border,
                                    },
                                ]}
                                onPress={() => handleCheckChange(f.name, !isChecked)}
                                activeOpacity={0.7}
                            >
                                <Icon
                                    name={isChecked ? 'check-box' : 'check-box-outline-blank'}
                                    size={22}
                                    color={isChecked ? colors.primary : colors.textSecondary}
                                />
                                <Text
                                    style={[
                                        styles.standaloneCheckboxText,
                                        {
                                            color: isChecked ? colors.primary : colors.text,
                                            fontWeight: isChecked ? '700' : '500',
                                        },
                                    ]}
                                >
                                    {isChecked ? 'Marcado (Sí)' : 'Sin marcar (No)'}
                                </Text>
                            </TouchableOpacity>
                        </View>
                    );
                }

                // Default: text field
                return (
                    <View key={`${f.name}_${index}`} style={styles.fieldBox}>
                        <Text style={[styles.fieldLabel, { color: colors.text }]}>{label}</Text>
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.surfaceLight,
                                    borderColor: colors.border,
                                    color: colors.text,
                                },
                            ]}
                            placeholder="Escribe aquí..."
                            placeholderTextColor={colors.textSecondary}
                            value={(values[f.name] as string) || ''}
                            onChangeText={(val) => handleTextChange(f.name, val)}
                        />
                    </View>
                );
            })}

            <View style={styles.flattenRow}>
                <View style={{ flex: 1 }}>
                    <Text style={[styles.flattenTitle, { color: colors.text }]}>Aplanar formulario (Flatten)</Text>
                    <Text style={[styles.flattenDesc, { color: colors.textSecondary }]}>
                        Convierte los campos en texto fijo permanente
                    </Text>
                </View>
                <Switch
                    value={flatten}
                    onValueChange={setFlatten}
                    trackColor={{ false: '#767577', true: colors.primary }}
                />
            </View>

            <TouchableOpacity
                style={[styles.actionBtn, { backgroundColor: colors.primary }]}
                onPress={handlePressSave}
                disabled={isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="save" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Guardar formulario completado</Text>
            </TouchableOpacity>

            {/* SaveModeModal */}
            <SaveModeModal
                visible={showSaveModal}
                onClose={() => setShowSaveModal(false)}
                onConfirm={handleConfirmSave}
                title="¿Cómo deseas guardar el formulario?"
                description="Selecciona una opción para guardar los datos completados:"
            />

            {/* Modal for Dropdown / Select Option Picker */}
            {dropdownModalField && (
                <Modal
                    visible={true}
                    transparent={true}
                    animationType="fade"
                    onRequestClose={() => setDropdownModalField(null)}
                >
                    <View style={styles.modalOverlay}>
                        <View style={[styles.dropdownModalCard, { backgroundColor: colors.surfaceLight }]}>
                            <View style={[styles.dropdownModalHeader, { borderBottomColor: colors.border }]}>
                                <Text style={[styles.dropdownModalTitle, { color: colors.text }]} numberOfLines={1}>
                                    {formatFieldLabel(dropdownModalField.name)}
                                </Text>
                                <TouchableOpacity
                                    onPress={() => setDropdownModalField(null)}
                                    hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                                >
                                    <Icon name="close" size={22} color={colors.text} />
                                </TouchableOpacity>
                            </View>

                            <ScrollView style={{ maxHeight: 300 }}>
                                {(dropdownModalField.options || []).map((opt) => {
                                    const isSel = values[dropdownModalField.name] === opt;
                                    return (
                                        <TouchableOpacity
                                            key={opt}
                                            style={[
                                                styles.dropdownOptionRow,
                                                { borderBottomColor: colors.border },
                                                isSel && { backgroundColor: 'rgba(221, 31, 71, 0.08)' },
                                            ]}
                                            onPress={() => {
                                                setValues((prev) => ({
                                                    ...prev,
                                                    [dropdownModalField.name]: opt,
                                                }));
                                                setDropdownModalField(null);
                                            }}
                                        >
                                            <Text
                                                style={[
                                                    styles.dropdownOptionText,
                                                    { color: isSel ? colors.primary : colors.text },
                                                    isSel && { fontWeight: '700' },
                                                ]}
                                            >
                                                {opt}
                                            </Text>
                                            {isSel && <Icon name="check" size={20} color={colors.primary} />}
                                        </TouchableOpacity>
                                    );
                                })}
                            </ScrollView>
                        </View>
                    </View>
                </Modal>
            )}
        </ScrollView>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    content: {
        padding: 16,
        paddingBottom: 32,
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
    },
    emptyContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 32,
    },
    emptyTitle: {
        fontSize: 16,
        fontWeight: 'bold',
        marginTop: 12,
    },
    emptyText: {
        fontSize: 13,
        textAlign: 'center',
        marginTop: 6,
        lineHeight: 18,
    },
    infoBanner: {
        flexDirection: 'row',
        alignItems: 'center',
        padding: 12,
        borderRadius: 12,
        borderWidth: 1,
        marginBottom: 16,
        gap: 8,
    },
    infoText: {
        fontSize: 13,
        flex: 1,
        flexShrink: 1,
    },
    fieldBox: {
        marginBottom: 14,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 8,
    },
    input: {
        height: 46,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        fontSize: 14,
    },
    radioRow: {
        flexDirection: 'row',
        gap: 12,
    },
    radioCol: {
        gap: 8,
    },
    radioOptionBtn: {
        flex: 1,
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        gap: 8,
    },
    radioOptionText: {
        fontSize: 14,
    },
    selectBox: {
        height: 46,
        borderRadius: 12,
        borderWidth: 1,
        paddingHorizontal: 12,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
    },
    selectBoxText: {
        fontSize: 14,
        flex: 1,
    },
    standaloneCheckbox: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 12,
        borderRadius: 12,
        borderWidth: 1.5,
        gap: 10,
    },
    standaloneCheckboxText: {
        fontSize: 13,
    },
    flattenRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginVertical: 16,
        paddingTop: 12,
        borderTopWidth: StyleSheet.hairlineWidth,
        borderTopColor: 'rgba(150,150,150,0.2)',
    },
    flattenTitle: {
        fontSize: 13,
        fontWeight: '700',
    },
    flattenDesc: {
        fontSize: 11,
        marginTop: 2,
    },
    actionBtn: {
        marginTop: 16,
        height: 48,
        borderRadius: 14,
        flexDirection: 'row',
        justifyContent: 'center',
        alignItems: 'center',
        elevation: 4,
    },
    actionBtnText: {
        color: '#ffffff',
        fontSize: 15,
        fontWeight: 'bold',
    },
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 20,
    },
    dropdownModalCard: {
        width: '100%',
        maxWidth: 380,
        borderRadius: 16,
        overflow: 'hidden',
        elevation: 8,
    },
    dropdownModalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: 1,
    },
    dropdownModalTitle: {
        fontSize: 15,
        fontWeight: 'bold',
        flex: 1,
        marginRight: 10,
    },
    dropdownOptionRow: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
        borderBottomWidth: StyleSheet.hairlineWidth,
    },
    dropdownOptionText: {
        fontSize: 14,
        flex: 1,
    },
});
