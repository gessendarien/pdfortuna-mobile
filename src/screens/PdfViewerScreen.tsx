import React, { useLayoutEffect, useState, useRef, useCallback, useEffect } from 'react';
import { View, StyleSheet, Dimensions, TouchableOpacity, Animated, Text, ActivityIndicator, AppState, AppStateStatus } from 'react-native';
import Pdf from 'react-native-pdf';
import { useNavigation, useRoute } from '@react-navigation/native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import RNFS from 'react-native-fs';
import Share from 'react-native-share';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { StorageService } from '../services/StorageService';
import { t } from '../i18n';
import { MarqueeText } from '../components/MarqueeText';
import { RenameModal } from '../components/RenameModal';

export const PdfViewerScreen = () => {
    const navigation = useNavigation();
    const route = useRoute<any>();
    const { uri, name, isExternal } = route.params;
    const { colors } = useTheme();

    const isContentUri = uri.startsWith('content://');
    const showSaveButton = isExternal || isContentUri;

    // Toast state
    const [toastVisible, setToastVisible] = useState(false);
    const [toastMessage, setToastMessage] = useState('');
    const [toastType, setToastType] = useState<'success' | 'error'>('success');
    const toastAnim = useRef(new Animated.Value(-80)).current;
    const toastTimeout = useRef<ReturnType<typeof setTimeout> | null>(null);
    const isSharingRef = useRef(false); // Use Ref for synchronous locking
    const isSavingRef = useRef(false);  // Use Ref for synchronous locking (Save)
    const [saveModalVisible, setSaveModalVisible] = useState(false);
    const [isLoading, setIsLoading] = useState(true);
    const [loadProgress, setLoadProgress] = useState(0);
    const loadingOpacity = useRef(new Animated.Value(1)).current;

    // Resume reading state
    const [initialPage, setInitialPage] = useState<number | null>(null);
    const currentPageRef = useRef<number>(1);

    // Load saved page
    useEffect(() => {
        let isMounted = true;
        const loadPage = async () => {
            const page = await StorageService.getPage(uri);
            if (isMounted) {
                setInitialPage(page || 1);
                currentPageRef.current = page || 1;
            }
        };
        loadPage();
        return () => { isMounted = false; };
    }, [uri]);

    // Save page on unmount or background
    useEffect(() => {
        const handleAppStateChange = (nextAppState: AppStateStatus) => {
            if (nextAppState.match(/inactive|background/)) {
                StorageService.savePage(uri, currentPageRef.current);
            }
        };

        const subscription = AppState.addEventListener('change', handleAppStateChange);

        return () => {
            subscription.remove();
            StorageService.savePage(uri, currentPageRef.current);
        };
    }, [uri]);

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

    const handleSave = () => {
        if (isSavingRef.current) return;
        // For external documents, show rename modal so user can choose a name
        if (showSaveButton) {
            setSaveModalVisible(true);
            return;
        }
        // For local files, save directly
        performSave(name || 'documento.pdf');
    };

    const performSave = async (chosenName: string) => {
        if (isSavingRef.current) return;
        isSavingRef.current = true;

        try {
            let safeName = chosenName;
            if (!safeName.toLowerCase().endsWith('.pdf')) {
                safeName += '.pdf';
            }
            safeName = safeName.replace(/[^a-zA-Z0-9._\- áéíóúñÁÉÍÓÚÑ]/g, '_');

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

            showToast(t('viewer.savedToDownloads'), 'success');
        } catch (error) {
            console.log("Error saving file:", error);
            try {
                let safeName = chosenName;
                if (!safeName.toLowerCase().endsWith('.pdf')) safeName += '.pdf';
                safeName = safeName.replace(/[^a-zA-Z0-9._\- áéíóúñÁÉÍÓÚÑ]/g, '_');
                const destPath = `${RNFS.DownloadDirectoryPath}/${safeName}`;
                await RNFS.copyFile(uri, destPath);
                await RNFS.scanFile(destPath);
                showToast(t('viewer.savedToDownloads'), 'success');
            } catch (e) {
                showToast(t('viewer.couldNotSave'), 'error');
            }
        } finally {
            isSavingRef.current = false;
        }
    };

    const handleShare = async () => {
        if (isSharingRef.current) return;
        isSharingRef.current = true;

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
                title: t('viewer.shareTitle'),
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
                        title: t('viewer.shareTitle'),
                        type: 'application/pdf',
                        failOnCancel: false,
                        filename: name || 'documento.pdf',
                    });
                } catch (err2) {
                    showToast(t('viewer.couldNotShare'), 'error');
                }
            }
        } finally {
            isSharingRef.current = false;
            if (tempPath) {
                try {
                    if (await RNFS.exists(tempPath)) await RNFS.unlink(tempPath);
                } catch (_) { }
            }
        }
    };

    const displayName = name || t('viewer.document');

    useLayoutEffect(() => {
        navigation.setOptions({
            headerStyle: { backgroundColor: colors.surfaceLight },
            headerTitle: () => (
                <View style={styles.headerTitleContainer}>
                    <MarqueeText text={displayName} style={[styles.headerTitleText, { color: colors.text }]} />
                </View>
            ),
            headerRight: () => (
                <View style={styles.headerButtons}>
                    <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
                        <MaterialIcon name="share" size={22} color={colors.primary} />
                    </TouchableOpacity>
                    {showSaveButton && (
                        <TouchableOpacity onPress={handleSave} style={styles.headerBtn}>
                            <MaterialIcon name="save-alt" size={22} color={colors.primary} />
                        </TouchableOpacity>
                    )}
                </View>
            ),
        });
    }, [navigation, showSaveButton, displayName, colors]);

    const source = { uri, cache: true };

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundLight }]}>
            {initialPage !== null && (
                <Pdf
                    source={source}
                    page={initialPage}
                    onLoadProgress={(percent) => {
                        setLoadProgress(percent);
                    }}
                    onLoadComplete={(numberOfPages) => {
                        console.log(`Number of pages: ${numberOfPages}`);
                        setLoadProgress(1);
                        // Fade out loading overlay
                        Animated.timing(loadingOpacity, {
                            toValue: 0,
                            duration: 300,
                            useNativeDriver: true,
                        }).start(() => setIsLoading(false));
                    }}
                    onPageChanged={(page) => {
                        currentPageRef.current = page;
                        console.log(`Current page: ${page}`);
                    }}
                    onError={(error) => {
                        console.log(error);
                        setIsLoading(false);
                    }}
                    onPressLink={(linkUri) => {
                        console.log(`Link pressed: ${linkUri}`);
                    }}
                    style={[styles.pdf, { backgroundColor: colors.backgroundLight }]}
                    trustAllCerts={false}
                    enablePaging={false}
                    enableAntialiasing={true}
                    enableAnnotationRendering={true}
                />
            )}

            {/* Loading Overlay */}
            {isLoading && (
                <Animated.View style={[styles.loadingOverlay, { opacity: loadingOpacity, backgroundColor: colors.backgroundLight }]}>
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('viewer.loading')}</Text>
                    <View style={[styles.progressBarContainer, { backgroundColor: colors.border }]}>
                        <View style={[styles.progressBarFill, { width: `${Math.max(loadProgress * 100, 5)}%`, backgroundColor: colors.primary }]} />
                    </View>
                </Animated.View>
            )}

            {/* Floating Toast */}
            {toastVisible && (
                <Animated.View
                    style={[
                        styles.toast,
                        {
                            backgroundColor: toastType === 'success' ? colors.success : colors.error,
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

            <RenameModal
                visible={saveModalVisible}
                currentName={displayName}
                onClose={() => setSaveModalVisible(false)}
                onRename={(newName) => performSave(newName)}
                title={t('viewer.saveAs')}
                saveLabel={t('rename.save')}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
    },
    pdf: {
        flex: 1,
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
    },
    headerTitleContainer: {
        maxWidth: Dimensions.get('window').width * 0.65,
    },
    headerTitleText: {
        fontSize: 17,
        fontWeight: '600',
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
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 10,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 15,
        fontWeight: '500',
    },
    progressBarContainer: {
        marginTop: 12,
        width: '60%',
        height: 4,
        borderRadius: 2,
        overflow: 'hidden',
    },
    progressBarFill: {
        height: '100%',
        borderRadius: 2,
    },
});
