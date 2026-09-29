import React, { useState } from 'react';
import {
    View,
    Text,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    StyleProp,
    ViewStyle,
    TextInput,
    Modal,
} from 'react-native';
import Pdf from 'react-native-pdf';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../../theme/ThemeContext';

export interface PdfCompactPreviewProps {
    sourcePath: string;
    totalPages: number;
    currentPage?: number;
    onPageChange?: (page: number) => void;
    height?: number;
    containerStyle?: StyleProp<ViewStyle>;
}

export const PdfCompactPreview: React.FC<PdfCompactPreviewProps> = ({
    sourcePath,
    totalPages,
    currentPage,
    onPageChange,
    height = 230,
    containerStyle,
}) => {
    const { colors } = useTheme();
    const [internalPage, setInternalPage] = useState<number>(1);
    const [isLoading, setIsLoading] = useState<boolean>(true);
    const [hasError, setHasError] = useState<boolean>(false);
    const [isEditingPage, setIsEditingPage] = useState<boolean>(false);
    const [jumpInput, setJumpInput] = useState<string>('');
    const [modalVisible, setModalVisible] = useState<boolean>(false);
    const [modalPage, setModalPage] = useState<number>(1);

    const activePage = currentPage !== undefined ? currentPage : internalPage;

    const handlePageChange = (newPage: number) => {
        const clamped = Math.max(1, Math.min(totalPages, newPage));
        if (currentPage === undefined) {
            setInternalPage(clamped);
        }
        onPageChange?.(clamped);
    };

    const handleStartJump = () => {
        setJumpInput(activePage.toString());
        setIsEditingPage(true);
    };

    const handleApplyJump = () => {
        const parsed = parseInt(jumpInput.trim(), 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
            handlePageChange(parsed);
        }
        setIsEditingPage(false);
    };

    const handleOpenModal = () => {
        setModalPage(activePage);
        setModalVisible(true);
    };

    const pdfUri = sourcePath.startsWith('file://') ? sourcePath : `file://${sourcePath}`;

    return (
        <View
            style={[
                styles.wrapper,
                {
                    backgroundColor: colors.surfaceLight,
                    borderColor: colors.border,
                },
                containerStyle,
            ]}
        >
            {/* PDF Render Area */}
            <View style={[styles.previewArea, { height }]}>
                {isLoading && (
                    <View style={[styles.loadingOverlay, { backgroundColor: colors.surfaceLight }]}>
                        <ActivityIndicator size="small" color={colors.primary} />
                    </View>
                )}

                {hasError ? (
                    <View style={styles.errorContainer}>
                        <Icon name="broken-image" size={32} color={colors.textSecondary} />
                        <Text style={[styles.errorText, { color: colors.textSecondary }]}>
                            No se pudo previsualizar el documento
                        </Text>
                    </View>
                ) : (
                    <>
                        <Pdf
                            source={{ uri: pdfUri, cache: true }}
                            page={activePage}
                            singlePage={true}
                            scale={1.0}
                            fitPolicy={2}
                            spacing={0}
                            style={styles.pdfView}
                            onLoadComplete={() => {
                                setIsLoading(false);
                                setHasError(false);
                            }}
                            onError={(error) => {
                                console.warn('PdfCompactPreview load error:', error);
                                setIsLoading(false);
                                setHasError(true);
                            }}
                            onPageSingleTap={handleOpenModal}
                        />

                        {/* Interactive touch overlay to open enlarged preview modal */}
                        <TouchableOpacity
                            style={StyleSheet.absoluteFillObject}
                            onPress={handleOpenModal}
                            activeOpacity={0.85}
                        />

                        {/* Corner enlarge indicator badge */}
                        <View style={styles.enlargeBadge} pointerEvents="none">
                            <Icon name="zoom-in" size={15} color="#ffffff" style={{ marginRight: 3 }} />
                            <Text style={styles.enlargeBadgeText}>Tocar para ampliar</Text>
                        </View>
                    </>
                )}
            </View>

            {/* Bottom Page Navigation Bar */}
            <View
                style={[
                    styles.navBar,
                    {
                        borderTopColor: colors.border,
                        backgroundColor: colors.surfaceLight,
                    },
                ]}
            >
                <TouchableOpacity
                    style={[
                        styles.navButton,
                        activePage <= 1 && styles.navButtonDisabled,
                    ]}
                    onPress={() => handlePageChange(activePage - 1)}
                    disabled={activePage <= 1}
                    activeOpacity={0.7}
                >
                    <Icon
                        name="chevron-left"
                        size={22}
                        color={activePage <= 1 ? colors.border : colors.text}
                    />
                </TouchableOpacity>

                {isEditingPage ? (
                    <View style={styles.jumpContainer}>
                        <TextInput
                            style={[
                                styles.jumpInput,
                                {
                                    color: colors.text,
                                    borderColor: colors.primary,
                                    backgroundColor: colors.backgroundLight,
                                },
                            ]}
                            value={jumpInput}
                            onChangeText={setJumpInput}
                            keyboardType="number-pad"
                            autoFocus
                            selectTextOnFocus
                            onSubmitEditing={handleApplyJump}
                            onBlur={() => setIsEditingPage(false)}
                            maxLength={4}
                        />
                        <TouchableOpacity
                            style={[styles.jumpOkBtn, { backgroundColor: colors.primary }]}
                            onPress={handleApplyJump}
                            activeOpacity={0.8}
                        >
                            <Text style={styles.jumpOkText}>Ir</Text>
                        </TouchableOpacity>
                    </View>
                ) : (
                    <TouchableOpacity
                        style={styles.pageIndicatorContainer}
                        onPress={handleStartJump}
                        activeOpacity={0.7}
                    >
                        <Text style={[styles.pageIndicatorText, { color: colors.text }]}>
                            Pág. <Text style={styles.pageNumberBold}>{activePage}</Text> de {totalPages}
                        </Text>
                        <Icon
                            name="unfold-more"
                            size={14}
                            color={colors.textSecondary}
                            style={{ marginLeft: 3 }}
                        />
                    </TouchableOpacity>
                )}

                <TouchableOpacity
                    style={[
                        styles.navButton,
                        activePage >= totalPages && styles.navButtonDisabled,
                    ]}
                    onPress={() => handlePageChange(activePage + 1)}
                    disabled={activePage >= totalPages}
                    activeOpacity={0.7}
                >
                    <Icon
                        name="chevron-right"
                        size={22}
                        color={activePage >= totalPages ? colors.border : colors.text}
                    />
                </TouchableOpacity>
            </View>

            {/* Modal for Enlarged Page Preview */}
            <Modal
                visible={modalVisible}
                transparent={true}
                animationType="fade"
                onRequestClose={() => {
                    handlePageChange(modalPage);
                    setModalVisible(false);
                }}
            >
                <View style={styles.modalBackdrop}>
                    <View style={[styles.modalCard, { backgroundColor: colors.surfaceLight }]}>
                        {/* Header */}
                        <View style={[styles.modalHeader, { borderBottomColor: colors.border }]}>
                            <View style={styles.modalHeaderLeft}>
                                <Icon name="visibility" size={20} color={colors.primary} style={{ marginRight: 6 }} />
                                <Text style={[styles.modalHeaderTitle, { color: colors.text }]}>
                                    Página {modalPage} de {totalPages}
                                </Text>
                            </View>

                            <TouchableOpacity
                                onPress={() => {
                                    handlePageChange(modalPage);
                                    setModalVisible(false);
                                }}
                                style={styles.modalCloseBtn}
                                hitSlop={{ top: 12, bottom: 12, left: 12, right: 12 }}
                            >
                                <Icon name="close" size={22} color={colors.text} />
                            </TouchableOpacity>
                        </View>

                        {/* Body: Enlarged PDF page with pinch-to-zoom support */}
                        <View style={styles.modalBody}>
                            <Pdf
                                source={{ uri: pdfUri, cache: true }}
                                page={modalPage}
                                scale={1.0}
                                minScale={1.0}
                                maxScale={5.0}
                                fitPolicy={0}
                                spacing={0}
                                enablePaging={true}
                                enableDoubleTapZoom={true}
                                onPageChanged={(page) => setModalPage(page)}
                                style={styles.modalPdf}
                            />
                        </View>

                        {/* Footer: Page navigation + Cerrar button */}
                        <View style={[styles.modalFooter, { borderTopColor: colors.border }]}>
                            {totalPages > 1 ? (
                                <View style={styles.modalNavPill}>
                                    <TouchableOpacity
                                        onPress={() => setModalPage((p) => Math.max(1, p - 1))}
                                        disabled={modalPage <= 1}
                                        style={[styles.modalNavBtn, modalPage <= 1 && { opacity: 0.3 }]}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Icon name="chevron-left" size={24} color={colors.text} />
                                    </TouchableOpacity>

                                    <Text style={[styles.modalNavText, { color: colors.text }]}>
                                        {modalPage} / {totalPages}
                                    </Text>

                                    <TouchableOpacity
                                        onPress={() => setModalPage((p) => Math.min(totalPages, p + 1))}
                                        disabled={modalPage >= totalPages}
                                        style={[styles.modalNavBtn, modalPage >= totalPages && { opacity: 0.3 }]}
                                        hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                    >
                                        <Icon name="chevron-right" size={24} color={colors.text} />
                                    </TouchableOpacity>
                                </View>
                            ) : (
                                <View />
                            )}

                            <TouchableOpacity
                                style={[styles.modalCloseFooterBtn, { borderColor: colors.border }]}
                                onPress={() => {
                                    handlePageChange(modalPage);
                                    setModalVisible(false);
                                }}
                            >
                                <Text style={[styles.modalCloseFooterText, { color: colors.textSecondary }]}>
                                    Cerrar
                                </Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                </View>
            </Modal>
        </View>
    );
};

const styles = StyleSheet.create({
    wrapper: {
        borderRadius: 14,
        borderWidth: 1,
        overflow: 'hidden',
        marginBottom: 16,
    },
    previewArea: {
        width: '100%',
        position: 'relative',
        justifyContent: 'center',
        alignItems: 'center',
    },
    pdfView: {
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
    },
    loadingOverlay: {
        ...StyleSheet.absoluteFillObject,
        justifyContent: 'center',
        alignItems: 'center',
        zIndex: 2,
    },
    errorContainer: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    errorText: {
        fontSize: 12,
        marginTop: 6,
        textAlign: 'center',
    },
    navBar: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 10,
        paddingVertical: 6,
        borderTopWidth: 1,
    },
    navButton: {
        padding: 6,
        borderRadius: 8,
        justifyContent: 'center',
        alignItems: 'center',
    },
    navButtonDisabled: {
        opacity: 0.35,
    },
    pageIndicatorContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderRadius: 8,
    },
    pageIndicatorText: {
        fontSize: 13,
    },
    pageNumberBold: {
        fontWeight: 'bold',
    },
    jumpContainer: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
    },
    jumpInput: {
        borderWidth: 1,
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 2,
        fontSize: 13,
        minWidth: 44,
        textAlign: 'center',
    },
    jumpOkBtn: {
        borderRadius: 6,
        paddingHorizontal: 8,
        paddingVertical: 4,
    },
    jumpOkText: {
        color: '#ffffff',
        fontSize: 12,
        fontWeight: 'bold',
    },
    enlargeBadge: {
        position: 'absolute',
        top: 8,
        right: 8,
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: 'rgba(15, 23, 42, 0.72)',
        borderRadius: 12,
        paddingHorizontal: 8,
        paddingVertical: 4,
        zIndex: 10,
    },
    enlargeBadgeText: {
        color: '#ffffff',
        fontSize: 11,
        fontWeight: '600',
    },
    modalBackdrop: {
        flex: 1,
        backgroundColor: 'rgba(0, 0, 0, 0.75)',
        justifyContent: 'center',
        alignItems: 'center',
        padding: 16,
    },
    modalCard: {
        width: '100%',
        maxWidth: 440,
        height: '84%',
        borderRadius: 18,
        overflow: 'hidden',
        elevation: 10,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 10,
    },
    modalHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 12,
        borderBottomWidth: 1,
    },
    modalHeaderLeft: {
        flexDirection: 'row',
        alignItems: 'center',
    },
    modalHeaderTitle: {
        fontSize: 15,
        fontWeight: '700',
    },
    modalCloseBtn: {
        padding: 4,
    },
    modalBody: {
        flex: 1,
        backgroundColor: '#0f172a',
    },
    modalPdf: {
        flex: 1,
        width: '100%',
        height: '100%',
        backgroundColor: 'transparent',
    },
    modalFooter: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 10,
        borderTopWidth: 1,
    },
    modalNavPill: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 8,
    },
    modalNavBtn: {
        padding: 4,
    },
    modalNavText: {
        fontSize: 13,
        fontWeight: 'bold',
    },
    modalCloseFooterBtn: {
        paddingHorizontal: 18,
        paddingVertical: 8,
        borderRadius: 10,
        borderWidth: 1,
    },
    modalCloseFooterText: {
        fontSize: 13,
        fontWeight: '600',
    },
});
