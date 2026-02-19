import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'favorites_pdf_paths';
const PERMISSION_SHOWN_KEY = 'permission_dialog_shown';
const PAGE_HISTORY_KEY = 'document_page_history';

export const StorageService = {
    async getFavorites(): Promise<string[]> {
        try {
            const json = await AsyncStorage.getItem(FAVORITES_KEY);
            return json ? JSON.parse(json) : [];
        } catch { return []; }
    },

    async toggleFavorite(path: string): Promise<boolean> {
        const favorites = await this.getFavorites();
        let newFavorites;
        const exists = favorites.includes(path);
        if (exists) {
            newFavorites = favorites.filter(p => p !== path);
        } else {
            newFavorites = [...favorites, path];
        }
        await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
        return !exists;
    },

    async isFavorite(path: string): Promise<boolean> {
        const favorites = await this.getFavorites();
        return favorites.includes(path);
    },

    async replaceFavoritePath(oldPath: string, newPath: string): Promise<void> {
        const favorites = await this.getFavorites();
        if (favorites.includes(oldPath)) {
            const newFavorites = favorites.map(p => p === oldPath ? newPath : p);
            await AsyncStorage.setItem(FAVORITES_KEY, JSON.stringify(newFavorites));
        }
    },

    async setPermissionAlreadyRequested() {
        await AsyncStorage.setItem(PERMISSION_SHOWN_KEY, 'true');
    },

    async hasPermissionBeenRequested(): Promise<boolean> {
        const val = await AsyncStorage.getItem(PERMISSION_SHOWN_KEY);
        return val === 'true';
    },

    // Page History Persistence
    async getPageHistory(): Promise<Record<string, number>> {
        try {
            const json = await AsyncStorage.getItem(PAGE_HISTORY_KEY);
            return json ? JSON.parse(json) : {};
        } catch { return {}; }
    },

    async savePage(path: string, page: number) {
        try {
            const history = await this.getPageHistory();
            history[path] = page;
            // Optional: Limit size to latest 500 entries to save resources
            const entries = Object.entries(history);
            if (entries.length > 500) {
                // Simple truncation strategy: keep the last 500 keys (assuming insertion order is roughly preserved or irrelevant for now)
                // A true LRU would require storing timestamps. For now, simple object store is efficient enough.
            }
            await AsyncStorage.setItem(PAGE_HISTORY_KEY, JSON.stringify(history));
        } catch (e) {
            console.log('Error saving page history', e);
        }
    },

    async getPage(path: string): Promise<number> {
        const history = await this.getPageHistory();
        return history[path] || 1;
    },

    // User Settings Persistence
    async saveSettings(settings: any) {
        try {
            await AsyncStorage.setItem('user_settings', JSON.stringify(settings));
        } catch (e) {
            console.log('Error saving settings', e);
        }
    },

    async loadSettings() {
        try {
            const json = await AsyncStorage.getItem('user_settings');
            if (json) {
                return JSON.parse(json);
            }
        } catch (e) {
            console.log('Error loading settings', e);
        }
        // Default settings (First time load) -> All False by default
        return {
            showPreviews: false,
            showWord: false,     // Default disabled
            openWordInApp: false, // Default disabled
            showODF: false,      // Default disabled
            startupViewMode: false,
            isGridView: false // Legacy, can be ignored or used for migration
        };
    }
};
