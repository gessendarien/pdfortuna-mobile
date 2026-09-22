import { useEffect, useState } from 'react';
import { StorageService } from '../services/StorageService';

export const useSettings = () => {
    const [isGridView, setIsGridView] = useState(false);
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    // Previews: ALWAYS true by default as requested
    const [showPreviews, setShowPreviews] = useState(true);
    const [showWord, setShowWord] = useState(false);
    const [openWordInApp, setOpenWordInApp] = useState(false);
    const [showODF, setShowODF] = useState(false);

    // Load persisted settings
    useEffect(() => {
        const load = async () => {
            const prefs = await StorageService.loadSettings();
            if (prefs) {
                setShowPreviews(true);

                const office = prefs.showOffice !== undefined
                    ? !!prefs.showOffice
                    : (prefs.showWord !== undefined ? !!prefs.showWord : !!prefs.showODF);
                setShowWord(office);
                setShowODF(office);

                const openOffice = prefs.openOfficeInApp !== undefined
                    ? !!prefs.openOfficeInApp
                    : !!prefs.openWordInApp;
                setOpenWordInApp(openOffice);

                // Remember last chosen view mode (grid vs list)
                if (prefs.isGridView !== undefined) {
                    setIsGridView(!!prefs.isGridView);
                } else if (prefs.startupViewMode !== undefined) {
                    setIsGridView(!!prefs.startupViewMode);
                }
            }
            setIsSettingsLoaded(true);
        };
        load();
    }, []);

    // Save settings whenever view mode or office settings change
    useEffect(() => {
        if (!isSettingsLoaded) return;
        StorageService.saveSettings({
            showPreviews: true,
            showWord,
            openWordInApp,
            showODF: showWord,
            isGridView,
            showOffice: showWord,
            openOfficeInApp: openWordInApp,
        });
    }, [isSettingsLoaded, showWord, openWordInApp, isGridView]);

    const setOffice = (val: boolean) => {
        setShowWord(val);
        setShowODF(val);
    };

    return {
        isGridView,
        setIsGridView,
        isSettingsLoaded,
        showPreviews,
        setShowPreviews,
        showWord,
        setShowWord: setOffice,
        openWordInApp,
        setOpenWordInApp,
        showODF,
        setShowODF: setOffice,
    };
};
