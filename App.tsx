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

import { GestureHandlerRootView } from 'react-native-gesture-handler';

function App(): React.JSX.Element {
  return (
    <GestureHandlerRootView style={{ flex: 1 }}>
      <SafeAreaProvider>
        <StatusBar barStyle="dark-content" backgroundColor={theme.colors.backgroundLight} />
        <NavigationContainer>
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
