import { Platform, NativeModules } from 'react-native';
import SendIntentAndroid from 'react-native-send-intent';
import ReactNativeBlobUtil from 'react-native-blob-util';

const ContentUriHelper = NativeModules.ContentUriHelper;

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

export const handleIncomingIntent = async () => {
    if (Platform.OS === 'android') {
        try {
            const fileUrl = await SendIntentAndroid.getFileUrl();
            if (fileUrl) {
                let decodedUrl = decodeURIComponent(fileUrl);
                let fileName = await resolveNameFromUri(decodedUrl, fileUrl);

                // Final safety check
                if (!fileName || fileName.trim().length === 0) fileName = 'Documento_Externo.pdf';

                // Remove trailing dots to prevent "name..pdf"
                fileName = fileName.replace(/\.+$/, '');

                // Ensure PDF extension if missing
                const lower = fileName.toLowerCase();
                if (!lower.endsWith('.pdf') && !lower.endsWith('.docx') && !lower.endsWith('.doc') && !lower.endsWith('.odt') && !lower.endsWith('.odf')) {
                    fileName += '.pdf';
                }

                console.log("Resolved Filename:", fileName);
                return { uri: decodedUrl, name: fileName, isExternal: true };
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
