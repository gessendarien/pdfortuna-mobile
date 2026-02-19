
import React, { useEffect, useState, useMemo, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, StyleSheet, AppState, LayoutAnimation, Platform, UIManager, Alert } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LocalFile, scanDocuments, requestFilePermissions, checkManagePermission, checkFilePermissions, deleteFile, renameFile, openFileInExternalApp } from '../services/FileService';
import { StorageService } from '../services/StorageService';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';
import { PdfItem } from '../components/PdfItem';
import { PdfGridItem } from '../components/PdfGridItem';
import { RenameModal } from '../components/RenameModal';
import { FilterModal } from '../components/FilterModal';
import { FileOptionsModal } from '../components/FileOptionsModal';
import { DocxViewerModal } from '../components/DocxViewerModal';
import { SettingsModal } from '../components/SettingsModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { UndoToast } from '../components/UndoToast';
import { CreditsModal } from '../components/CreditsModal';
import { BannerAdItem } from '../components/BannerAdItem';
import { AdConfig } from '../config/AdConfig';

import { useSafeAreaInsets } from 'react-native-safe-area-context';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const HomeScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { colors } = useTheme();
    const [files, setFiles] = useState<LocalFile[]>([]);
    const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
    const [isCheckingPermissions, setIsCheckingPermissions] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [favorites, setFavorites] = useState<string[]>([]);
    const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'favorites'>('all');

    // View Mode
    const [isGridView, setIsGridView] = useState(false);
    const [startupViewMode, setStartupViewMode] = useState(false);
    const [optionsFile, setOptionsFile] = useState<LocalFile | null>(null);
    const [optionsModalVisible, setOptionsModalVisible] = useState(false);

    // Docx Viewer
    const [docxFile, setDocxFile] = useState<LocalFile | null>(null);
    const [docxViewerVisible, setDocxViewerVisible] = useState(false);

    // Settings
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [creditsVisible, setCreditsVisible] = useState(false);
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    // Default settings: All FALSE (disabled) for new installations
    const [showPreviews, setShowPreviews] = useState(false);
    const [showWord, setShowWord] = useState(false);
    const [openWordInApp, setOpenWordInApp] = useState(false);
    const [showODF, setShowODF] = useState(false);

    // Filter State
    const [filterType, setFilterType] = useState<'all' | 'pdf' | 'doc' | 'odf'>('all');
    const [filterModalVisible, setFilterModalVisible] = useState(false);

    // Rename/Delete state
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [fileToRename, setFileToRename] = useState<LocalFile | null>(null);
    const [confirmDeleteFile, setConfirmDeleteFile] = useState<LocalFile | null>(null);
    const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

    // Undo Delete State
    const [pendingDeleteFile, setPendingDeleteFile] = useState<LocalFile | null>(null);
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
    const [restoringFileId, setRestoringFileId] = useState<string | null>(null);

    // Share State - Prevent multiple share dialogs
    const isSharingRef = useRef<boolean>(false);

    const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    // Load persisted settings
    useEffect(() => {
        const load = async () => {
            const prefs = await StorageService.loadSettings();
            if (prefs) {
                if (prefs.showPreviews !== undefined) setShowPreviews(!!prefs.showPreviews);
                if (prefs.showWord !== undefined) setShowWord(!!prefs.showWord);
                if (prefs.openWordInApp !== undefined) setOpenWordInApp(!!prefs.openWordInApp);
                if (prefs.showODF !== undefined) setShowODF(!!prefs.showODF);

                // Load startup view mode
                let startup = false;
                if (prefs.startupViewMode !== undefined) {
                    startup = !!prefs.startupViewMode;
                } else if (prefs.isGridView !== undefined) {
                    // Migration: used old setting
                    startup = !!prefs.isGridView;
                }
                setStartupViewMode(startup);
                setIsGridView(startup); // Set current view to startup preference
            }
            setIsSettingsLoaded(true);
        };
        load();
    }, []);

    // Save settings
    useEffect(() => {
        if (!isSettingsLoaded) return;
        StorageService.saveSettings({
            showPreviews,
            showWord,
            openWordInApp,
            showODF,
            startupViewMode // Save the preferred startup mode, not the current view
        });
    }, [isSettingsLoaded, showPreviews, showWord, openWordInApp, showODF, startupViewMode]);

    useEffect(() => {
        checkPermission();
        loadFavorites();

        // Add AppState listener to re-check permissions when app comes to foreground
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (nextAppState === 'active') {
                checkPermission();
            }
        });

        return () => {
            subscription.remove();
            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
        };
    }, []);

    // Auto-reset filter to 'all' when Word or ODF get re-enabled from settings
    useEffect(() => {
        if ((showWord || showODF) && filterType === 'pdf') {
            setFilterType('all');
        }
    }, [showWord, showODF]);


    const checkPermission = async () => {
        setLoading(true);
        // First check if manage permission logic applies (for Android 11+)
        const isManaged = await checkManagePermission();
        if (isManaged) {
            setPermissionGranted(true);
            setIsCheckingPermissions(false);
            scanFiles();
            return;
        }

        // Use checkFilePermissions to see if we have access WITHOUT requesting
        const hasAccess = await checkFilePermissions();
        if (hasAccess) {
            setPermissionGranted(true);
            scanFiles();
        } else {
            setPermissionGranted(false);
            setLoading(false);
        }
        setIsCheckingPermissions(false);
    };

    const loadFavorites = async () => {
        const favs = await StorageService.getFavorites();
        setFavorites(favs);
    };

    const scanFiles = async () => {
        setLoading(true);
        const scanned = await scanDocuments();
        setFiles(scanned);
        setLoading(false);
    };

    const handleRefresh = async () => {
        setRefreshing(true);
        const scanned = await scanDocuments();
        setFiles(scanned);
        setRefreshing(false);
    };

    const handleGrantPermission = async () => {
        const granted = await requestFilePermissions();
        if (granted) {
            setPermissionGranted(true);
            scanFiles();
        }
        // If not granted (returned false), it might be because we redirected to settings.
        // The AppState listener will handle the check on return.
    };

    const handleFilePress = (file: LocalFile) => {
        if (file.type === 'pdf') {
            navigation.navigate('PdfViewer', { uri: file.path, name: file.name });
        } else if (file.type === 'docx') {
            if (openWordInApp) {
                setDocxFile(file);
                setDocxViewerVisible(true);
            } else {
                openFileInExternalApp(file.path, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            }
        } else {
            let mime = '*/*';
            if (file.type === 'doc') mime = 'application/msword';
            else if (file.type === 'odf') mime = 'application/vnd.oasis.opendocument.text';

            openFileInExternalApp(file.path, mime);
        }
    };

    const handleShare = async (file: LocalFile) => {
        if (isSharingRef.current) {
            console.log('Share already in progress, ignoring...');
            return;
        }

        isSharingRef.current = true;
        let destPath = '';
        try {
            destPath = `${RNFS.CachesDirectoryPath}/${file.name}`;

            if (await RNFS.exists(destPath)) {
                await RNFS.unlink(destPath);
            }

            await RNFS.copyFile(file.path, destPath);
            const cleanUrl = `file://${destPath}`;

            await Share.open({
                url: cleanUrl,
                title: t('viewer.shareTitle'),
                failOnCancel: false,
            });
        } catch (error: any) {
            console.log('Copy/Share failed, trying Base64:', error);

            if (error && error.message === 'User did not share') return;

            try {
                const base64Data = await RNFS.readFile(file.path, 'base64');
                let mimeType = 'application/pdf';
                if (file.type === 'doc') mimeType = 'application/msword';
                else if (file.type === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                else if (file.type === 'odf') mimeType = 'application/vnd.oasis.opendocument.text';

                const dataUrl = `data:${mimeType};base64,${base64Data}`;

                await Share.open({
                    url: dataUrl,
                    title: t('viewer.shareTitle'),
                    type: mimeType,
                    failOnCancel: false,
                    filename: file.name,
                });
            } catch (err2) {
                console.log('Base64 share failed:', err2);
                Alert.alert('Error', t('errors.shareError'));
            }
        } finally {
            isSharingRef.current = false;

            if (destPath) {
                try {
                    if (await RNFS.exists(destPath)) {
                        await RNFS.unlink(destPath);
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    };

    const handleFavorite = async (file: LocalFile) => {
        await StorageService.toggleFavorite(file.path);
        loadFavorites(); // refresh
    };

    const handleDelete = (file: LocalFile) => {
        setConfirmDeleteFile(file);
        setConfirmDeleteVisible(true);
    };

    const performDelete = (file: LocalFile) => {
        if (pendingDeleteFile) {
            commitDeleteNow(pendingDeleteFile);
        }

        setDeletingFileId(file.path);

        if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
        animationTimerRef.current = setTimeout(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setFiles(prev => prev.filter(f => f.path !== file.path));
            setDeletingFileId(null);
            setPendingDeleteFile(file);

            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = setTimeout(() => {
                commitDeleteNow(file);
            }, 3000);
        }, 300);
    };

    const commitDeleteNow = async (file: LocalFile) => {
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        setPendingDeleteFile(null);
        const success = await deleteFile(file.path);
        if (!success) {
            scanFiles();
        }
    };

    const handleUndoDelete = () => {
        if (!pendingDeleteFile) return;
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        const fileToRestore = pendingDeleteFile;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFiles(prev => [...prev, fileToRestore]);
        setRestoringFileId(fileToRestore.path);
        setPendingDeleteFile(null);
        setTimeout(() => {
            setRestoringFileId(null);
        }, 400);
    };

    const onRenameFile = async (newName: string) => {
        if (!fileToRename) return;

        // Check if currently a favorite before renaming
        const wasFavorite = favorites.includes(fileToRename.path);
        const oldPath = fileToRename.path; // capture old path

        const success = await renameFile(fileToRename.path, newName);
        if (success) {
            if (wasFavorite) {
                // Calculate new path based on how renameFile does it (same folder)
                const lastSlash = oldPath.lastIndexOf('/');
                const newPath = oldPath.substring(0, lastSlash + 1) + newName;
                await StorageService.replaceFavoritePath(oldPath, newPath);
                loadFavorites(); // Refresh favorites list
            }
            scanFiles();
        }
    };

    const filteredFiles = useMemo(() => {
        let result = [...files];

        if (activeTab === 'favorites') {
            result = result.filter(f => favorites.includes(f.path));
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else if (activeTab === 'recent') {
            result.sort((a, b) => b.date.getTime() - a.date.getTime());
            result = result.slice(0, 10);
        } else {
            result.sort((a, b) => a.name.localeCompare(b.name));
        }

        if (filterType !== 'all') {
            if (filterType === 'pdf') {
                result = result.filter(f => f.type === 'pdf');
            } else if (filterType === 'doc') {
                result = result.filter(f => f.type === 'doc' || f.type === 'docx');
            } else if (filterType === 'odf') {
                result = result.filter(f => f.type === 'odf');
            }
        }

        if (!showWord) {
            result = result.filter(f => f.type !== 'doc' && f.type !== 'docx');
        }
        if (!showODF) {
            result = result.filter(f => f.type !== 'odf');
        }

        if (searchQuery) {
            result = result.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return result;
    }, [files, searchQuery, favorites, activeTab, filterType, showWord, showODF]);

    const displayList = useMemo(() => {
        if (!isGridView) {
            const list: any[] = [];
            filteredFiles.forEach((file, index) => {
                list.push(file);
                if ((index + 1) % 10 === 0) {
                    list.push({ type: 'ad', id: `ad-${index}`, path: `ad-${index}` });
                }
            });
            const remainder = filteredFiles.length % 10;
            if (remainder >= 4) {
                list.push({ type: 'ad', id: `ad-last`, path: `ad-last` });
            }
            return list;
        } else {
            const list: any[] = [];
            let currentPair: LocalFile[] = [];
            let fileCount = 0;

            filteredFiles.forEach((file, index) => {
                currentPair.push(file);
                fileCount++;

                if (currentPair.length === 2) {
                    list.push({ type: 'row', id: `row-${index}`, items: [...currentPair] });
                    currentPair = [];
                }

                if (fileCount > 0 && fileCount % 10 === 0) {
                    list.push({ type: 'ad', id: `ad-g-${fileCount}` });
                }
            });

            if (currentPair.length > 0) {
                list.push({ type: 'row', id: `row-last`, items: [...currentPair] });
            }

            const remainder = filteredFiles.length % 10;
            if (remainder >= 4) {
                list.push({ type: 'ad', id: `ad-g-last` });
            }

            return list;
        }
    }, [filteredFiles, isGridView]);

    // Only show permission request if we are done checking and definitely don't have permissions
    if (!isCheckingPermissions && !permissionGranted) {
        return (
            <View style={[styles.permissionContainer, { backgroundColor: colors.backgroundLight }]}>
                <Icon name="folder-open" size={64} color={colors.primary} />
                <Text style={[styles.permissionTitle, { color: colors.text }]}>{t('permission.title')}</Text>
                <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
                    {t('permission.text')}
                </Text>
                <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={handleGrantPermission}>
                    <Text style={styles.permissionButtonText}>{t('permission.button')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundLight, paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity onPress={() => setCreditsVisible(true)}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>PDFortuna</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setSettingsVisible(true)}>
                    <Icon name="settings" size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Search */}
            <View style={[styles.searchContainer, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={{ marginRight: 8 }} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                    <Icon name="filter-list" size={24} color={filterType !== 'all' ? colors.primary : colors.textSecondary} />
                </TouchableOpacity>
                <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder={t('home.searchPlaceholder')}
                    placeholderTextColor={colors.textSecondary}
                    value={searchQuery}
                    onChangeText={setSearchQuery}
                />
                {searchQuery.length > 0 &&
                    <TouchableOpacity onPress={() => setSearchQuery('')}>
                        <Icon name="close" size={20} color={colors.textSecondary} />
                    </TouchableOpacity>
                }
            </View>

            {/* Tabs */}
            <View style={styles.tabsContainer}>
                <TouchableOpacity onPress={() => setActiveTab('all')} style={[styles.tab, { backgroundColor: colors.surfaceLight, borderColor: colors.border }, activeTab === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'all' && styles.activeTabText]}>{t('tabs.all')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('recent')} style={[styles.tab, { backgroundColor: colors.surfaceLight, borderColor: colors.border }, activeTab === 'recent' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'recent' && styles.activeTabText]}>{t('tabs.recent')}</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => setActiveTab('favorites')} style={[styles.tab, { backgroundColor: colors.surfaceLight, borderColor: colors.border }, activeTab === 'favorites' && { backgroundColor: colors.primary, borderColor: colors.primary }]}>
                    <Text style={[styles.tabText, { color: colors.textSecondary }, activeTab === 'favorites' && styles.activeTabText]}>{t('tabs.favorites')}</Text>
                </TouchableOpacity>
                <View style={{ flex: 1 }} />
                <TouchableOpacity onPress={() => setIsGridView(!isGridView)} style={{ padding: 6 }}>
                    <Icon name={isGridView ? "view-list" : "grid-view"} size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {(loading || isCheckingPermissions) ? (
                <View style={styles.center}>
                    <ActivityIndicator size="large" color={colors.primary} />
                    <Text style={{ marginTop: 10, color: colors.textSecondary }}>{t('home.scanning')}</Text>
                </View>
            ) : filteredFiles.length === 0 ? (
                <View style={styles.center}>
                    <Icon name="search-off" size={48} color={colors.textSecondary} />
                    <Text style={{ marginTop: 10, color: colors.textSecondary }}>
                        {activeTab === 'favorites' ? t('home.noFavorites') :
                            activeTab === 'recent' ? t('home.noRecent') :
                                t('home.noDocuments')}
                    </Text>
                </View>
            ) : (
                <FlatList
                    refreshing={refreshing}
                    onRefresh={handleRefresh}
                    key={isGridView ? 'grid' : 'list'}
                    data={displayList}
                    keyExtractor={(item) => item.path || item.id}
                    numColumns={1}
                    initialNumToRender={isGridView ? 4 : 8}
                    maxToRenderPerBatch={isGridView ? 2 : 10}
                    windowSize={isGridView ? 3 : 11}
                    removeClippedSubviews={true}
                    renderItem={({ item }) => {
                        if (item.type === 'ad') {
                            return <BannerAdItem unitId={AdConfig.bannerId} />;
                        }

                        if (isGridView) {
                            if (item.type === 'row') {
                                return (
                                    <View style={{ flexDirection: 'row', paddingHorizontal: 16, justifyContent: 'space-between' }}>
                                        {item.items.map((file: LocalFile) => (
                                            <View key={file.path} style={{ width: '48%' }}>
                                                <PdfGridItem
                                                    file={file}
                                                    onPress={() => handleFilePress(file)}
                                                    onMore={() => {
                                                        setOptionsFile(file);
                                                        setOptionsModalVisible(true);
                                                    }}
                                                    isFavorite={favorites.includes(file.path)}
                                                    showPreview={showPreviews}
                                                    isDeleting={deletingFileId === file.path}
                                                    isRestoring={restoringFileId === file.path}
                                                />
                                            </View>
                                        ))}
                                        {/* Spacer for odd number of items */}
                                        {item.items.length === 1 && <View style={{ width: '48%' }} />}
                                    </View>
                                );
                            }
                            return null;
                        }

                        return (
                            <PdfItem
                                file={item}
                                onPress={() => handleFilePress(item)}
                                onShare={() => handleShare(item)}
                                onFavorite={() => handleFavorite(item)}
                                isFavorite={favorites.includes(item.path)}
                                onRename={() => {
                                    setFileToRename(item);
                                    setRenameModalVisible(true);
                                }}
                                onDelete={() => handleDelete(item)}
                                isDeleting={deletingFileId === item.path}
                                isRestoring={restoringFileId === item.path}
                                showPreview={showPreviews}
                                onLongPress={() => {
                                    setOptionsFile(item);
                                    setOptionsModalVisible(true);
                                }}
                            />
                        );
                    }}
                    contentContainerStyle={{ paddingBottom: 80 }}
                />
            )}

            {fileToRename && (
                <RenameModal
                    visible={renameModalVisible}
                    currentName={fileToRename.name}
                    onClose={() => {
                        setRenameModalVisible(false);
                        setFileToRename(null);
                    }}
                    onRename={onRenameFile}
                />
            )}

            <UndoToast
                visible={!!pendingDeleteFile}
                message={t('delete.undoMessage')}
                onUndo={handleUndoDelete}
            />

            <FilterModal
                visible={filterModalVisible}
                currentFilter={filterType}
                onClose={() => setFilterModalVisible(false)}
                showDoc={showWord}
                showODF={showODF}
                showAll={showWord || showODF}
                onSelect={(filter) => {
                    setFilterType(filter);
                    setFilterModalVisible(false);
                }}
            />

            <FileOptionsModal
                visible={optionsModalVisible}
                file={optionsFile}
                isFavorite={optionsFile ? favorites.includes(optionsFile.path) : false}
                onClose={() => {
                    setOptionsModalVisible(false);
                    setOptionsFile(null);
                }}
                onRename={() => {
                    if (optionsFile) {
                        setFileToRename(optionsFile);
                        setRenameModalVisible(true);
                    }
                }}
                onDelete={() => {
                    if (optionsFile) handleDelete(optionsFile);
                }}
                onShare={() => {
                    if (optionsFile) handleShare(optionsFile);
                }}
                onFavorite={() => {
                    if (optionsFile) handleFavorite(optionsFile);
                }}
            />

            <DocxViewerModal
                visible={docxViewerVisible}
                file={docxFile}
                onClose={() => {
                    setDocxViewerVisible(false);
                    setDocxFile(null);
                }}
            />

            <SettingsModal
                visible={settingsVisible}
                onClose={() => setSettingsVisible(false)}
                showPreviews={showPreviews}
                onTogglePreviews={setShowPreviews}
                showWord={showWord}
                onToggleShowWord={setShowWord}
                openWordInApp={openWordInApp}
                onToggleOpenWordInApp={setOpenWordInApp}
                startupViewMode={startupViewMode}
                onToggleStartupViewMode={setStartupViewMode}
                showODF={showODF}
                onToggleShowODF={setShowODF}
            />

            <CreditsModal
                visible={creditsVisible}
                onClose={() => setCreditsVisible(false)}
            />

            <ConfirmModal
                visible={confirmDeleteVisible}
                title={t('delete.title')}
                message={t('delete.message', { name: confirmDeleteFile?.name || '' })}
                onConfirm={() => {
                    if (confirmDeleteFile) performDelete(confirmDeleteFile);
                    setConfirmDeleteVisible(false);
                }}
                onCancel={() => setConfirmDeleteVisible(false)}
                confirmText={t('delete.confirm')}
                cancelText={t('delete.cancel')}
                confirmColor={colors.error}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    permissionContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    permissionTitle: {
        fontSize: 22,
        fontWeight: 'bold',
        marginTop: 20,
        marginBottom: 10,
    },
    permissionText: {
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 30,
        lineHeight: 24,
    },
    permissionButton: {
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: theme.borderRadius.full,
    },
    permissionButtonText: {
        color: '#fff',
        fontWeight: 'bold',
        fontSize: 16,
    },
    header: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        paddingHorizontal: 16,
        paddingVertical: 12,
    },
    headerTitle: {
        fontSize: 24,
        fontWeight: 'bold',
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        height: 48,
        marginBottom: 16,
        borderWidth: 1,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 16,
        gap: 8,
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    tabText: {
        fontSize: 14,
        fontWeight: '500',
    },
    activeTabText: {
        color: '#fff',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    }
});
