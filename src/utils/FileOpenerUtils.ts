import { Platform, NativeModules } from 'react-native';
import ReactNativeBlobUtil from 'react-native-blob-util';

const ContentUriHelper = NativeModules.ContentUriHelper;
const IntentReader = NativeModules.IntentReader;

/**
 * Try to get the real display name from a content:// URI.
 * Uses multiple strategies: native ContentResolver columns, stat, path parsing.
 */
const resolveNameFromUri = async (decodedUrl: string, originalUrl?: string): Promise<string> => {
    let fileName = 'Documento';

    if (!decodedUrl.startsWith('content://')) {
        // file:// or other — just extract from path
        const parts = decodedUrl.split('/');
        if (parts.length > 0) {
            const last = parts[parts.length - 1];
            if (last && last.length > 0) fileName = last;
        }
        return fileName;
    }

    // Strategy 1: Native ContentUriHelper (tries DISPLAY_NAME, _data, title columns)
    if (ContentUriHelper) {
        try {
            const orig = originalUrl || decodedUrl;
            // Use getFileNameTryBoth if available (tries both decoded and original URIs)
            if (ContentUriHelper.getFileNameTryBoth) {
                const realName = await ContentUriHelper.getFileNameTryBoth(decodedUrl, orig);
                if (realName && realName.length > 0) {
                    fileName = realName;
                    // If it looks like a real name, return immediately
                    if (!isUuidLike(fileName)) return fileName;
                }
            } else {
                const realName = await ContentUriHelper.getFileName(decodedUrl);
                if (realName && realName.length > 0) {
                    fileName = realName;
                    if (!isUuidLike(fileName)) return fileName;
                }
            }
        } catch (modErr) {
            console.log("ContentUriHelper error:", modErr);
        }
    }

    // Strategy 2: ReactNativeBlobUtil stat
    try {
        const stat = await ReactNativeBlobUtil.fs.stat(decodedUrl);
        if (stat.filename && !isUuidLike(stat.filename)) {
            return stat.filename;
        }
    } catch (statErr) { }

    // Strategy 3: Extract from URL path as last resort
    const parts = decodedUrl.split('/');
    if (parts.length > 0) {
        const last = parts[parts.length - 1];
        if (last && last.length > 0 && !isUuidLike(last)) {
            fileName = last;
        }
    }

    return fileName;
};

/** Check if a string looks like a UUID/hex ID rather than a real filename */
const isUuidLike = (name: string): boolean => {
    return /^[0-9a-fA-F\-]{30,}$/.test(name) || /^\d+$/.test(name);
};

/**
 * Resolves an incoming file URI (cold or warm start).
 * For content:// URIs on Android, securely copies the file to the app's internal cache
 * using the Activity's ContentResolver while transient read permissions from Gmail/external apps are valid.
 */
export const resolveIncomingFile = async (rawUrl: string): Promise<{ uri: string; name: string; isExternal: boolean }> => {
    if (Platform.OS === 'android' && rawUrl.startsWith('content://')) {
        if (IntentReader && typeof IntentReader.copyContentUri === 'function') {
            try {
                const res = await IntentReader.copyContentUri(rawUrl);
                if (res && res.localUri) {
                    console.log("Successfully cached content:// URI to local file:", res.localUri, "name:", res.name);
                    return { uri: res.localUri, name: res.name || 'documento.pdf', isExternal: true };
                }
            } catch (copyErr) {
                console.warn("IntentReader.copyContentUri failed, falling back to direct resolution:", copyErr);
            }
        }
    }

    // Fallback or file:// URI:
    let decodedUrl = rawUrl;
    try {
        decodedUrl = decodeURIComponent(rawUrl);
    } catch (_) {}

    let fileName = await resolveNameFromUri(decodedUrl, rawUrl);
    if (!fileName || fileName.trim().length === 0) fileName = 'Documento_Externo.pdf';
    fileName = fileName.replace(/\.+$/, '');
    const lower = fileName.toLowerCase();
    if (!lower.endsWith('.pdf') && !lower.endsWith('.docx') && !lower.endsWith('.doc') && !lower.endsWith('.odt') && !lower.endsWith('.odf')) {
        fileName += '.pdf';
    }

    return { uri: rawUrl, name: fileName, isExternal: true };
};

export const handleIncomingIntent = async (): Promise<{ uri: string; name: string; isExternal: boolean } | null> => {
    if (Platform.OS === 'android') {
        try {
            let fileUrl: string | null = null;
            if (IntentReader && typeof IntentReader.getInitialUrl === 'function') {
                fileUrl = await IntentReader.getInitialUrl();
            }
            if (fileUrl) {
                return await resolveIncomingFile(fileUrl);
            }
        } catch (e) {
            console.log("Error handling intent:", e);
        }
    }
    return null;
};

/**
 * Resolve the display name from a content:// or file:// URI.
 * Used by App.tsx when Linking captures the URL directly.
 */
export const resolveContentUriName = async (uri: string, originalUri?: string): Promise<string> => {
    let name = await resolveNameFromUri(uri, originalUri);

    // Remove trailing dots to prevent "name..pdf"
    name = name.replace(/\.+$/, '');

    // Ensure PDF extension
    const lower = name.toLowerCase();
    if (name !== 'Documento Externo' && !lower.endsWith('.pdf') && !lower.endsWith('.docx') && !lower.endsWith('.doc') && !lower.endsWith('.odt') && !lower.endsWith('.odf')) {
        return name + '.pdf';
    }

    return name;
};
