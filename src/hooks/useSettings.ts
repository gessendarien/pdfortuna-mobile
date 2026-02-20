import { useEffect, useState } from 'react';
import { StorageService } from '../services/StorageService';

export const useSettings = () => {
    const [isGridView, setIsGridView] = useState(false);
    const [startupViewMode, setStartupViewMode] = useState(false);
    const [isSettingsLoaded, setIsSettingsLoaded] = useState(false);

    // Default settings: All FALSE (disabled) for new installations
    const [showPreviews, setShowPreviews] = useState(false);
    const [showWord, setShowWord] = useState(false);
    const [openWordInApp, setOpenWordInApp] = useState(false);
    const [showODF, setShowODF] = useState(false);

    // Load persisted settings
    useEffect(() => {
        const load = async () => {
            const prefs = await StorageService.loadSettings();
            if (prefs) {
                if (prefs.showPreviews !== undefined) setShowPreviews(!!prefs.showPreviews);
                if (prefs.showWord !== undefined) setShowWord(!!prefs.showWord);
                if (prefs.openWordInApp !== undefined) setOpenWordInApp(!!prefs.openWordInApp);
                if (prefs.showODF !== undefined) setShowODF(!!prefs.showODF);

                // Load startup view mode
                let startup = false;
                if (prefs.startupViewMode !== undefined) {
                    startup = !!prefs.startupViewMode;
                } else if (prefs.isGridView !== undefined) {
                    // Migration: used old setting
                    startup = !!prefs.isGridView;
                }
                setStartupViewMode(startup);
                setIsGridView(startup); // Set current view to startup preference
            }
            setIsSettingsLoaded(true);
        };
        load();
    }, []);

    // Save settings
    useEffect(() => {
        if (!isSettingsLoaded) return;
        StorageService.saveSettings({
            showPreviews,
            showWord,
            openWordInApp,
            showODF,
            startupViewMode // Save the preferred startup mode, not the current view
        });
    }, [isSettingsLoaded, showPreviews, showWord, openWordInApp, showODF, startupViewMode]);

    return {
        isGridView, setIsGridView,
        startupViewMode, setStartupViewMode,
        isSettingsLoaded,
        showPreviews, setShowPreviews,
        showWord, setShowWord,
        openWordInApp, setOpenWordInApp,
        showODF, setShowODF,
    };
};
