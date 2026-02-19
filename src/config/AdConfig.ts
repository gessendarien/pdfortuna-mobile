import { TestIds } from 'react-native-google-mobile-ads';

/**
 * Google AdMob Configuration
 * 
 * IMPORTANT: 
 * 1. For development, we use TestIds.BANNER.
 * 2. For production, replace the string below with your real Ad Unit ID.
 * 3. If you add real IDs, DO NOT commit this file to public repositories.
 *    Add 'src/config/AdConfig.ts' to your .gitignore file.
 */

export const AdConfig = {
    // Current: Test Ad Unit ID
    // Replace 'TestIds.BANNER' with your real Banner Ad Unit ID string for production
    // Example: 'ca-app-pub-3940256099942544/6300978111'
    bannerId: __DEV__ ? TestIds.BANNER : TestIds.BANNER,
};
