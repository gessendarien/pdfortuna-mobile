import { useEffect, useState } from 'react';
import { AppState } from 'react-native';
import { LocalFile, scanDocuments, requestFilePermissions, checkManagePermission, checkFilePermissions } from '../services/FileService';
import { StorageService } from '../services/StorageService';

export const useFileManager = () => {
    const [files, setFiles] = useState<LocalFile[]>([]);
    const [permissionGranted, setPermissionGranted] = useState<boolean>(false);
    const [isCheckingPermissions, setIsCheckingPermissions] = useState<boolean>(true);
    const [loading, setLoading] = useState<boolean>(true);
    const [refreshing, setRefreshing] = useState<boolean>(false);
    const [favorites, setFavorites] = useState<string[]>([]);

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
        };
    }, []);

    return {
        files, setFiles,
        permissionGranted,
        isCheckingPermissions,
        loading,
        refreshing,
        favorites,
        loadFavorites,
        scanFiles,
        handleRefresh,
        handleGrantPermission,
    };
};
