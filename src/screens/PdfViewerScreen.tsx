import React, { useLayoutEffect, useState, useRef, useCallback } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Animated, Text } from 'react-native';
import Pdf from 'react-native-pdf';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { theme } from '../theme';
import { MarqueeText } from '../components/MarqueeText';

export const PdfViewerScreen = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { uri, name, isExternal } = route.params;

    const isContentUri = uri.startsWith('content://');
    const showSaveButton = isExternal || isContentUri;

    // Toast state
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const toastAnim = useRef(new Animated.Value(-80)).current;
    const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const [isSharing, setIsSharing] = useState(false);

    const showToast = useCallback((message: string, type: 'success' | 'error' = 'success') => {
        if (toastTimeout.current) clearTimeout(toastTimeout.current);

        setToastMessage(message);
        setToastType(type);
        setToastVisible(true);

        Animated.spring(toastAnim, {
            toValue: 12,
            useNativeDriver: true,
            friction: 8,
            tension: 60,
        }).start();

        toastTimeout.current = setTimeout(() => {
            Animated.timing(toastAnim, {
                toValue: -80,
                duration: 250,
                useNativeDriver: true,
            }).start(() => setToastVisible(false));
        }, 2500);
    }, [toastAnim]);

    const handleSave = async () => {
        try {
            let safeName = name || 'documento.pdf';
            if (!safeName.toLowerCase().endsWith('.pdf')) {
                safeName += '.pdf';
            }
            safeName = safeName.replace(/[^a-zA-Z0-9._\- ]/g, '_');

            const destPath = `${RNFS.DownloadDirectoryPath}/${safeName}`;
            const exists = await RNFS.exists(destPath);

            let finalDestPath = destPath;
            if (exists) {
                const timestamp = new Date().getTime();
                const nameParts = safeName.split('.');
                const ext = nameParts.pop();
                const base = nameParts.join('.');
                finalDestPath = `${RNFS.DownloadDirectoryPath}/${base}_${timestamp}.${ext}`;
            }

            console.log("Reading from:", uri);
            const base64Data = await RNFS.readFile(uri, 'base64');
            console.log("Writing to:", finalDestPath);
            await RNFS.writeFile(finalDestPath, base64Data, 'base64');

            try {
                await RNFS.scanFile(finalDestPath);
            } catch (scanErr) { console.log('Scan error', scanErr); }

            showToast('Guardado en Descargas ✓', 'success');
        } catch (error) {
            console.log("Error saving file:", error);
            try {
                let safeName = name || 'documento.pdf';
                if (!safeName.toLowerCase().endsWith('.pdf')) safeName += '.pdf';
                safeName = safeName.replace(/[^a-zA-Z0-9._\- ]/g, '_');
                const destPath = `${RNFS.DownloadDirectoryPath}/${safeName}`;
                await RNFS.copyFile(uri, destPath);
                await RNFS.scanFile(destPath);
                showToast('Guardado en Descargas ✓', 'success');
            } catch (e) {
                showToast('No se pudo guardar', 'error');
            }
        }
    };

    const handleShare = async () => {
        if (isSharing) return;
        setIsSharing(true);

        let tempPath = '';
        try {
            let safeName = (name || 'documento.pdf').replace(/[^a-zA-Z0-9._\- ]/g, '_');
            // Ensure .pdf extension so Android recognizes the MIME type
            if (!safeName.toLowerCase().endsWith('.pdf')) {
                safeName += '.pdf';
            }
            tempPath = `${RNFS.CachesDirectoryPath}/${safeName}`;

            // Copy to cache for sharing (works for content:// and file://)
            if (await RNFS.exists(tempPath)) {
                await RNFS.unlink(tempPath);
            }

            // For content:// URIs, read base64 then write
            if (isContentUri) {
                const base64Data = await RNFS.readFile(uri, 'base64');
                await RNFS.writeFile(tempPath, base64Data, 'base64');
            } else {
                await RNFS.copyFile(uri, tempPath);
            }

            await Share.open({
                url: `file://${tempPath}`,
                type: 'application/pdf',
                filename: safeName,
                title: 'Compartir Archivo',
                failOnCancel: false,
            });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                console.log('Share error:', error);
                // Fallback: try base64 share
                try {
                    const base64Data = await RNFS.readFile(uri, 'base64');
                    await Share.open({
                        url: `data:application/pdf;base64,${base64Data}`,
                        title: 'Compartir Archivo',
                        type: 'application/pdf',
                        failOnCancel: false,
                        filename: name || 'documento.pdf',
                    });
                } catch (err2) {
                    showToast('No se pudo compartir', 'error');
                }
            }
        } finally {
            setIsSharing(false);
            if (tempPath) {
                try {
                    if (await RNFS.exists(tempPath)) await RNFS.unlink(tempPath);
                } catch (_) { }
            }
        }
    };

    const displayName = name || 'Documento';

    useLayoutEffect(() => {
        navigation.setOptions({
            headerTitle: () => (
                <View style={styles.headerTitleContainer}>
                    <MarqueeText text={displayName} style={styles.headerTitleText} />
                </View>
            ),
            headerRight: () => (
                <View style={styles.headerButtons}>
                    <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
                        <MaterialIcon name="share" size={22} color={theme.colors.primary} />
                    </TouchableOpacity>
                    {showSaveButton && (
                        <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                            <MaterialIcon name="save-alt" size={22} color={theme.colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            ),
        });
    }, [navigation, showSaveButton, displayName]);

    const source = { uri, cache: true };

    return (
        <View style={styles.container}>
            <Pdf
                source={source}
                onLoadComplete={(numberOfPages) => {
                    console.log(`Number of pages: ${numberOfPages}`);
                }}
                onPageChanged={(page) => {
                    console.log(`Current page: ${page}`);
                }}
                onError={(error) => {
                    console.log(error);
                }}
                onPressLink={(linkUri) => {
                    console.log(`Link pressed: ${linkUri}`);
                }}
                style={styles.pdf}
                trustAllCerts={false}
            />

            {/* Floating Toast */}
            {toastVisible && (
                <Animated.View
                    style={[
                        styles.toast,
                        {
                            backgroundColor: toastType === 'success' ? theme.colors.success : theme.colors.error,
                            transform: [{ translateY: toastAnim }],
                        },
                    ]}
                >
                    <MaterialIcon
                        name={toastType === 'success' ? 'check-circle' : 'error'}
                        size={20}
                        color="#fff"
                        style={{ marginRight: 8 }}
                    />
                    <Text style={styles.toastText}>{toastMessage}</Text>
                </Animated.View>
            )}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: theme.colors.backgroundLight,
    },
    pdf: {
        flex: 1,
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
        backgroundColor: theme.colors.backgroundLight,
    },
    headerTitleContainer: {
        maxWidth: Dimensions.get('window').width * 0.65,
    },
    headerTitleText: {
        fontSize: 17,
        fontWeight: '600',
        color: theme.colors.text,
    },
    headerButtons: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
    },
    headerBtn: {
        padding: 6,
    },
    toast: {
        position: 'absolute',
        top: 0,
        left: 20,
        right: 20,
        paddingVertical: 12,
        paddingHorizontal: 18,
        borderRadius: 12,
        flexDirection: 'row',
        alignItems: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.2,
        shadowRadius: 8,
        elevation: 6,
    },
    toastText: {
        color: '#fff',
        fontSize: 15,
        fontWeight: '600',
        flex: 1,
    },
});
