import React, { useEffect, useRef } from 'react';
import { View, Text, TouchableOpacity, StyleSheet, Animated } from 'react-native';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { t } from '../i18n';

interface UndoToastProps {
    visible: boolean;
    message: string;
    onUndo: () => void;
}

export const UndoToast: React.FC<UndoToastProps> = ({ visible, message, onUndo }) => {
    const { colors, isDarkMode } = useTheme();
    const fadeAnim = useRef(new Animated.Value(0)).current;

    const [show, setShow] = React.useState(visible);

    useEffect(() => {
        if (visible) {
            setShow(true);
            Animated.timing(fadeAnim, {
                toValue: 1,
                duration: 300,
                useNativeDriver: true,
            }).start();
        } else {
            Animated.timing(fadeAnim, {
                toValue: 0,
                duration: 300,
                useNativeDriver: true,
            }).start(({ finished }) => {
                if (finished) setShow(false);
            });
        }
    }, [visible, fadeAnim]);

    if (!show) return null;

    return (
        <Animated.View style={[styles.container, { opacity: fadeAnim, backgroundColor: isDarkMode ? '#2a2a2a' : '#333' }]}>
            <Text style={styles.text}>{message}</Text>
            <TouchableOpacity onPress={onUndo} style={styles.button}>
                <Text style={[styles.buttonText, { color: colors.primary }]}>{t('delete.undo')}</Text>
            </TouchableOpacity>
        </Animated.View>
    );
};

const styles = StyleSheet.create({
    container: {
        position: 'absolute',
        bottom: 24,
        left: 20,
        right: 20,
        borderRadius: 8,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingVertical: 14,
        paddingHorizontal: 16,
        elevation: 6,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.25,
        shadowRadius: 3.84,
    },
    text: {
        color: '#fff',
        fontSize: 14,
        fontWeight: '500',
    },
    button: {
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    buttonText: {
        fontWeight: 'bold',
        fontSize: 14,
        textTransform: 'uppercase',
    },
});
