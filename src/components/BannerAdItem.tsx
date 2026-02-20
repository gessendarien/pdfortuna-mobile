import React, { useState } from 'react';
import { View, StyleSheet } from 'react-native';
import { BannerAd, BannerAdSize } from 'react-native-google-mobile-ads';
import { theme } from '../theme';

interface Props {
    unitId: string;
}

export const BannerAdItem = ({ unitId }: Props) => {
    const [loaded, setLoaded] = useState(false);
    const [error, setError] = useState(false);

    if (error) return null;

    return (
        <View style={styles.wrapper}>
            <View style={styles.mask}>
                <BannerAd
                    unitId={unitId}
                    size={BannerAdSize.ANCHORED_ADAPTIVE_BANNER}
                    requestOptions={{
                        requestNonPersonalizedAdsOnly: true,
                    }}
                    onAdLoaded={() => setLoaded(true)}
                    onAdFailedToLoad={(err) => {
                        console.log('Ad Failed to Load:', err);
                        setError(true);
                    }}
                />
            </View>
            {!loaded && <View style={styles.placeholder} />}
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        marginHorizontal: theme.spacing.s,
        marginBottom: theme.spacing.l,
    },
    mask: {
        borderRadius: theme.borderRadius.l,
        overflow: 'hidden',
    },
    placeholder: {
        width: '100%',
        height: 50,
    }
});
