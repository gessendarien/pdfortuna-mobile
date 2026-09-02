import { NativeModules, Platform } from 'react-native';

const { DocumentScannerModule } = NativeModules;

export interface ScanResult {
    success: boolean;
    canceled?: boolean;
    path?: string;
    name?: string;
    pageCount?: number;
    uri?: string;
    error?: string;
}

export interface ScanOptions {
    pageLimit?: number;
    allowGallery?: boolean;
}

export const startDocumentScan = async (options?: ScanOptions): Promise<ScanResult> => {
    if (Platform.OS !== 'android') {
        return { success: false, error: 'Document scanner is only supported on Android' };
    }

    if (!DocumentScannerModule || typeof DocumentScannerModule.startScan !== 'function') {
        return { success: false, error: 'DocumentScannerModule is not available' };
    }

    try {
        const result: ScanResult = await DocumentScannerModule.startScan(options || {});
        return result;
    } catch (error: any) {
        console.error('Error during document scanning:', error);
        return {
            success: false,
            error: error?.message || 'Unknown scan error',
        };
    }
};
