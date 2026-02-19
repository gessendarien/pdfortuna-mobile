import React, { useState } from 'react';
import { View, StyleSheet, Dimensions } from 'react-native';
import { BannerAd, BannerAdSize, TestIds } from 'react-native-google-mobile-ads';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';

interface Props {
    unitId: string;
}

export const BannerAdItem = ({ unitId }: Props) => {
    const { colors } = useTheme();
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    if (error) return null;

    return (
        <View style={styles.wrapper}>
            <View style={[styles.container, { backgroundColor: colors.surfaceLight }]}>
                <View style={styles.adContainer}>
                    <BannerAd
                        unitId={unitId}
                        size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                        requestOptions={{
                            requestNonPersonalizedAdsOnly: true,
                        }}
                        onAdLoaded={() => {
                            setLoaded(true);
                        }}
                        onAdFailedToLoad={(err) => {
                            console.log('Ad Failed to Load:', err);
                            setError(true);
                        }}
                    />
                </View>
                {!loaded && <View style={styles.placeholder} />}
            </View>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginHorizontal: theme.spacing.s,
        marginBottom: theme.spacing.l,
    },
    container: {
        borderRadius: theme.borderRadius.l,
        paddingVertical: theme.spacing.s,
        paddingHorizontal: 0,
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: "#000",
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.1,
        shadowRadius: 2,
        elevation: 2,
        height: 80,
        overflow: 'hidden',
    },
    adContainer: {
        alignItems: 'center',
        justifyContent: 'center',
        width: '100%',
    },
    placeholder: {
        width: '100%',
        height: 50,
    }
});
