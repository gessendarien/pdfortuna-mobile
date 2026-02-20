
import React, { useEffect, useState, useMemo } from 'react';
import { View, Text, FlatList, TextInput, TouchableOpacity, ActivityIndicator, StatusBar, StyleSheet, Platform, UIManager } from 'react-native';
import { useNavigation } from '@react-navigation/native';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { LocalFile, openFileInExternalApp } from '../services/FileService';
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
import { BannerAdItem } from '../components/BannerAdItem';
import { AdConfig } from '../config/AdConfig';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useSettings } from '../hooks/useSettings';
import { useFileManager } from '../hooks/useFileManager';
import { useFileActions } from '../hooks/useFileActions';
import { useDocumentViewers } from '../hooks/useDocumentViewers';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
    UIManager.setLayoutAnimationEnabledExperimental(true);
}

export const HomeScreen = () => {
    const insets = useSafeAreaInsets();
    const navigation = useNavigation<any>();
    const { colors } = useTheme();

    // Custom hooks
    const settings = useSettings();
    const fileManager = useFileManager();
    const fileActions = useFileActions({
        files: fileManager.files,
        setFiles: fileManager.setFiles,
        favorites: fileManager.favorites,
        loadFavorites: fileManager.loadFavorites,
        scanFiles: fileManager.scanFiles,
    });
    const viewers = useDocumentViewers();

    // UI-only state
    const [searchQuery, setSearchQuery] = useState<string>('');
    const [activeTab, setActiveTab] = useState<'all' | 'recent' | 'favorites'>('all');
    const [filterType, setFilterType] = useState<'all' | 'pdf' | 'doc' | 'odf'>('all');
    const [filterModalVisible, setFilterModalVisible] = useState(false);
    const [optionsFile, setOptionsFile] = useState<LocalFile | null>(null);
    const [optionsModalVisible, setOptionsModalVisible] = useState(false);

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

        if (activeTab === 'favorites') {
            result = result.filter(f => fileManager.favorites.includes(f.path));
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
    }, [fileManager.files, searchQuery, fileManager.favorites, activeTab, filterType, settings.showWord, settings.showODF]);

    const displayList = useMemo(() => {
        if (!settings.isGridView) {
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
    }, [filteredFiles, settings.isGridView]);

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
                <TouchableOpacity onPress={() => viewers.setCreditsVisible(true)}>
                    <Text style={[styles.headerTitle, { color: colors.text }]}>PDFortuna</Text>
                </TouchableOpacity>
                <TouchableOpacity onPress={() => viewers.setSettingsVisible(true)}>
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
                <TouchableOpacity onPress={() => settings.setIsGridView(!settings.isGridView)} style={{ padding: 6 }}>
                    <Icon name={settings.isGridView ? "view-list" : "grid-view"} size={24} color={colors.textSecondary} />
                </TouchableOpacity>
            </View>

            {/* Content */}
            {(fileManager.loading || fileManager.isCheckingPermissions) ? (
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
                        if (item.type === 'ad') {
                            return <BannerAdItem unitId={AdConfig.bannerId} />;
                        }

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
                    contentContainerStyle={{ paddingBottom: 80 }}
                />
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
                showPreviews={settings.showPreviews}
                onTogglePreviews={settings.setShowPreviews}
                showWord={settings.showWord}
                onToggleShowWord={settings.setShowWord}
                openWordInApp={settings.openWordInApp}
                onToggleOpenWordInApp={settings.setOpenWordInApp}
                startupViewMode={settings.startupViewMode}
                onToggleStartupViewMode={settings.setStartupViewMode}
                showODF={settings.showODF}
                onToggleShowODF={settings.setShowODF}
            />

            <CreditsModal
                visible={viewers.creditsVisible}
                onClose={() => viewers.setCreditsVisible(false)}
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
