import AsyncStorage from '@react-native-async-storage/async-storage';

const FAVORITES_KEY = 'favorites_pdf_paths';
const PERMISSION_SHOWN_KEY = 'permission_dialog_shown';

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

    async setPermissionAlreadyRequested() {
        await AsyncStorage.setItem(PERMISSION_SHOWN_KEY, 'true');
    },

    async hasPermissionBeenRequested(): Promise<boolean> {
        const val = await AsyncStorage.getItem(PERMISSION_SHOWN_KEY);
        return val === 'true';
    }
};
