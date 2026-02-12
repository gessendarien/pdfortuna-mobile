import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { PdfViewerScreen } from './src/screens/PdfViewerScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { StatusBar } from 'react-native';
import { theme } from './src/theme';

export type RootStackParamList = {
  Home: undefined;
  PdfViewer: { uri: string; name: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

import { useRef, useEffect } from 'react';
import { handleIncomingIntent, resolveContentUriName } from './src/utils/FileOpenerUtils';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Linking } from 'react-native';

function App(): React.JSX.Element {
  const navigationRef = useRef<any>(null);

  useEffect(() => {
    // Smart handler: resolves the real filename via native ContentUriHelper
    const handleUrl = async (url: string | null) => {
      if (!url) return;
      console.log("Incoming URL:", url);

      let decodedUrl = decodeURIComponent(url);

      // Resolve real name using native ContentResolver (pass both decoded and original)
      let name = await resolveContentUriName(decodedUrl, url);

      if (navigationRef.current) {
        console.log("Navigating to viewer with:", decodedUrl, "name:", name);
        navigationRef.current.navigate('PdfViewer', { uri: decodedUrl, name, isExternal: true });
      }
    };

    // Cold Start: always try handleIncomingIntent first (has full name resolution)
    setTimeout(async () => {
      // 1. Try handleIncomingIntent (uses SendIntentAndroid + ContentUriHelper)
      const fileInfo = await handleIncomingIntent();
      if (fileInfo && navigationRef.current) {
        console.log("Opening via handleIncomingIntent:", fileInfo);
        navigationRef.current.navigate('PdfViewer', fileInfo);
        return;
      }

      // 2. Fallback: Check Linking.getInitialURL (handles some intents SendIntent misses)
      const url = await Linking.getInitialURL();
      if (url) {
        await handleUrl(url);
      }
    }, 1000);

    // Warm Start: Listen for new intents while app is in background/foreground
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.backgroundLight} />
        <NavigationContainer ref={navigationRef}>
          <Stack.Navigator screenOptions={{ headerShown: false, contentStyle: { backgroundColor: theme.colors.backgroundLight } }}>
            <Stack.Screen name="Home" component={HomeScreen} />
            <Stack.Screen
              name="PdfViewer"
              component={PdfViewerScreen}
              options={({ route }) => ({ title: route.params.name, headerShown: true, headerTintColor: theme.colors.primary })}
            />
          </Stack.Navigator>
        </NavigationContainer>
      </SafeAreaProvider>
    </GestureHandlerRootView>
  );
}

export default App;
