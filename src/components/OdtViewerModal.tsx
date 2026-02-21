import React, { useState, useEffect, useRef } from 'react';
import { View, Text, Modal, TouchableOpacity, StyleSheet, ActivityIndicator } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';
import { WebView } from 'react-native-webview';
import RNFS from 'react-native-fs';
import { theme } from '../theme';
import { useTheme } from '../theme/ThemeContext';
import { LocalFile } from '../services/FileService';
import { t } from '../i18n';
import JSZip from 'jszip';
import { XMLParser } from 'fast-xml-parser';
import { Buffer } from 'buffer';
import Share from 'react-native-share';
import 'text-encoding';

// Polyfill Buffer
if (typeof global.Buffer === 'undefined') {
    global.Buffer = Buffer;
}

interface Props {
    visible: boolean;
    file: LocalFile | null;
    onClose: () => void;
}

export const OdtViewerModal = ({ visible, file, onClose }: Props) => {
    const { colors, isDarkMode } = useTheme();
    const [htmlContent, setHtmlContent] = useState<string>('');
    const [loading, setLoading] = useState<boolean>(true);
    const [error, setError] = useState<string | null>(null);
    const isSharingRef = useRef(false);

    useEffect(() => {
        if (visible && file && (file.type === 'odf' || file.name.endsWith('.odt'))) {
            loadOdt();
        } else {
            setHtmlContent('');
            setError(null);
            setLoading(false);
        }
    }, [visible, file]);

    const loadOdt = async () => {
        if (!file) return;
        setLoading(true);
        setError(null);

        try {
            console.log('Reading ODT file:', file.path);
            const fileData = await RNFS.readFile(file.path, 'base64');
            const zip = new JSZip();
            const content = await zip.loadAsync(fileData, { base64: true });

            if (!content.files['content.xml']) {
                throw new Error('Invalid ODT file: content.xml not found');
            }

            const xmlContent = await content.files['content.xml'].async('string');

            const parser = new XMLParser({
                ignoreAttributes: false,
                attributeNamePrefix: "@_"
            });
            const jsonObj = parser.parse(xmlContent);

            // Convert ODT XML to HTML
            const convertedHtml = convertOdtToHtml(jsonObj);

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
                            .bold { font-weight: bold; }
                            .italic { font-style: italic; }
                            .underline { text-decoration: underline; }
                        </style>
                    </head>
                    <body>
                        ${convertedHtml}
                    </body>
                </html>
            `;

            setHtmlContent(styledHtml);
            setLoading(false);
        } catch (err: any) {
            console.error('Error converting ODT:', err);
            const msg = err.message || err.toString();
            setError(t('viewer.conversionError', { message: msg }));
            setLoading(false);
        }
    };

    const convertOdtToHtml = (jsonObj: any): string => {
        let html = '';

        try {
            const body = jsonObj['office:document-content']?.['office:body']?.['office:text'];

            if (!body) return '<p>Error: No body content found</p>';

            // Helper to recursively process nodes
            const processNode = (node: any) => {
                let nodeHtml = '';

                // Handle Arrays of nodes (e.g. multiple Paragraphs)
                if (Array.isArray(node)) {
                    node.forEach(item => {
                        nodeHtml += processNode(item);
                    });
                    return nodeHtml;
                }

                // Handle Object nodes
                if (typeof node === 'object' && node !== null) {

                    // Paragraphs
                    if (node['text:p']) {
                        const paragraphs = Array.isArray(node['text:p']) ? node['text:p'] : [node['text:p']];
                        paragraphs.forEach((p: any) => {
                            let content = processTextContent(p);
                            nodeHtml += `<p>${content}</p>`;
                        });
                    }

                    // Headings
                    if (node['text:h']) {
                        const headings = Array.isArray(node['text:h']) ? node['text:h'] : [node['text:h']];
                        headings.forEach((h: any) => {
                            const level = h['@_text:outline-level'] || 1;
                            let content = processTextContent(h);
                            nodeHtml += `<h${level}>${content}</h${level}>`;
                        });
                    }

                    // Lists
                    if (node['text:list']) {
                        const lists = Array.isArray(node['text:list']) ? node['text:list'] : [node['text:list']];
                        lists.forEach((list: any) => {
                            nodeHtml += '<ul>';
                            const items = list['text:list-item'];
                            if (items) {
                                const listItems = Array.isArray(items) ? items : [items];
                                listItems.forEach((item: any) => {
                                    // Recursively process list item content (usually paragraphs)
                                    let itemContent = '';
                                    if (item['text:p']) {
                                        const p = item['text:p'];
                                        const ps = Array.isArray(p) ? p : [p];
                                        ps.forEach((paragraph: any) => {
                                            itemContent += processTextContent(paragraph);
                                        });
                                    } else {
                                        // If not paragraph, try to process as node
                                        itemContent = processNode(item);
                                    }
                                    nodeHtml += `<li>${itemContent}</li>`;
                                });
                            }
                            nodeHtml += '</ul>';
                        });
                    }

                    // Tables
                    if (node['table:table']) {
                        const tables = Array.isArray(node['table:table']) ? node['table:table'] : [node['table:table']];
                        tables.forEach((table: any) => {
                            nodeHtml += '<table>';
                            const rows = table['table:table-row'];
                            if (rows) {
                                const tableRows = Array.isArray(rows) ? rows : [rows];
                                tableRows.forEach((row: any) => {
                                    nodeHtml += '<tr>';
                                    const cells = row['table:table-cell'];
                                    if (cells) {
                                        const tableCells = Array.isArray(cells) ? cells : [cells];
                                        tableCells.forEach((cell: any) => {
                                            let cellContent = '';
                                            if (cell['text:p']) {
                                                const p = cell['text:p'];
                                                const ps = Array.isArray(p) ? p : [p];
                                                ps.forEach((paragraph: any) => {
                                                    cellContent += processTextContent(paragraph);
                                                });
                                            }
                                            nodeHtml += `<td>${cellContent}</td>`;
                                        });
                                    }
                                    nodeHtml += '</tr>';
                                });
                            }
                            nodeHtml += '</table>';
                        });
                    }

                    // Recursively check other keys if they are not explicitly handled (fallback)
                    // This is tricky as we don't want to duplicate content. 
                    // Better separate explicit handling.

                    // If we have a sequence and text:sequence only
                    if (node['text:sequence-decls']) {
                        // ignore
                    }
                }

                return nodeHtml;
            };

            // Helper to extract text from a node (string or object with properties)
            const processTextContent = (content: any): string => {
                if (typeof content === 'string' || typeof content === 'number') {
                    return String(content);
                }

                if (Array.isArray(content)) {
                    return content.map(item => processTextContent(item)).join('');
                }

                if (typeof content === 'object' && content !== null) {
                    let text = '';

                    // Direct text value (fast-xml-parser usually puts text in #text property if attributes exist)
                    if (content['#text']) {
                        text += content['#text'];
                    }

                    // Spans (text:span)
                    if (content['text:span']) {
                        const spans = Array.isArray(content['text:span']) ? content['text:span'] : [content['text:span']];
                        spans.forEach((span: any) => {
                            let spanText = processTextContent(span);
                            // Simple style check (could be improved by parsing style names)
                            const styleName = span['@_text:style-name'];
                            if (styleName && (styleName.includes('Bold') || styleName.includes('strong'))) {
                                spanText = `<b>${spanText}</b>`;
                            }
                            text += spanText;
                        });
                    }

                    // Links (text:a)
                    if (content['text:a']) {
                        const links = Array.isArray(content['text:a']) ? content['text:a'] : [content['text:a']];
                        links.forEach((link: any) => {
                            const href = link['@_xlink:href'];
                            let linkText = processTextContent(link);
                            text += `<a href="${href}">${linkText}</a>`;
                        });
                    }

                    // Tab (text:tab)
                    if (content['text:tab']) {
                        text += '&nbsp;&nbsp;&nbsp;&nbsp;';
                    }

                    // Line break (text:line-break)
                    if (content['text:line-break']) {
                        text += '<br/>';
                    }

                    // Space (text:s)
                    if (content['text:s']) {
                        const count = parseInt(content['@_text:c'] || '1');
                        text += '&nbsp;'.repeat(count);
                    }

                    return text;
                }

                return '';
            };

            // Start processing from body
            // The structure is usually office:text -> sequence-decls, text:p, text:h, etc.
            // We need to iterate over the children of office:text in order.
            // Fast-xml-parser might merge same tags into arrays, losing order if not careful.
            // 'preserveOrder': true option in parser is better for this but harder to traverse JSON.
            // With current config, we iterate keys or standard arrays. 
            // Let's try to just process standard known tags for now.

            // Simple approach: Handle list of standard elements we expect at root
            html = processNode(body);

        } catch (e) {
            console.error('Error parsing ODT XML tree', e);
            return '<p>Error parsing document structure.</p>';
        }

        return html;
    };

    const handleShare = async () => {
        if (!file || isSharingRef.current) return;
        isSharingRef.current = true;

        let tempPath = '';
        try {
            let safeName = (file.name || 'documento.odt').replace(/[^a-zA-Z0-9._\- ]/g, '_');
            if (!safeName.toLowerCase().endsWith('.odt')) {
                safeName += '.odt';
            }
            tempPath = `${RNFS.CachesDirectoryPath}/${safeName}`;

            if (await RNFS.exists(tempPath)) {
                await RNFS.unlink(tempPath);
            }

            await RNFS.copyFile(file.path, tempPath);

            await Share.open({
                url: `file://${tempPath}`,
                type: 'application/vnd.oasis.opendocument.text',
                filename: safeName,
                title: t('viewer.shareTitle'),
                failOnCancel: false,
            });
        } catch (error: any) {
            if (error?.message !== 'User did not share') {
                console.log('Share error:', error);
                try {
                    const base64Data = await RNFS.readFile(file.path, 'base64');
                    await Share.open({
                        url: `data:application/vnd.oasis.opendocument.text;base64,${base64Data}`,
                        title: t('viewer.shareTitle'),
                        type: 'application/vnd.oasis.opendocument.text',
                        failOnCancel: false,
                        filename: file.name || 'documento.odt',
                    });
                } catch (err2) {
                    console.error('Share fallback error:', err2);
                }
            }
        } finally {
            isSharingRef.current = false;
            if (tempPath) {
                try {
                    if (await RNFS.exists(tempPath)) await RNFS.unlink(tempPath);
                } catch (_) { }
            }
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
                    <TouchableOpacity onPress={onClose} style={styles.headerBtn}>
                        <MaterialIcon name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <View style={styles.headerTitleContainer}>
                        <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                            {file?.name || t('viewer.document')}
                        </Text>
                    </View>
                    <TouchableOpacity onPress={handleShare} style={styles.headerBtn}>
                        <MaterialIcon name="share" size={22} color={colors.primary} />
                    </TouchableOpacity>
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
                            <TouchableOpacity style={[styles.retryButton, { backgroundColor: colors.primary }]} onPress={loadOdt}>
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
        paddingHorizontal: 16,
        borderBottomWidth: 1,
        height: 56, // Standard native header height
        gap: 4,
    },
    headerBtn: {
        padding: 6,
    },
    headerTitleContainer: {
        flex: 1,
        alignItems: 'center',
        marginLeft: 16,
        marginRight: 16,
    },
    title: {
        fontSize: 17,
        fontWeight: '600',
        textAlign: 'left',
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
