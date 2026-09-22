import React, { useState, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet, ScrollView, ActivityIndicator, Alert, Switch } from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { PdfToolsService, FormFieldInfo } from '../../services/PdfToolsService';

interface Props {
    sourcePath: string;
    onProcess: (values: Record<string, string | boolean>, flatten: boolean) => Promise<void>;
    isProcessing: boolean;
}

export const FillFormToolView: React.FC<Props> = ({
    sourcePath,
    onProcess,
    isProcessing,
}) => {
    const { colors } = useTheme();
    const [fields, setFields] = useState<FormFieldInfo[]>([]);
    const [loading, setLoading] = useState(true);
    const [values, setValues] = useState<Record<string, string | boolean>>({});
    const [flatten, setFlatten] = useState(true);

    useEffect(() => {
        const loadFields = async () => {
            try {
                const detected = await PdfToolsService.getFormFields(sourcePath);
                setFields(detected);
            } catch (e) {
                console.warn('Error reading form fields:', e);
            } finally {
                setLoading(false);
            }
        };
        loadFields();
    }, [sourcePath]);

    const handleTextChange = (name: string, val: string) => {
        setValues((prev) => ({ ...prev, [name]: val }));
    };

    const handleCheckChange = (name: string, val: boolean) => {
        setValues((prev) => ({ ...prev, [name]: val }));
    };

    const handleSave = () => {
        if (Object.keys(values).length === 0) {
            Alert.alert('Atención', 'No has modificado ningún campo del formulario.');
            return;
        }
        onProcess(values, flatten);
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
            <View style={[styles.infoBanner, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                <Icon name="check-circle" size={18} color="#10b981" />
                <Text style={[styles.infoText, { color: colors.text }]}>
                    Se encontraron {fields.length} campos editables en este documento.
                </Text>
            </View>

            {fields.map((f, i) => (
                <View key={`${f.name}_${i}`} style={styles.fieldBox}>
                    <Text style={[styles.fieldLabel, { color: colors.text }]}>
                        {f.name || `Campo ${i + 1}`}
                    </Text>

                    {f.type === 'checkbox' ? (
                        <View style={styles.switchRow}>
                            <Text style={{ color: colors.textSecondary, fontSize: 13 }}>Marcar casilla</Text>
                            <Switch
                                value={Boolean(values[f.name])}
                                onValueChange={(val) => handleCheckChange(f.name, val)}
                                trackColor={{ false: '#767577', true: colors.primary }}
                            />
                        </View>
                    ) : (
                        <TextInput
                            style={[
                                styles.input,
                                {
                                    backgroundColor: colors.surfaceLight,
                                    borderColor: colors.border,
                                    color: colors.text,
                                },
                            ]}
                            placeholder={`Escribe aquí...`}
                            placeholderTextColor={colors.textSecondary}
                            value={(values[f.name] as string) || ''}
                            onChangeText={(val) => handleTextChange(f.name, val)}
                        />
                    )}
                </View>
            ))}

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
                onPress={handleSave}
                disabled={isProcessing}
                activeOpacity={0.8}
            >
                <Icon name="save" size={20} color="#ffffff" style={{ marginRight: 8 }} />
                <Text style={styles.actionBtnText}>Guardar formulario completado</Text>
            </TouchableOpacity>
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
    },
    fieldBox: {
        marginBottom: 14,
    },
    fieldLabel: {
        fontSize: 13,
        fontWeight: '600',
        marginBottom: 6,
    },
    input: {
        height: 46,
        borderWidth: 1,
        borderRadius: 12,
        paddingHorizontal: 12,
        fontSize: 14,
    },
    switchRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        height: 46,
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
});
