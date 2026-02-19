import React, { createContext, useContext, useState, useEffect, useMemo } from 'react';
import { StatusBar } from 'react-native';
import { lightColors, darkColors } from './index';
import AsyncStorage from '@react-native-async-storage/async-storage';

const DARK_MODE_KEY = 'dark_mode_enabled';

type ThemeColors = typeof lightColors;

interface ThemeContextType {
    colors: ThemeColors;
    isDarkMode: boolean;
    toggleDarkMode: () => void;
}

const ThemeContext = createContext<ThemeContextType>({
    colors: lightColors,
    isDarkMode: false,
    toggleDarkMode: () => { },
});

export const useTheme = () => useContext(ThemeContext);

export const ThemeProvider = ({ children }: { children: React.ReactNode }) => {
    const [isDarkMode, setIsDarkMode] = useState(false);
    const [isLoaded, setIsLoaded] = useState(false);

    useEffect(() => {
        AsyncStorage.getItem(DARK_MODE_KEY).then(val => {
            if (val === 'true') setIsDarkMode(true);
            setIsLoaded(true);
        });
    }, []);

    const toggleDarkMode = () => {
        setIsDarkMode(prev => {
            const next = !prev;
            AsyncStorage.setItem(DARK_MODE_KEY, next ? 'true' : 'false');
            return next;
        });
    };

    const colors = useMemo(() => isDarkMode ? darkColors : lightColors, [isDarkMode]);

    if (!isLoaded) return null;

    return (
        <ThemeContext.Provider value={{ colors, isDarkMode, toggleDarkMode }}>
            <StatusBar
                barStyle={isDarkMode ? 'light-content' : 'dark-content'}
                backgroundColor={colors.backgroundLight}
            />
            {children}
        </ThemeContext.Provider>
    );
};
