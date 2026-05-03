import RNFS from 'react-native-fs';
import { PermissionsAndroid, Platform, Linking, Alert, NativeModules } from 'react-native';
import SendIntentAndroid from 'react-native-send-intent';
import FileViewer from 'react-native-file-viewer';
import PdfThumbnail from "react-native-pdf-thumbnail";

const { FileOpener, PdfMeta } = NativeModules;

export interface LocalFile {
    name: string;
    path: string;
    size: number;
    date: Date;
    type: 'pdf' | 'doc' | 'docx' | 'odf';
    pageCount?: number;
}

export const checkFilePermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
        if (Platform.Version >= 30) {
            return await PermissionsAndroid.check('android.permission.MANAGE_EXTERNAL_STORAGE' as any);
        }

        const read = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
        const write = await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE);
        return read && write;
    }
    return true;
};

export const requestFilePermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
        try {
            if (Platform.Version >= 30) {
                // Check if we already have the permission
                const hasPermission = await PermissionsAndroid.check('android.permission.MANAGE_EXTERNAL_STORAGE' as any);
                if (hasPermission) {
                    return true;
                }

                // Use our own native module which implements the correct Intent with package URI
                try {
                    const { PermissionModule } = NativeModules;
                    if (PermissionModule && typeof PermissionModule.openManageAllFilesAccessSettings === 'function') {
                        PermissionModule.openManageAllFilesAccessSettings();
                    } else {
                        // Fallback just in case native module is missing (shouldn't happen)
                        await Linking.openSettings();
                    }
                } catch (e) {
                    console.warn('Native permission request failed', e);
                    try {
                        await Linking.openSettings();
                    } catch (e2) {
                        console.warn('Fallback linking failed', e2);
                    }
                }
                return false;
            }

            const granted = await PermissionsAndroid.requestMultiple([
                PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE,
                PermissionsAndroid.PERMISSIONS.WRITE_EXTERNAL_STORAGE,
            ]);

            return (
                granted['android.permission.READ_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED &&
                granted['android.permission.WRITE_EXTERNAL_STORAGE'] === PermissionsAndroid.RESULTS.GRANTED
            );
        } catch (err) {
            console.warn(err);
            return false;
        }
    }
    return true;
};

export const checkManagePermission = async (): Promise<boolean> => {
    if (Platform.OS === 'android' && Platform.Version >= 30) {
        try {
            const { PermissionModule } = NativeModules;
            if (PermissionModule && typeof PermissionModule.checkManageAllFilesAccessPermission === 'function') {
                return await PermissionModule.checkManageAllFilesAccessPermission();
            }
        } catch (e) {
            console.warn('Native permission check failed', e);
        }
        return await PermissionsAndroid.check('android.permission.MANAGE_EXTERNAL_STORAGE' as any);
    }
    return true;
};

// Concurrency limiter: process promises in batches to prevent OOM
const runWithConcurrency = async <T>(tasks: (() => Promise<T>)[], limit: number): Promise<T[]> => {
    const results: T[] = [];
    let index = 0;
    const runNext = async (): Promise<void> => {
        while (index < tasks.length) {
            const currentIndex = index++;
            try {
                results[currentIndex] = await tasks[currentIndex]();
            } catch (e) {
                results[currentIndex] = [] as any;
            }
        }
    };
    const workers = Array.from({ length: Math.min(limit, tasks.length) }, () => runNext());
    await Promise.all(workers);
    return results;
};

// Internal recursive helper (concurrency-limited)
const scanDirRecursive = async (path: string): Promise<LocalFile[]> => {
    const files: LocalFile[] = [];
    try {
        const result = await RNFS.readDir(path);
        const subDirTasks: (() => Promise<LocalFile[]>)[] = [];

        for (const item of result) {
            if (item.isFile()) {
                const ext = item.name.split('.').pop()?.toLowerCase();
                if (ext === 'pdf' || ext === 'doc' || ext === 'docx' || ext === 'odt' || ext === 'odf') {
                    let type: LocalFile['type'] = 'pdf';
                    if (ext === 'doc') type = 'doc';
                    else if (ext === 'docx') type = 'docx';
                    else if (ext === 'odt' || ext === 'odf') type = 'odf';

                    files.push({
                        name: item.name,
                        path: item.path,
                        size: Number(item.size),
                        date: item.mtime || new Date(),
                        type,
                        // pageCount is enriched after scan to avoid blocking the bridge
                    });
                }
            } else if (item.isDirectory()) {
                // Ignore hidden folders and Android/data to save time/permissions
                if (!item.name.startsWith('.') && item.name !== 'Android') {
                    subDirTasks.push(() => scanDirRecursive(item.path));
                }
            }
        }

        // Scan subdirectories with concurrency limit of 5
        if (subDirTasks.length > 0) {
            const subResults = await runWithConcurrency(subDirTasks, 5);
            for (const subFiles of subResults) {
                if (subFiles) files.push(...subFiles);
            }
        }
    } catch (e) {
        // Silently ignore permission errors or inaccessible dirs
    }
    return files;
};

// Enrich files with page counts in batches (non-blocking)
const enrichWithPageCounts = async (files: LocalFile[]): Promise<void> => {
    if (!PdfMeta || !PdfMeta.getPageCount) return;

    const BATCH_SIZE = 10;
    for (let i = 0; i < files.length; i += BATCH_SIZE) {
        const batch = files.slice(i, i + BATCH_SIZE);
        const promises = batch.map(async (file) => {
            try {
                const count = await PdfMeta.getPageCount(file.path);
                if (typeof count === 'number') {
                    file.pageCount = count;
                }
            } catch (e) {
                // ignore individual failures
            }
        });
        await Promise.all(promises);
    }
};

export const scanDocuments = async (): Promise<LocalFile[]> => {
    const folders = [
        RNFS.DownloadDirectoryPath,
        RNFS.DocumentDirectoryPath,
        RNFS.ExternalStorageDirectoryPath + '/Documents',
    ];

    const uniqueFolders = [...new Set(folders)];

    // Scan all root folders with concurrency limit
    const scanTasks = uniqueFolders.map((folder) => async () => {
        try {
            if (await RNFS.exists(folder)) {
                return await scanDirRecursive(folder);
            }
        } catch (e) {
            // ignore
        }
        return [] as LocalFile[];
    });

    const results = await runWithConcurrency(scanTasks, 3);
    const allFiles = results.flat();

    // Deduplicate by path
    const distinctFiles = Array.from(new Map(allFiles.map(item => [item.path, item])).values());

    // Enrich with page counts after scan (non-blocking batched)
    await enrichWithPageCounts(distinctFiles);

    return distinctFiles;
};

export const deleteFile = async (path: string) => {
    try {
        await RNFS.unlink(path);
        return true;
    } catch (e) {
        console.log('Error deleting file:', e);
        return false;
    }
};

export const renameFile = async (path: string, newName: string) => {
    try {
        const lastSlash = path.lastIndexOf('/');
        const newPath = path.substring(0, lastSlash + 1) + newName;
        await RNFS.moveFile(path, newPath);
        return true;
    } catch (e) {
        console.log('Error renaming file:', e);
        return false;
    }
};

export const openFileInExternalApp = async (path: string, mimeType?: string) => {
    try {
        // Copy file to cache directory to make it accessible
        const fileName = path.split('/').pop() || 'document';
        const tempPath = `${RNFS.CachesDirectoryPath}/${fileName}`;

        if (await RNFS.exists(tempPath)) {
            await RNFS.unlink(tempPath);
        }

        await RNFS.copyFile(path, tempPath);

        // ALWAYS use our native FileOpener directly (no FileViewer interference)
        if (FileOpener && typeof FileOpener.open === 'function') {
            const finalMimeType = mimeType || 'application/octet-stream';
            try {
                await FileOpener.open(tempPath, finalMimeType);
                return;
            } catch (err: any) {
                console.log('FileOpener failed:', err);
                if (err.code === 'NO_APP') {
                    throw new Error('No se encontró ninguna aplicación para abrir este archivo.');
                }
                throw err;
            }
        }

        throw new Error('El módulo nativo FileOpener no está disponible');

    } catch (error: any) {
        console.log('Error opening file:', error);

        Alert.alert(
            'No se puede abrir',
            'No se encontró una aplicación para abrir este archivo. Asegúrate de tener instalada una app como Microsoft Office, WPS Office o Google Docs.'
        );
    }
};

// New cleanup function
export const clearShareCache = async () => {
    try {
        const path = RNFS.CachesDirectoryPath;
        const exists = await RNFS.exists(path);
        if (!exists) return;

        const result = await RNFS.readDir(path);
        for (const item of result) {
            if (item.isFile() && !item.name.startsWith('thumb_')) {
                await RNFS.unlink(item.path);
            }
        }
        console.log('Cache cleared');
    } catch (e) {
        console.log('Error clearing cache:', e);
    }
};

export const getThumbnail = async (filePath: string): Promise<string | null> => {
    try {
        const fileName = filePath.split('/').pop();
        const baseName = fileName ? fileName.replace(/\.[^/.]+$/, "") : "thumb";
        const thumbName = `thumb_${baseName}.jpg`;
        const thumbPath = `${RNFS.CachesDirectoryPath}/${thumbName}`;

        if (await RNFS.exists(thumbPath)) {
            return `file://${thumbPath}`;
        }

        // Generate new thumbnail (page 0)
        const result = await PdfThumbnail.generate(filePath, 0);

        if (result && result.uri) {
            const sourcePath = result.uri.replace('file://', '');
            await RNFS.copyFile(sourcePath, thumbPath);
            return `file://${thumbPath}`;
        }
    } catch (e) {
        // If it's not a PDF or fails, return null usually silently
    }
    return null;
};
