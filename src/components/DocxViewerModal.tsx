import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { LocalFile } from '../services/FileService';
import { t } from '../i18n';
import mammoth from 'mammoth';
import { Buffer } from 'buffer';
import 'text-encoding';

// Polyfill Buffer
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

// Polyfill TextEncoder/TextDecoder
if (typeof global.TextEncoder === 'undefined') {
    global.TextEncoder = require('text-encoding').TextEncoder;
}
if (typeof global.TextDecoder === 'undefined') {
    global.TextDecoder = require('text-encoding').TextDecoder;
}

interface Props {
    visible: boolean;
    file: LocalFile | null;
    onClose: () => void;
}

export const DocxViewerModal = ({ visible, file, onClose }: Props) => {
    const { colors, isDarkMode } = useTheme();
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        if (visible && file && (file.type === 'docx')) {
            loadDocx();
        } else {
            setHtmlContent('');
            setError(null);
            setLoading(false);
        }
    }, [visible, file]);

    const loadDocx = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        try {
            console.log('Reading file:', file.path);
            const fileData = await RNFS.readFile(file.path, 'base64');
            const buffer = Buffer.from(fileData, 'base64');

            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

            console.log('Converting docx... Size:', buffer.length);
            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });

            const html = result.value;
            const messages = result.messages;

            if (messages.length > 0) {
                console.log('Mammoth messages:', messages);
            }

            const bodyBg = isDarkMode ? '#121212' : '#fff';
            const bodyColor = isDarkMode ? '#e2e8f0' : '#333';
            const headingColor = isDarkMode ? '#f1f5f9' : '#1e293b';
            const borderColor = isDarkMode ? '#444' : '#ddd';

            const styledHtml = `
                <html>
                    <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
                        <style>
                            body { 
                                font-family: -apple-system, Roboto, sans-serif; 
                                padding: 20px; 
                                line-height: 1.6;
                                color: ${bodyColor};
                                background-color: ${bodyBg};
                            }
                            img { max-width: 100%; height: auto; }
                            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                            td, th { border: 1px solid ${borderColor}; padding: 8px; }
                            p { margin-bottom: 12px; }
                            h1, h2, h3 { color: ${headingColor}; margin-top: 24px; }
                        </style>
                    </head>
                    <body>
                        ${html}
                    </body>
                </html>
            `;

            setHtmlContent(styledHtml);
            setLoading(false);
        } catch (err: any) {
            console.error('Error converting docx:', err);
            const msg = err.message || err.toString();
            setError(t('viewer.conversionError', { message: msg }));
            setLoading(false);
        }
    };

    if (!visible) return null;

    return (
        <Modal
            visible={visible}
            animationType="slide"
            onRequestClose={onClose}
            presentationStyle="fullScreen"
        >
            <View style={[styles.container, { backgroundColor: colors.surfaceLight }]}>
                {/* Header */}
                <View style={[styles.header, { borderBottomColor: colors.border, backgroundColor: colors.surfaceLight }]}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialIcon name="close" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                        {file?.name || t('viewer.document')}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Content */}
                <View style={[styles.content, { backgroundColor: colors.backgroundLight }]}>
                    {loading ? (
                        <View style={styles.centered}>
                            <ActivityIndicator size="large" color={colors.primary} />
                            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>{t('viewer.converting')}</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.centered}>
                            <MaterialIcon name="error-outline" size={48} color={colors.error} />
                            <Text style={[styles.errorText, { color: colors.textSecondary }]}>{error}</Text>
                            <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={loadDocx}>
                                <Text style={styles.retryText}>{t('viewer.retry')}</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <WebView
                            originWhitelist={['*']}
                            source={{ html: htmlContent }}
                            style={styles.webview}
                            scalesPageToFit={false}
                        />
                    )}
                </View>
            </View>
        </Modal>
    );
};

const styles = StyleSheet.create({
    container: {
        flex: 1,
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 16,
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        height: 80,
    },
    closeButton: {
        padding: 8,
        marginRight: 8,
    },
    title: {
        flex: 1,
        fontSize: 18,
        fontWeight: '600',
        textAlign: 'center',
    },
    content: {
        flex: 1,
    },
    webview: {
        flex: 1,
        backgroundColor: 'transparent',
    },
    centered: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 24,
    },
    loadingText: {
        marginTop: 16,
        fontSize: 16,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        textAlign: 'center',
        marginBottom: 24,
    },
    retryButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontWeight: '600',
    }
});
