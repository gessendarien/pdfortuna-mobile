import React, { useEffect, useRef } from 'react';
import { View, StyleSheet, Animated, Easing } from 'react-native';
import { useTheme } from '../theme/ThemeContext';

interface Props {
    trigger: boolean;
}

const PARTICLE_COUNT = 12;
const RADIUS = 35;

export const FavoriteParticles = ({ trigger }: Props) => {
    const { colors } = useTheme();
    const COLORS = [colors.primary, '#ef4444', '#f59e0b', '#3b82f6'];
    // Array of animations for each particle
    const particles = useRef([...Array(PARTICLE_COUNT)].map(() => new Animated.Value(0))).current;

    useEffect(() => {
        if (trigger) {
            // Reset
            particles.forEach(p => p.setValue(0));

            // Animate all
            const animations = particles.map((p, i) => {
                return Animated.timing(p, {
                    toValue: 1,
                    duration: 700,
                    easing: Easing.out(Easing.cubic),
                    useNativeDriver: true,
                    delay: 0,
                });
            });

            Animated.parallel(animations).start();
        }
    }, [trigger]);

    if (!trigger) return null;

    return (
        <View style={styles.container} pointerEvents="none">
            {particles.map((anim, i) => {
                const angle = (i * 2 * Math.PI) / PARTICLE_COUNT;
                const translateX = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.cos(angle) * RADIUS]
                });
                const translateY = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [0, Math.sin(angle) * RADIUS]
                });
                const opacity = anim.interpolate({
                    inputRange: [0, 0.7, 1],
                    outputRange: [1, 1, 0]
                });
                const scale = anim.interpolate({
                    inputRange: [0, 1],
                    outputRange: [1.5, 0]
                });

                return (
                    <Animated.View
                        key={i}
                        style={[
                            styles.particle,
                            {
                                backgroundColor: COLORS[i % COLORS.length],
                                opacity,
                                transform: [
                                    { translateX },
                                    { translateY },
                                    { scale }
                                ]
                            }
                        ]}
                    />
                );
            })}
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 999,
        overflow: 'visible',
    },
    particle: {
        width: 6,
        height: 6,
        borderRadius: 3,
        position: 'absolute',
    },
});
