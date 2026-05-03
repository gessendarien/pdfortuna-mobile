/**
 * @format
 */

import 'react-native-gesture-handler';
import { AppRegistry, LogBox } from 'react-native';
import App from './App';
import { name as appName } from './app.json';

// Suppress non-critical warnings that flood the console
LogBox.ignoreLogs([
    'Non-serializable values were found in the navigation state',
    'Sending `onAnimatedValueUpdate` with no listeners registered',
]);

// Catch unhandled promise rejections to prevent silent crashes
if (global.ErrorUtils) {
    const originalHandler = global.ErrorUtils.getGlobalHandler();
    global.ErrorUtils.setGlobalHandler((error, isFatal) => {
        console.error('Global error:', error, 'isFatal:', isFatal);
        if (originalHandler) {
            originalHandler(error, isFatal);
        }
    });
}

AppRegistry.registerComponent(appName, () => App);
