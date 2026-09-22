
import React, { useEffect, useState, useMemo, useCallback, useRef } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StyleSheet, Linking, BackHandler } from 'react-native';
import { useNavigation, useFocusEffect } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LocalFile, openFileInExternalApp, renameFile } from '../services/FileService';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';
import { PdfItem } from '../components/PdfItem';
import { PdfGridItem } from '../components/PdfGridItem';
import { RenameModal } from '../components/RenameModal';
import { FilterModal } from '../components/FilterModal';
import { FileOptionsModal } from '../components/FileOptionsModal';
import { DocxViewerModal } from '../components/DocxViewerModal';
import { OdtViewerModal } from '../components/OdtViewerModal';
import { SettingsModal } from '../components/SettingsModal';
import { ConfirmModal } from '../components/ConfirmModal';
import { UndoToast } from '../components/UndoToast';
import { CreditsModal } from '../components/CreditsModal';
import { PrivacyConsentModal } from '../components/PrivacyConsentModal';
import { BottomNavBar, NavTabType } from '../components/BottomNavBar';
import { PdfToolsView } from '../components/PdfToolsView';
import { SettingsView } from '../components/SettingsView';
import { StorageService } from '../services/StorageService';
import { startDocumentScan } from '../services/DocumentScannerService';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../hooks/useSettings';
import { useFileManager } from '../hooks/useFileManager';
import { useFileActions } from '../hooks/useFileActions';
import { useDocumentViewers } from '../hooks/useDocumentViewers';

export const HomeScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { colors } = useTheme();

    // Custom hooks
    const settings = useSettings();
    const fileManager = useFileManager();
    const { checkPermission } = fileManager;
    const fileActions = useFileActions({
        files: fileManager.files,
        setFiles: fileManager.setFiles,
        favorites: fileManager.favorites,
        loadFavorites: fileManager.loadFavorites,
        scanFiles: fileManager.scanFiles,
    });
    const viewers = useDocumentViewers();

    // UI-only state
    const [isScanning, setIsScanning] = useState(false);
    const [scannedFileToSave, setScannedFileToSave] = useState<{ path: string; name: string } | null>(null);
    const [scanRenameModalVisible, setScanRenameModalVisible] = useState(false);
    const [isSearchVisible, setIsSearchVisible] = useState(false);
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [currentNavTab, setCurrentNavTab] = useState<NavTabType>('documents');
    const [documentSubTab, setDocumentSubTab] = useState<'all' | 'recent' | 'scanner'>('all');
    const [filterType, setFilterType] = useState<'all' | 'pdf' | 'doc' | 'odf'>('all');
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [optionsFile, setOptionsFile] = useState<LocalFile | null>(null);
    const [optionsModalVisible, setOptionsModalVisible] = useState(false);
    const [privacyAccepted, setPrivacyAccepted] = useState<boolean | null>(null);
    const [privacyModalVisible, setPrivacyModalVisible] = useState(false);

    // Check if privacy policy has been accepted
    useEffect(() => {
        StorageService.hasPrivacyBeenAccepted().then(accepted => {
            setPrivacyAccepted(accepted);
        });
    }, []);

    const handlePrivacyAccept = async () => {
        await StorageService.setPrivacyAccepted();
        setPrivacyAccepted(true);
    };

    // Auto-refresh when returning to this screen
    useFocusEffect(
        useCallback(() => {
            // Silently refresh files when the screen comes into focus
            // This is especially useful when returning from WhatsApp or another screen
            if (privacyAccepted) {
                checkPermission(true);
            }
        }, [privacyAccepted, checkPermission])
    );

    // Reference to volatile state for hardware back press to avoid stale closures
    const navStateRef = useRef({
        currentNavTab,
        documentSubTab,
        isSearchVisible,
        searchQuery,
        filterModalVisible,
        optionsModalVisible,
        scanRenameModalVisible,
        privacyModalVisible,
    });
    navStateRef.current = {
        currentNavTab,
        documentSubTab,
        isSearchVisible,
        searchQuery,
        filterModalVisible,
        optionsModalVisible,
        scanRenameModalVisible,
        privacyModalVisible,
    };

    // Hardware back press handler for sections, menus, modals, and tabs
    useEffect(() => {
        const onBackPress = () => {
            if (viewers.docxViewerVisible) {
                viewers.closeDocxViewer();
                return true;
            }
            if (viewers.odtViewerVisible) {
                viewers.closeOdtViewer();
                return true;
            }
            if (viewers.creditsVisible) {
                viewers.setCreditsVisible(false);
                return true;
            }
            if (navStateRef.current.privacyModalVisible) {
                setPrivacyModalVisible(false);
                return true;
            }
            if (navStateRef.current.optionsModalVisible) {
                setOptionsModalVisible(false);
                return true;
            }
            if (navStateRef.current.filterModalVisible) {
                setFilterModalVisible(false);
                return true;
            }
            if (navStateRef.current.scanRenameModalVisible) {
                setScanRenameModalVisible(false);
                return true;
            }
            if (fileActions.renameModalVisible) {
                fileActions.setRenameModalVisible(false);
                return true;
            }
            if (fileActions.confirmDeleteVisible) {
                fileActions.setConfirmDeleteVisible(false);
                return true;
            }
            if (navStateRef.current.isSearchVisible || navStateRef.current.searchQuery.length > 0) {
                setIsSearchVisible(false);
                setSearchQuery('');
                return true;
            }
            if (navStateRef.current.currentNavTab !== 'documents') {
                setCurrentNavTab('documents');
                return true;
            }
            if (navStateRef.current.documentSubTab !== 'all') {
                setDocumentSubTab('all');
                return true;
            }
            return false;
        };

        const subscription = BackHandler.addEventListener('hardwareBackPress', onBackPress);
        return () => subscription.remove();
    }, [viewers, fileActions]);

    // Auto-reset filter to 'all' when Word or ODF get re-enabled from settings
    useEffect(() => {
        if ((settings.showWord || settings.showODF) && filterType === 'pdf') {
            setFilterType('all');
        }
    }, [settings.showWord, settings.showODF]);

    // Cleanup timers on unmount
    useEffect(() => {
        return () => fileActions.cleanup();
    }, []);

    const handleScanDocument = async () => {
        if (isScanning) return;
        setIsScanning(true);
        try {
            const result = await startDocumentScan();
            if (result.success && result.path && result.name) {
                setScannedFileToSave({ path: result.path, name: result.name });
                setScanRenameModalVisible(true);
            }
        } catch (e) {
            console.error('Document scanning error:', e);
        } finally {
            setIsScanning(false);
        }
    };

    const handleConfirmScanName = async (newName: string) => {
        if (!scannedFileToSave) return;

        let finalPath = scannedFileToSave.path;
        let finalName = scannedFileToSave.name;

        // Clean name (sanitize characters that could fail on Android/FAT storage)
        const sanitizedNewName = newName.replace(/[:*?"<>|\\\/]/g, '-').trim();

        if (sanitizedNewName && sanitizedNewName !== scannedFileToSave.name) {
            const success = await renameFile(scannedFileToSave.path, sanitizedNewName);
            if (success) {
                const dir = scannedFileToSave.path.substring(0, scannedFileToSave.path.lastIndexOf('/') + 1);
                finalPath = dir + sanitizedNewName;
                finalName = sanitizedNewName;
            }
        }

        setScannedFileToSave(null);
        setScanRenameModalVisible(false);

        // Refresh list and open PDF in reader
        await fileManager.scanFiles(true);
        setCurrentNavTab('documents');
        setDocumentSubTab('scanner');
        navigation.navigate('PdfViewer', { uri: finalPath, name: finalName });
    };

    const handleCancelScanName = async () => {
        if (!scannedFileToSave) {
            setScanRenameModalVisible(false);
            return;
        }

        const path = scannedFileToSave.path;
        const name = scannedFileToSave.name;
        setScannedFileToSave(null);
        setScanRenameModalVisible(false);

        // Saved with default name; refresh and open
        await fileManager.scanFiles(true);
        setCurrentNavTab('documents');
        setDocumentSubTab('scanner');
        navigation.navigate('PdfViewer', { uri: path, name: name });
    };

    const handleFilePress = (file: LocalFile) => {
        if (file.type === 'pdf') {
            navigation.navigate('PdfViewer', { uri: file.path, name: file.name });
        } else if (file.type === 'docx') {
            if (settings.openWordInApp) {
                viewers.openDocxViewer(file);
            } else {
                openFileInExternalApp(file.path, 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
            }
        } else {
            let mime = '*/*';
            if (file.type === 'doc') mime = 'application/msword';
            else if (file.type === 'odf') {
                if (settings.showODF) {
                    viewers.openOdtViewer(file);
                    return;
                } else {
                    mime = 'application/vnd.oasis.opendocument.text';
                }
            }

            openFileInExternalApp(file.path, mime);
        }
    };

    const filteredFiles = useMemo(() => {
        let result = [...fileManager.files];

        if (currentNavTab === 'favorites') {
            result = result.filter(f => fileManager.favorites.includes(f.path));
            result.sort((a, b) => a.name.localeCompare(b.name));
        } else if (currentNavTab === 'documents') {
            if (documentSubTab === 'recent') {
                result.sort((a, b) => b.date.getTime() - a.date.getTime());
                result = result.slice(0, 10);
            } else if (documentSubTab === 'scanner') {
                result = result.filter(f => {
                    const lowerPath = f.path.toLowerCase();
                    const lowerName = f.name.toLowerCase();
                    return (
                        lowerPath.includes('/pdfortuna/') ||
                        lowerPath.includes('scan') ||
                        lowerPath.includes('escan') ||
                        lowerPath.includes('camscanner') ||
                        lowerName.startsWith('escaneo_') ||
                        lowerName.startsWith('scan_') ||
                        lowerName.includes('scan') ||
                        lowerName.includes('escan')
                    );
                });
                result.sort((a, b) => b.date.getTime() - a.date.getTime());
            } else {
                result.sort((a, b) => a.name.localeCompare(b.name));
            }
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

        if (!settings.showWord) {
            result = result.filter(f => f.type !== 'doc' && f.type !== 'docx');
        }
        if (!settings.showODF) {
            result = result.filter(f => f.type !== 'odf');
        }

        if (searchQuery) {
            result = result.filter(f => f.name.toLowerCase().includes(searchQuery.toLowerCase()));
        }

        return result;
    }, [fileManager.files, searchQuery, fileManager.favorites, currentNavTab, documentSubTab, filterType, settings.showWord, settings.showODF]);

    const displayList = useMemo(() => {
        if (!settings.isGridView) {
            const list: any[] = [];
            filteredFiles.forEach((file) => {
                list.push(file);
            });
            return list;
        } else {
            const list: any[] = [];
            let currentPair: LocalFile[] = [];

            filteredFiles.forEach((file, index) => {
                currentPair.push(file);

                if (currentPair.length === 2) {
                    list.push({ type: 'row', id: `row-${index}`, items: [...currentPair] });
                    currentPair = [];
                }
            });

            if (currentPair.length > 0) {
                list.push({ type: 'row', id: `row-last`, items: [...currentPair] });
            }

            return list;
        }
    }, [filteredFiles, settings.isGridView]);

    // Show privacy consent modal before anything else (first launch)
    if (privacyAccepted === null) {
        // Still loading consent status
        return (
            <View style={[styles.permissionContainer, { backgroundColor: colors.backgroundLight }]}>
                <ActivityIndicator size="large" color={colors.primary} />
            </View>
        );
    }

    if (!privacyAccepted) {
        return (
            <View style={[styles.permissionContainer, { backgroundColor: colors.backgroundLight }]}>
                <PrivacyConsentModal
                    visible={true}
                    onAccept={handlePrivacyAccept}
                />
            </View>
        );
    }

    // Only show permission request if we are done checking and definitely don't have permissions
    if (!fileManager.isCheckingPermissions && !fileManager.permissionGranted) {
        return (
            <View style={[styles.permissionContainer, { backgroundColor: colors.backgroundLight }]}>
                <Icon name="folder-open" size={64} color={colors.primary} />
                <Text style={[styles.permissionTitle, { color: colors.text }]}>{t('permission.title')}</Text>
                <Text style={[styles.permissionText, { color: colors.textSecondary }]}>
                    {t('permission.text')}
                </Text>
                <TouchableOpacity style={[styles.permissionButton, { backgroundColor: colors.primary }]} onPress={fileManager.handleGrantPermission}>
                    <Text style={styles.permissionButtonText}>{t('permission.button')}</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={[styles.container, { backgroundColor: colors.backgroundLight, paddingTop: insets.top }]}>
            {/* Header */}
            <View style={styles.header}>
                <Text style={[styles.headerTitle, { color: colors.text }]}>
                    {currentNavTab === 'documents'
                        ? 'PDFortuna'
                        : currentNavTab === 'favorites'
                        ? t('tabs.favorites')
                        : currentNavTab === 'tools'
                        ? t('tools.title')
                        : t('settings.title')}
                </Text>

                {/* Actions for Documents and Favorites */}
                {(currentNavTab === 'documents' || currentNavTab === 'favorites') && (
                    <View style={styles.headerActions}>
                        <TouchableOpacity
                            style={styles.headerIconButton}
                            onPress={() => setIsSearchVisible(prev => !prev)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Icon
                                name={isSearchVisible ? 'search-off' : 'search'}
                                size={24}
                                color={isSearchVisible ? colors.primary : colors.textSecondary}
                            />
                        </TouchableOpacity>

                        {currentNavTab === 'documents' && (
                            <TouchableOpacity
                                style={styles.headerIconButton}
                                onPress={() => setFilterModalVisible(true)}
                                hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                            >
                                <Icon
                                    name="filter-list"
                                    size={24}
                                    color={filterType !== 'all' ? colors.primary : colors.textSecondary}
                                />
                            </TouchableOpacity>
                        )}

                        <TouchableOpacity
                            style={styles.headerIconButton}
                            onPress={() => settings.setIsGridView(!settings.isGridView)}
                            hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}
                        >
                            <Icon
                                name={settings.isGridView ? 'view-list' : 'grid-view'}
                                size={24}
                                color={colors.textSecondary}
                            />
                        </TouchableOpacity>
                    </View>
                )}
            </View>

            {/* Search Input (conditionally visible) */}
            {isSearchVisible && (currentNavTab === 'documents' || currentNavTab === 'favorites') && (
                <View style={[styles.searchContainer, { backgroundColor: colors.surfaceLight, borderColor: colors.border }]}>
                    {currentNavTab === 'documents' && (
                        <TouchableOpacity onPress={() => setFilterModalVisible(true)} style={styles.searchFilterBtn} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
                            <Icon name="filter-list" size={24} color={filterType !== 'all' ? colors.primary : colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                    <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder={t('home.searchPlaceholder')}
                        placeholderTextColor={colors.textSecondary}
                        value={searchQuery}
                        onChangeText={setSearchQuery}
                        autoFocus={true}
                    />
                    {searchQuery.length > 0 ? (
                        <TouchableOpacity onPress={() => setSearchQuery('')}>
                            <Icon name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    ) : (
                        <TouchableOpacity onPress={() => setIsSearchVisible(false)}>
                            <Icon name="close" size={20} color={colors.textSecondary} />
                        </TouchableOpacity>
                    )}
                </View>
            )}

            {/* Document Sub-tabs (only shown in documents tab) */}
            {currentNavTab === 'documents' && (
                <View style={styles.tabsContainer}>
                    <TouchableOpacity
                        onPress={() => setDocumentSubTab('all')}
                        style={[
                            styles.tab,
                            { backgroundColor: colors.surfaceLight, borderColor: colors.border },
                            documentSubTab === 'all' && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                    >
                        <Text style={[styles.tabText, { color: '#cc2f44' }, documentSubTab === 'all' && styles.activeTabText]}>
                            {t('tabs.all')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setDocumentSubTab('recent')}
                        style={[
                            styles.tab,
                            { backgroundColor: colors.surfaceLight, borderColor: colors.border },
                            documentSubTab === 'recent' && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                    >
                        <Text style={[styles.tabText, { color: '#cc2f44' }, documentSubTab === 'recent' && styles.activeTabText]}>
                            {t('tabs.recent')}
                        </Text>
                    </TouchableOpacity>

                    <TouchableOpacity
                        onPress={() => setDocumentSubTab('scanner')}
                        style={[
                            styles.tab,
                            { backgroundColor: colors.surfaceLight, borderColor: colors.border },
                            documentSubTab === 'scanner' && { backgroundColor: colors.primary, borderColor: colors.primary },
                        ]}
                    >
                        <Text style={[styles.tabText, { color: '#cc2f44' }, documentSubTab === 'scanner' && styles.activeTabText]}>
                            {t('tabs.scanner')}
                        </Text>
                    </TouchableOpacity>
                </View>
            )}

            {/* Main Content Area based on Tab */}
            {currentNavTab === 'tools' ? (
                <PdfToolsView />
            ) : currentNavTab === 'settings' ? (
                <SettingsView
                    showOffice={settings.showWord}
                    onToggleShowOffice={settings.setShowWord}
                    openOfficeInApp={settings.openWordInApp}
                    onToggleOpenOfficeInApp={settings.setOpenWordInApp}
                    onOpenAbout={() => viewers.setCreditsVisible(true)}
                />
            ) : (
                /* Documents / Favorites File List */
                (fileManager.loading || fileManager.isCheckingPermissions) ? (
                    <View style={styles.center}>
                        <ActivityIndicator size="large" color={colors.primary} />
                        <Text style={{ marginTop: 10, color: colors.textSecondary }}>{t('home.scanning')}</Text>
                    </View>
                ) : filteredFiles.length === 0 ? (
                    <View style={styles.center}>
                        <Icon
                            name={
                                searchQuery.trim().length > 0
                                    ? 'search-off'
                                    : currentNavTab === 'favorites'
                                        ? 'favorite-border'
                                        : documentSubTab === 'recent'
                                            ? 'history'
                                            : documentSubTab === 'scanner'
                                                ? 'document-scanner'
                                                : 'folder-open'
                            }
                            size={48}
                            color={colors.textSecondary}
                        />
                        <Text style={{ marginTop: 10, color: colors.textSecondary, textAlign: 'center', paddingHorizontal: 32 }}>
                            {searchQuery.trim().length > 0
                                ? currentNavTab === 'favorites'
                                    ? t('home.noSearchFavorites')
                                    : documentSubTab === 'recent'
                                        ? t('home.noSearchRecent')
                                        : documentSubTab === 'scanner'
                                            ? t('home.noSearchScanner')
                                            : t('home.noDocuments')
                                : currentNavTab === 'favorites'
                                    ? t('home.noFavorites')
                                    : documentSubTab === 'recent'
                                        ? t('home.noRecent')
                                        : documentSubTab === 'scanner'
                                            ? t('home.noScanner')
                                            : t('home.noDocuments')}
                        </Text>
                        {currentNavTab === 'documents' && documentSubTab === 'scanner' && searchQuery.trim().length === 0 && (
                            <View style={styles.scanArrowContainer}>
                                <Icon name="arrow-downward" size={48} color={colors.primary} />
                            </View>
                        )}
                    </View>
                ) : (
                    <FlatList
                        refreshing={fileManager.refreshing}
                        onRefresh={fileManager.handleRefresh}
                        key={settings.isGridView ? 'grid' : 'list'}
                        data={displayList}
                        keyExtractor={(item) => item.path || item.id}
                        numColumns={1}
                        initialNumToRender={settings.isGridView ? 4 : 8}
                        maxToRenderPerBatch={settings.isGridView ? 2 : 10}
                        windowSize={settings.isGridView ? 3 : 11}
                        removeClippedSubviews={true}
                        renderItem={({ item }) => {
                            if (settings.isGridView) {
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
                                                        isFavorite={fileManager.favorites.includes(file.path)}
                                                        showPreview={settings.showPreviews}
                                                        isDeleting={fileActions.deletingFileId === file.path}
                                                        isRestoring={fileActions.restoringFileId === file.path}
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
                                    onShare={() => fileActions.handleShare(item)}
                                    onFavorite={() => fileActions.handleFavorite(item)}
                                    isFavorite={fileManager.favorites.includes(item.path)}
                                    onRename={() => {
                                        fileActions.setFileToRename(item);
                                        fileActions.setRenameModalVisible(true);
                                    }}
                                    onDelete={() => fileActions.handleDelete(item)}
                                    isDeleting={fileActions.deletingFileId === item.path}
                                    isRestoring={fileActions.restoringFileId === item.path}
                                    showPreview={settings.showPreviews}
                                    onLongPress={() => {
                                        setOptionsFile(item);
                                        setOptionsModalVisible(true);
                                    }}
                                />
                            );
                        }}
                        contentContainerStyle={{ paddingBottom: 110 }}
                    />
                )
            )}

            {fileActions.fileToRename && (
                <RenameModal
                    visible={fileActions.renameModalVisible}
                    currentName={fileActions.fileToRename.name}
                    onClose={() => {
                        fileActions.setRenameModalVisible(false);
                        fileActions.setFileToRename(null);
                    }}
                    onRename={fileActions.onRenameFile}
                />
            )}

            {scanRenameModalVisible && (
                <RenameModal
                    visible={scanRenameModalVisible}
                    currentName={scannedFileToSave?.name || ''}
                    title={t('rename.scanTitle')}
                    saveLabel={t('rename.scanSave')}
                    onClose={handleCancelScanName}
                    onRename={handleConfirmScanName}
                />
            )}

            <UndoToast
                visible={!!fileActions.pendingDeleteFile}
                message={t('delete.undoMessage')}
                onUndo={fileActions.handleUndoDelete}
            />

            <FilterModal
                visible={filterModalVisible}
                currentFilter={filterType}
                onClose={() => setFilterModalVisible(false)}
                showDoc={settings.showWord}
                showODF={settings.showODF}
                showAll={settings.showWord || settings.showODF}
                onSelect={(filter) => {
                    setFilterType(filter);
                    setFilterModalVisible(false);
                }}
            />

            <FileOptionsModal
                visible={optionsModalVisible}
                file={optionsFile}
                isFavorite={optionsFile ? fileManager.favorites.includes(optionsFile.path) : false}
                onClose={() => {
                    setOptionsModalVisible(false);
                    setOptionsFile(null);
                }}
                onRename={() => {
                    if (optionsFile) {
                        fileActions.setFileToRename(optionsFile);
                        fileActions.setRenameModalVisible(true);
                    }
                }}
                onDelete={() => {
                    if (optionsFile) fileActions.handleDelete(optionsFile);
                }}
                onShare={() => {
                    if (optionsFile) fileActions.handleShare(optionsFile);
                }}
                onFavorite={() => {
                    if (optionsFile) fileActions.handleFavorite(optionsFile);
                }}
            />

            <DocxViewerModal
                visible={viewers.docxViewerVisible}
                file={viewers.docxFile}
                onClose={viewers.closeDocxViewer}
            />

            <OdtViewerModal
                visible={viewers.odtViewerVisible}
                file={viewers.odtFile}
                onClose={viewers.closeOdtViewer}
            />

            <SettingsModal
                visible={viewers.settingsVisible}
                onClose={() => viewers.setSettingsVisible(false)}
                showOffice={settings.showWord}
                onToggleShowOffice={settings.setShowWord}
                openOfficeInApp={settings.openWordInApp}
                onToggleOpenOfficeInApp={settings.setOpenWordInApp}
                onOpenAbout={() => {
                    viewers.setSettingsVisible(false);
                    setTimeout(() => {
                        viewers.setCreditsVisible(true);
                    }, 150);
                }}
            />

            <CreditsModal
                visible={viewers.creditsVisible}
                onClose={() => viewers.setCreditsVisible(false)}
            />

            <PrivacyConsentModal
                visible={privacyModalVisible}
                onAccept={() => setPrivacyModalVisible(false)}
            />

            <ConfirmModal
                visible={fileActions.confirmDeleteVisible}
                title={t('delete.title')}
                message={t('delete.message', { name: fileActions.confirmDeleteFile?.name || '' })}
                onConfirm={() => {
                    if (fileActions.confirmDeleteFile) fileActions.performDelete(fileActions.confirmDeleteFile);
                    fileActions.setConfirmDeleteVisible(false);
                }}
                onCancel={() => fileActions.setConfirmDeleteVisible(false)}
                confirmText={t('delete.confirm')}
                cancelText={t('delete.cancel')}
                confirmColor={colors.error}
            />

            {/* Bottom Navigation Bar */}
            <BottomNavBar
                activeTab={currentNavTab}
                onTabChange={setCurrentNavTab}
                onScanPress={handleScanDocument}
                isScanning={isScanning}
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
        paddingHorizontal: 20,
        paddingVertical: 12,
        minHeight: 52,
    },
    headerTitle: {
        fontSize: 22,
        fontWeight: 'bold',
    },
    headerActions: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 14,
    },
    headerIconButton: {
        padding: 4,
    },
    searchContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        marginHorizontal: 16,
        paddingHorizontal: 12,
        borderRadius: 12,
        height: 48,
        marginBottom: 12,
        borderWidth: 1,
    },
    searchFilterBtn: {
        marginRight: 8,
    },
    searchInput: {
        flex: 1,
        fontSize: 16,
    },
    tabsContainer: {
        flexDirection: 'row',
        paddingHorizontal: 16,
        marginBottom: 12,
        gap: 8,
    },
    tab: {
        paddingHorizontal: 16,
        paddingVertical: 6,
        borderRadius: 20,
        borderWidth: 1,
    },
    tabText: {
        fontSize: 13,
        fontWeight: '600',
    },
    activeTabText: {
        color: '#fff',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    scanArrowContainer: {
        marginTop: 24,
        alignItems: 'center',
        justifyContent: 'center',
    },
});
