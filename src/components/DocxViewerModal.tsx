import React, { useState, useEffect } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator, Dimensions } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';
import { theme } from '../theme';
import { LocalFile } from '../services/FileService';
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

            // Convert Buffer to ArrayBuffer specifically for mammoth in browser/RN env
            const arrayBuffer = buffer.buffer.slice(buffer.byteOffset, buffer.byteOffset + buffer.byteLength);

            console.log('Converting docx... Size:', buffer.length);
            const result = await mammoth.convertToHtml({ arrayBuffer: arrayBuffer });

            const html = result.value;
            const messages = result.messages;

            if (messages.length > 0) {
                console.log('Mammoth messages:', messages);
            }

            // Wrap in basic HTML structure with some styling
            const styledHtml = `
                <html>
                    <head>
                        <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=3.0">
                        <style>
                            body { 
                                font-family: -apple-system, Roboto, sans-serif; 
                                padding: 20px; 
                                line-height: 1.6;
                                color: #333;
                            }
                            img { max-width: 100%; height: auto; }
                            table { border-collapse: collapse; width: 100%; margin: 10px 0; }
                            td, th { border: 1px solid #ddd; padding: 8px; }
                            p { margin-bottom: 12px; }
                            h1, h2, h3 { color: #1e293b; margin-top: 24px; }
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
            // Show more specific error if possible
            const msg = err.message || err.toString();
            setError(`Error al convertir: ${msg}`);
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
            <View style={styles.container}>
                {/* Header */}
                <View style={styles.header}>
                    <TouchableOpacity onPress={onClose} style={styles.closeButton}>
                        <MaterialIcon name="close" size={24} color={theme.colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.title} numberOfLines={1}>
                        {file?.name || 'Documento'}
                    </Text>
                    <View style={{ width: 40 }} />
                </View>

                {/* Content */}
                <View style={styles.content}>
                    {loading ? (
                        <View style={styles.centered}>
                            <ActivityIndicator size="large" color={theme.colors.primary} />
                            <Text style={styles.loadingText}>Convirtiendo documento...</Text>
                        </View>
                    ) : error ? (
                        <View style={styles.centered}>
                            <MaterialIcon name="error-outline" size={48} color={theme.colors.error || '#ef4444'} />
                            <Text style={styles.errorText}>{error}</Text>
                            <TouchableOpacity style={styles.retryButton} onPress={loadDocx}>
                                <Text style={styles.retryText}>Reintentar</Text>
                            </TouchableOpacity>
                        </View>
                    ) : (
                        <WebView
                            originWhitelist={['*']}
                            source={{ html: htmlContent }}
                            style={styles.webview}
                            scalesPageToFit={false} // Important for responsive text
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
        backgroundColor: '#fff',
    },
    header: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingTop: 16, // Safe area filler approx if no SafeAreaView wrapper
        paddingBottom: 12,
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        borderBottomColor: '#e2e8f0',
        backgroundColor: '#fff',
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
        color: theme.colors.text,
        textAlign: 'center',
    },
    content: {
        flex: 1,
        backgroundColor: '#f8fafc',
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
        color: theme.colors.textSecondary,
    },
    errorText: {
        marginTop: 16,
        fontSize: 16,
        color: theme.colors.textSecondary,
        textAlign: 'center',
        marginBottom: 24,
    },
    retryButton: {
        paddingVertical: 10,
        paddingHorizontal: 20,
        backgroundColor: theme.colors.primary,
        borderRadius: 8,
    },
    retryText: {
        color: '#fff',
        fontWeight: '600',
    }
});
