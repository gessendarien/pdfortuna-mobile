import { useEffect, useState, useRef, useCallback } from 'react';
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

    const scanFiles = useCallback(async (silent: boolean = false) => {
        if (!silent) setLoading(true);
        const scanned = await scanDocuments();
        setFiles(scanned);
        if (!silent) setLoading(false);
    }, []);

    const checkPermission = useCallback(async (silent: boolean = false) => {
        if (!silent) setLoading(true);
        // First check if manage permission logic applies (for Android 11+)
        const isManaged = await checkManagePermission();
        if (isManaged) {
            setPermissionGranted(true);
            setIsCheckingPermissions(false);
            scanFiles(silent);
            return;
        }

        // Use checkFilePermissions to see if we have access WITHOUT requesting
        const hasAccess = await checkFilePermissions();
        if (hasAccess) {
            setPermissionGranted(true);
            scanFiles(silent);
        } else {
            setPermissionGranted(false);
            if (!silent) setLoading(false);
        }
        setIsCheckingPermissions(false);
    }, [scanFiles]);

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

    const appState = useRef(AppState.currentState);

    useEffect(() => {
        checkPermission();
        loadFavorites();

        // Add AppState listener to re-check permissions when app comes to foreground
        const subscription = AppState.addEventListener('change', nextAppState => {
            if (
                appState.current.match(/inactive|background/) &&
                nextAppState === 'active'
            ) {
                // Silent refresh so it doesn't flash the screen
                checkPermission(true);
            }
            appState.current = nextAppState;
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
        checkPermission, // Exported to be used for focus effects
    };
};
