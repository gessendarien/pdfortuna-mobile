import React, { useEffect, useRef, useState } from 'react';
import { Text, ScrollView, Animated, StyleProp, TextStyle } from 'react-native';

interface MarqueeTextProps {
    text: string;
    style?: StyleProp<TextStyle>;
}

/** Marquee text: auto-scrolls smoothly if text overflows its container */
export const MarqueeText = ({ text, style }: MarqueeTextProps) => {
    const scrollRef = useRef<ScrollView>(null);
    const animValue = useRef(new Animated.Value(0)).current;
    const [contentW, setContentW] = useState(0);
    const [containerW, setContainerW] = useState(0);
    const animRef = useRef<Animated.CompositeAnimation | null>(null);

    const overflow = contentW - containerW;
    const needsScroll = overflow > 5;

    useEffect(() => {
        // Drive the ScrollView position from the animated value
        const listenerId = animValue.addListener(({ value }) => {
            scrollRef.current?.scrollTo({ x: value, animated: false });
        });
        return () => animValue.removeListener(listenerId);
    }, [animValue]);

    useEffect(() => {
        animValue.setValue(0);
        if (animRef.current) animRef.current.stop();

        if (needsScroll) {
            animRef.current = Animated.loop(
                Animated.sequence([
                    // Pause at start (1.5s)
                    Animated.delay(1500),
                    // Scroll forward slowly (~40ms per pixel = smooth reading speed)
                    Animated.timing(animValue, {
                        toValue: overflow,
                        duration: overflow * 40,
                        useNativeDriver: false,
                    }),
                    // Stay at end for 4 seconds
                    Animated.delay(4000),
                    // Return quickly
                    Animated.timing(animValue, {
                        toValue: 0,
                        duration: 400,
                        useNativeDriver: false,
                    }),
                    // Brief pause before restarting
                    Animated.delay(800),
                ])
            );
            animRef.current.start();
        }

        return () => {
            if (animRef.current) animRef.current.stop();
        };
    }, [needsScroll, overflow]);

    return (
        <ScrollView
            ref={scrollRef}
            horizontal
            showsHorizontalScrollIndicator={false}
            scrollEnabled={false}
            style={{ flex: 1 }}
            onLayout={e => setContainerW(e.nativeEvent.layout.width)}
            onContentSizeChange={(w) => setContentW(w)}
        >
            <Text style={style}>{text}</Text>
        </ScrollView>
    );
};
