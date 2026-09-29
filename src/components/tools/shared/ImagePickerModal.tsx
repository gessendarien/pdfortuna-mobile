import React, { useState, useEffect } from 'react';
import {
    Modal,
    View,
    Text,
    TouchableOpacity,
    FlatList,
    Image,
    ActivityIndicator,
    StyleSheet,
} from 'react-native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme/ThemeContext';
import { LocalImage, scanDeviceImages } from '../../../services/FileService';

interface ImagePickerModalProps {
    visible: boolean;
    onClose: () => void;
    onSelectImage: (image: LocalImage) => void;
    title?: string;
}

export const ImagePickerModal: React.FC<ImagePickerModalProps> = ({
    visible,
    onClose,
    onSelectImage,
    title = 'Seleccionar imagen',
}) => {
    const { colors } = useTheme();
    const [images, setImages] = useState<LocalImage[]>([]);
    const [loading, setLoading] = useState<boolean>(false);

    useEffect(() => {
        if (visible) {
            loadImages();
        }
    }, [visible]);

    const loadImages = async () => {
        setLoading(true);
        try {
            const list = await scanDeviceImages();
            setImages(list);
        } catch (e) {
            console.warn('Error reading device images:', e);
        } finally {
            setLoading(false);
        }
    };

    return (
        <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
            <View style={styles.modalBackdrop}>
                <View style={[styles.modalCard, { backgroundColor: colors.surfaceLight }]}>
                    <View style={styles.modalHeader}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                            <Icon name="photo-library" size={22} color={colors.primary} />
                            <Text style={[styles.modalTitle, { color: colors.text }]}>{title}</Text>
                        </View>
                        <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Icon name="close" size={24} color={colors.text} />
                        </TouchableOpacity>
                    </View>

                    {loading ? (
                        <View style={styles.loadingContainer}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                                Buscando imágenes del dispositivo...
                            </Text>
                        </View>
                    ) : images.length === 0 ? (
                        <View style={styles.emptyContainer}>
                            <Icon name="image-not-supported" size={48} color={colors.textSecondary} />
                            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
                                No se encontraron imágenes en las carpetas comunes del teléfono (Imágenes, Descargas, Cámara).
                            </Text>
                        </View>
                    ) : (
                        <FlatList
                            data={images}
                            keyExtractor={(item) => item.path}
                            numColumns={3}
                            renderItem={({ item }) => (
                                <TouchableOpacity
                                    style={[styles.gridImageItem, { borderColor: colors.border }]}
                                    onPress={() => onSelectImage(item)}
                                    activeOpacity={0.75}
                                >
                                    <Image source={{ uri: item.uri }} style={styles.gridImage} resizeMode="cover" />
                                </TouchableOpacity>
                            )}
                            style={{ maxHeight: 420 }}
                            contentContainerStyle={{ paddingBottom: 16 }}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.65)',
        justifyContent: 'flex-end',
    },
    modalCard: {
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 16,
    },
    modalTitle: {
        fontSize: 17,
        fontWeight: 'bold',
    },
    loadingContainer: {
        paddingVertical: 48,
        alignItems: 'center',
    },
    loadingText: {
        marginTop: 12,
        fontSize: 13,
    },
    emptyContainer: {
        paddingVertical: 40,
        alignItems: 'center',
        paddingHorizontal: 24,
    },
    emptyText: {
        textAlign: 'center',
        marginTop: 12,
        fontSize: 13,
        lineHeight: 18,
    },
    gridImageItem: {
        flex: 1 / 3,
        aspectRatio: 1,
        margin: 4,
        borderRadius: 10,
        overflow: 'hidden',
        borderWidth: 1,
        backgroundColor: '#000000',
    },
    gridImage: {
        width: '100%',
        height: '100%',
    },
});
