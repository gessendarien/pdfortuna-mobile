import React from 'react';
import { View, StyleSheet, Dimensions, ActivityIndicator, Text } from 'react-native';
import Pdf from 'react-native-pdf';
import { useRoute } from '@react-navigation/native';
import { theme } from '../theme';

export const PdfViewerScreen = () => {
    const route = useRoute<any>();
    const { uri, name } = route.params;

    const source = { uri, cache: true };

    return (
        <View style={styles.container}>
            <Pdf
                source={source}
                onLoadComplete={(numberOfPages, filePath) => {
                    console.log(`Number of pages: ${numberOfPages}`);
                }}
                onPageChanged={(page, numberOfPages) => {
                    console.log(`Current page: ${page}`);
                }}
                onError={(error) => {
                    console.log(error);
                }}
                onPressLink={(uri) => {
                    console.log(`Link pressed: ${uri}`);
                }}
                style={styles.pdf}
                trustAllCerts={false}
            />
        </View>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
        justifyContent: 'flex-start',
        alignItems: 'center',
        backgroundColor: theme.colors.backgroundLight,
    },
    pdf: {
        flex: 1,
        width: Dimensions.get('window').width,
        height: Dimensions.get('window').height,
        backgroundColor: theme.colors.backgroundLight,
    }
});
