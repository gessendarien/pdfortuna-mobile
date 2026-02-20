import { TestIds } from 'react-native-google-mobile-ads';
import { ADMOB_BANNER_ID } from '@env';

/**
 * Google AdMob Configuration
 *
 * In development (__DEV__), test ads are shown.
 * In production, the real Banner Ad Unit ID is read from the .env file.
 *
 * IMPORTANT: Do NOT commit this file with real IDs to public repositories.
 * This file is listed in .gitignore.
 */

export const AdConfig = {
    bannerId: __DEV__ ? TestIds.BANNER : ADMOB_BANNER_ID,
};
