import RNFS from 'react-native-fs';
import { PermissionsAndroid, Platform, Linking, Alert, NativeModules } from 'react-native';
import SendIntentAndroid from 'react-native-send-intent';
import FileViewer from 'react-native-file-viewer';
import PdfThumbnail from "react-native-pdf-thumbnail";

const { FileOpener } = NativeModules;

export interface LocalFile {
    name: string;
    path: string;
    size: number;
    date: Date;
    type: 'pdf' | 'doc' | 'docx' | 'odf';
}

export const requestFilePermissions = async (): Promise<boolean> => {
    if (Platform.OS === 'android') {
        try {
            if (Platform.Version >= 30) {
                return true;
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
        return await PermissionsAndroid.check(PermissionsAndroid.PERMISSIONS.READ_EXTERNAL_STORAGE);
    }
    return true;
};

// Internal recursive helper
const scanDirRecursive = async (path: string): Promise<LocalFile[]> => {
    const files: LocalFile[] = [];
    try {
        const result = await RNFS.readDir(path);
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
                    });
                }
            } else if (item.isDirectory()) {
                // Ignore hidden folders and Android/data to save time/permissions
                if (!item.name.startsWith('.') && item.name !== 'Android') {
                    const subFiles = await scanDirRecursive(item.path);
                    files.push(...subFiles);
                }
            }
        }
    } catch (e) {
        // console.warn('Error reading ' + path);
    }
    return files;
};

export const scanDocuments = async (): Promise<LocalFile[]> => {
    const folders = [
        RNFS.DownloadDirectoryPath,
        RNFS.DocumentDirectoryPath,
        RNFS.ExternalStorageDirectoryPath + '/Documents',
    ];

    const uniqueFolders = [...new Set(folders)];
    let allFiles: LocalFile[] = [];

    for (const folder of uniqueFolders) {
        if (await RNFS.exists(folder)) {
            const f = await scanDirRecursive(folder);
            allFiles = [...allFiles, ...f];
        }
    }

    // Deduplicate by path
    const distinctFiles = Array.from(new Map(allFiles.map(item => [item.path, item])).values());
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
            if (item.isFile()) {
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
