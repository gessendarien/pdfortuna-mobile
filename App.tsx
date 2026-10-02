import React from 'react';
import { NavigationContainer, createNavigationContainerRef } from '@react-navigation/native';
import { createNativeStackNavigator } from '@react-navigation/native-stack';
import { HomeScreen } from './src/screens/HomeScreen';
import { PdfViewerScreen } from './src/screens/PdfViewerScreen';
import { PdfToolScreen } from './src/screens/PdfToolScreen';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { ThemeProvider, useTheme } from './src/theme/ThemeContext';
import './src/i18n'; // Initialize i18n

export type RootStackParamList = {
  Home: { targetTab?: 'documents' | 'favorites' | 'tools' | 'settings'; targetSubTab?: 'all' | 'recent' | 'scanner' } | undefined;
  PdfViewer: { uri: string; name: string; isExternal?: boolean };
  PdfTool: { toolId: string; initialPdfUri?: string; initialPdfName?: string };
};

const Stack = createNativeStackNavigator<RootStackParamList>();

import { useRef, useEffect } from 'react';
import { handleIncomingIntent, resolveIncomingFile } from './src/utils/FileOpenerUtils';
import { GestureHandlerRootView } from 'react-native-gesture-handler';
import { Linking } from 'react-native';
import { ErrorBoundary } from './src/components/ErrorBoundary';

const navigationRef = createNavigationContainerRef<any>();

function AppContent(): React.JSX.Element {
  const { colors } = useTheme();

  const initialHandledRef = useRef(false);
  const pendingNavigationRef = useRef<any>(null);

  const navigateToViewer = (fileInfo: any) => {
    if (navigationRef.isReady()) {
      console.log("Navigator is ready, navigating to PdfViewer:", fileInfo);
      navigationRef.navigate('PdfViewer', fileInfo);
    } else {
      console.log("Navigator not ready yet, queuing navigation for onReady:", fileInfo);
      pendingNavigationRef.current = fileInfo;
    }
  };

  // Smart handler: caches content:// URIs safely and resolves the real filename
  const handleUrl = async (url: string | null) => {
    if (!url) return;
    try {
      console.log("Incoming URL:", url);
      const fileInfo = await resolveIncomingFile(url);
      navigateToViewer(fileInfo);
    } catch (e) {
      console.warn('Error handling incoming URL:', e);
    }
  };

  const checkInitialIntent = async () => {
    if (initialHandledRef.current) return;
    try {
      // 1. Try native IntentReader
      const fileInfo = await handleIncomingIntent();
      if (fileInfo) {
        initialHandledRef.current = true;
        console.log("Opening via handleIncomingIntent:", fileInfo);
        navigateToViewer(fileInfo);
        return;
      }

      // 2. Fallback: Check Linking.getInitialURL
      const url = await Linking.getInitialURL();
      if (url) {
        initialHandledRef.current = true;
        await handleUrl(url);
      }
    } catch (e) {
      console.warn('Error during cold start intent handling:', e);
    }
  };

  const onNavigationReady = () => {
    console.log("NavigationContainer onReady fired!");
    if (pendingNavigationRef.current) {
      const fileInfo = pendingNavigationRef.current;
      pendingNavigationRef.current = null;
      console.log("Executing queued navigation on ready:", fileInfo);
      navigationRef.navigate('PdfViewer', fileInfo);
    } else {
      checkInitialIntent();
    }
  };

  useEffect(() => {
    // Check initial intent as soon as component mounts
    checkInitialIntent();

    // Warm Start: Listen for new intents while app is in background/foreground
    const subscription = Linking.addEventListener('url', ({ url }) => {
      handleUrl(url);
    });

    return () => {
      subscription.remove();
    };
  }, []);

  return (
    <SafeAreaProvider>
      <NavigationContainer ref={navigationRef} onReady={onNavigationReady}>
        <Stack.Navigator screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: colors.backgroundLight },
          headerStyle: { backgroundColor: colors.backgroundLight },
          headerTintColor: colors.primary,
        }}>
          <Stack.Screen name="Home" component={HomeScreen} />
          <Stack.Screen
            name="PdfViewer"
            component={PdfViewerScreen}
            options={({ route }) => ({ title: route.params.name, headerShown: true, headerTintColor: colors.primary })}
          />
          <Stack.Screen
            name="PdfTool"
            component={PdfToolScreen}
            options={{ headerShown: false }}
          />
        </Stack.Navigator>
      </NavigationContainer>
    </SafeAreaProvider>
  );
}

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <ErrorBoundary>
        <ThemeProvider>
          <AppContent />
        </ThemeProvider>
      </ErrorBoundary>
    </GestureHandlerRootView>
  );
}

export default App;
