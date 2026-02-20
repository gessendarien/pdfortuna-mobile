import { useState } from 'react';
import { LocalFile } from '../services/FileService';

export const useDocumentViewers = () => {
    // Docx Viewer
    const [docxFile, setDocxFile] = useState<LocalFile | null>(null);
    const [docxViewerVisible, setDocxViewerVisible] = useState(false);

    // Odt Viewer
    const [odtFile, setOdtFile] = useState<LocalFile | null>(null);
    const [odtViewerVisible, setOdtViewerVisible] = useState(false);

    // Settings & Credits modals
    const [settingsVisible, setSettingsVisible] = useState(false);
    const [creditsVisible, setCreditsVisible] = useState(false);

    const openDocxViewer = (file: LocalFile) => {
        setDocxFile(file);
        setDocxViewerVisible(true);
    };

    const closeDocxViewer = () => {
        setDocxViewerVisible(false);
        setDocxFile(null);
    };

    const openOdtViewer = (file: LocalFile) => {
        setOdtFile(file);
        setOdtViewerVisible(true);
    };

    const closeOdtViewer = () => {
        setOdtViewerVisible(false);
        setOdtFile(null);
    };

    return {
        docxFile, docxViewerVisible, openDocxViewer, closeDocxViewer,
        odtFile, odtViewerVisible, openOdtViewer, closeOdtViewer,
        settingsVisible, setSettingsVisible,
        creditsVisible, setCreditsVisible,
    };
};
