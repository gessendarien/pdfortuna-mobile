import RNFS from 'react-native-fs';
import { PermissionsAndroid, Platform, Linking, ToastAndroid } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

export interface LocalFile {
    name: string;
    path: string;
    size: number;
    date: Date;
    id: string; // path as id
    type: 'pdf' | 'doc' | 'docx' | 'odf' | 'unknown';
}

// Export a check function that uses the Native Module if available
export const checkManagePermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android' && Platform.Version >= 30) {
        const { NativeModules } = require('react-native');
        if (NativeModules.PermissionModule) {
            return await NativeModules.PermissionModule.checkManageAllFilesAccessPermission();
        }
    }
    return false;
}

export const requestFilePermissions = async (): Promise<boolean> => {
    if (Platform.OS !== 'android') return true;

    try {
        if (Platform.Version >= 30) {
            // First check if we ALREADY have the permission
            const hasPerm = await checkManagePermission();
            if (hasPerm) return true;

            // We'll use our Native Module to go to the specific "Manage All Files Access" screen
            // for this app.
            const { NativeModules } = require('react-native');
            if (NativeModules.PermissionModule) {
                NativeModules.PermissionModule.openManageAllFilesAccessSettings();
            } else {
                Linking.openSettings();
            }
            return false;
        } else {
            const granted = await PermissionsAndroid.request(
                PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                {
                    title: 'Permiso de Acceso a Archivos',
                    message: 'PDFortuna necesita acceder al almacenamiento para encontrar tus documentos PDF.',
                    buttonPositive: 'Aceptar',
                },
            );
            return granted === PermissionsAndroid.RESULTS.GRANTED;
        }
    } catch (err) {
        console.warn(err);
    }
    return false;
};

// Open Settings helper
export const openSettings = () => {
    Linking.openSettings();
};

export const scanDocuments = async (): Promise<LocalFile[]> => {
    const rootPath = RNFS.ExternalStorageDirectoryPath;
    const documents: LocalFile[] = [];

    // Directories to prioritize to avoid full disk scan slowdown/permission issues
    const likelyPaths = [
        `${rootPath}/Download`,
        `${rootPath}/Documents`,
        rootPath // Fallback/General
    ];

    // We'll deduplicate by path
    const pathsVisited = new Set<string>();

    const getFileType = (name: string): LocalFile['type'] => {
        const lower = name.toLowerCase();
        if (lower.endsWith('.pdf')) return 'pdf';
        if (lower.endsWith('.doc')) return 'doc';
        if (lower.endsWith('.docx')) return 'docx';
        if (lower.endsWith('.odt') || lower.endsWith('.odf')) return 'odf';
        return 'unknown';
    };

    const scanDir = async (dirPath: string) => {
        if (pathsVisited.has(dirPath)) return;
        pathsVisited.add(dirPath);

        try {
            const items = await RNFS.readDir(dirPath);
            for (const item of items) {
                if (item.isDirectory()) {
                    // Avoid hidden and Android data folders which are restricted
                    if (!item.name.startsWith('.') && item.name !== 'Android') {
                        await scanDir(item.path);
                    }
                } else if (item.isFile()) {
                    const type = getFileType(item.name);
                    if (type !== 'unknown') {
                        documents.push({
                            name: item.name,
                            path: item.path,
                            size: Number(item.size),
                            date: item.mtime ? new Date(item.mtime) : new Date(),
                            id: item.path,
                            type
                        });
                    }
                }
            }
        } catch (e) {
            // Access denied or path doesn't exist
            // console.log('Skipping ' + dirPath);
        }
    };

    try {
        await scanDir(rootPath);
    } catch (e) {
        // If root scan completely fails, try Downloads/Documents
        await scanDir(`${rootPath}/Download`);
        await scanDir(`${rootPath}/Documents`);
    }

    return documents;
};

export const openFileInExternalApp = (path: string, mimeType: string) => {
    ReactNativeBlobUtil.android.actionViewIntent(path, mimeType)
        .catch((err) => {
            console.warn('Error opening file intent', err);
            ToastAndroid.show('No hay aplicación para abrir este archivo', ToastAndroid.SHORT);
        });
};

export const deleteFile = async (path: string): Promise<boolean> => {
    try {
        await RNFS.unlink(path);
        return true;
    } catch (e) {
        console.warn('Error deleting file', e);
        return false;
    }
};

export const renameFile = async (oldPath: string, newName: string): Promise<boolean> => {
    try {
        const dir = oldPath.substring(0, oldPath.lastIndexOf('/'));
        const newPath = `${dir}/${newName}`;

        await RNFS.moveFile(oldPath, newPath);
        return true;
    } catch (e) {
        console.warn('Error renaming file', e);
        return false;
    }
};

export const formatSize = (bytes: number) => {
    if (bytes === 0) return '0 B';
    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
};
