import { useState, useRef } from 'react';
import { LayoutAnimation, Alert } from 'react-native';
import Share from 'react-native-share';
import RNFS from 'react-native-fs';
import { LocalFile, deleteFile, renameFile } from '../services/FileService';
import { StorageService } from '../services/StorageService';
import { t } from '../i18n';

interface UseFileActionsParams {
    files: LocalFile[];
    setFiles: React.Dispatch<React.SetStateAction<LocalFile[]>>;
    favorites: string[];
    loadFavorites: () => Promise<void>;
    scanFiles: () => Promise<void>;
}

export const useFileActions = ({ files, setFiles, favorites, loadFavorites, scanFiles }: UseFileActionsParams) => {
    // Rename/Delete state
    const [renameModalVisible, setRenameModalVisible] = useState(false);
    const [fileToRename, setFileToRename] = useState<LocalFile | null>(null);
    const [confirmDeleteFile, setConfirmDeleteFile] = useState<LocalFile | null>(null);
    const [confirmDeleteVisible, setConfirmDeleteVisible] = useState(false);

    // Undo Delete State
    const [pendingDeleteFile, setPendingDeleteFile] = useState<LocalFile | null>(null);
    const [deletingFileId, setDeletingFileId] = useState<string | null>(null);
    const [restoringFileId, setRestoringFileId] = useState<string | null>(null);

    // Share State - Prevent multiple share dialogs
    const isSharingRef = useRef<boolean>(false);
    const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const animationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleShare = async (file: LocalFile) => {
        if (isSharingRef.current) {
            console.log('Share already in progress, ignoring...');
            return;
        }

        isSharingRef.current = true;
        let destPath = '';
        try {
            destPath = `${RNFS.CachesDirectoryPath}/${file.name}`;

            if (await RNFS.exists(destPath)) {
                await RNFS.unlink(destPath);
            }

            await RNFS.copyFile(file.path, destPath);
            const cleanUrl = `file://${destPath}`;

            await Share.open({
                url: cleanUrl,
                title: t('viewer.shareTitle'),
                failOnCancel: false,
            });
        } catch (error: any) {
            console.log('Copy/Share failed, trying Base64:', error);

            if (error && error.message === 'User did not share') return;

            try {
                const base64Data = await RNFS.readFile(file.path, 'base64');
                let mimeType = 'application/pdf';
                if (file.type === 'doc') mimeType = 'application/msword';
                else if (file.type === 'docx') mimeType = 'application/vnd.openxmlformats-officedocument.wordprocessingml.document';
                else if (file.type === 'odf') mimeType = 'application/vnd.oasis.opendocument.text';

                const dataUrl = `data:${mimeType};base64,${base64Data}`;

                await Share.open({
                    url: dataUrl,
                    title: t('viewer.shareTitle'),
                    type: mimeType,
                    failOnCancel: false,
                    filename: file.name,
                });
            } catch (err2) {
                console.log('Base64 share failed:', err2);
                Alert.alert('Error', t('errors.shareError'));
            }
        } finally {
            isSharingRef.current = false;

            if (destPath) {
                try {
                    if (await RNFS.exists(destPath)) {
                        await RNFS.unlink(destPath);
                    }
                } catch (e) {
                    // ignore
                }
            }
        }
    };

    const handleFavorite = async (file: LocalFile) => {
        await StorageService.toggleFavorite(file.path);
        loadFavorites(); // refresh
    };

    const handleDelete = (file: LocalFile) => {
        setConfirmDeleteFile(file);
        setConfirmDeleteVisible(true);
    };

    const commitDeleteNow = async (file: LocalFile) => {
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        setPendingDeleteFile(null);
        const success = await deleteFile(file.path);
        if (!success) {
            scanFiles();
        }
    };

    const performDelete = (file: LocalFile) => {
        if (pendingDeleteFile) {
            commitDeleteNow(pendingDeleteFile);
        }

        setDeletingFileId(file.path);

        if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
        animationTimerRef.current = setTimeout(() => {
            LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
            setFiles(prev => prev.filter(f => f.path !== file.path));
            setDeletingFileId(null);
            setPendingDeleteFile(file);

            if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            deleteTimerRef.current = setTimeout(() => {
                commitDeleteNow(file);
            }, 3000);
        }, 300);
    };

    const handleUndoDelete = () => {
        if (!pendingDeleteFile) return;
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        const fileToRestore = pendingDeleteFile;
        LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
        setFiles(prev => [...prev, fileToRestore]);
        setRestoringFileId(fileToRestore.path);
        setPendingDeleteFile(null);
        setTimeout(() => {
            setRestoringFileId(null);
        }, 400);
    };

    const onRenameFile = async (newName: string) => {
        if (!fileToRename) return;

        // Check if currently a favorite before renaming
        const wasFavorite = favorites.includes(fileToRename.path);
        const oldPath = fileToRename.path; // capture old path

        const success = await renameFile(fileToRename.path, newName);
        if (success) {
            if (wasFavorite) {
                // Calculate new path based on how renameFile does it (same folder)
                const lastSlash = oldPath.lastIndexOf('/');
                const newPath = oldPath.substring(0, lastSlash + 1) + newName;
                await StorageService.replaceFavoritePath(oldPath, newPath);
                loadFavorites(); // Refresh favorites list
            }
            scanFiles();
        }
    };

    // Cleanup timers
    const cleanup = () => {
        if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
        if (animationTimerRef.current) clearTimeout(animationTimerRef.current);
    };

    return {
        renameModalVisible, setRenameModalVisible,
        fileToRename, setFileToRename,
        confirmDeleteFile, confirmDeleteVisible, setConfirmDeleteVisible,
        pendingDeleteFile,
        deletingFileId,
        restoringFileId,
        handleShare,
        handleFavorite,
        handleDelete,
        performDelete,
        handleUndoDelete,
        onRenameFile,
        cleanup,
    };
};
