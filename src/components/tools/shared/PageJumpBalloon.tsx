import React, { useState, useEffect, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, StyleSheet } from 'react-native';
import MaterialIcon from 'react-native-vector-icons/MaterialIcons';

interface PageJumpBalloonProps {
    visible: boolean;
    currentPage: number;
    totalPages: number;
    onPageChange: (page: number) => void;
    onClose: () => void;
    topOffset?: number;
    rightOffset?: number;
}

export const PageJumpBalloon: React.FC<PageJumpBalloonProps> = ({
    visible,
    currentPage,
    totalPages,
    onPageChange,
    onClose,
    topOffset = 52,
    rightOffset,
}) => {
    const [inputPage, setInputPage] = useState<string>(currentPage.toString());
    const pageInputRef = useRef<TextInput>(null);
    const isEditingRef = useRef(false);
    const debounceTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        if (visible) {
            setInputPage(currentPage.toString());
            const timer = setTimeout(() => {
                pageInputRef.current?.focus();
            }, 100);
            return () => clearTimeout(timer);
        }
    }, [visible, currentPage]);

    if (!visible || totalPages <= 0) return null;

    const handlePrevPage = () => {
        if (currentPage > 1) {
            const next = currentPage - 1;
            setInputPage(next.toString());
            onPageChange(next);
        }
    };

    const handleNextPage = () => {
        if (currentPage < totalPages) {
            const next = currentPage + 1;
            setInputPage(next.toString());
            onPageChange(next);
        }
    };

    const handlePageInputChange = (text: string) => {
        setInputPage(text);
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        const parsed = parseInt(text, 10);
        if (!isNaN(parsed) && parsed >= 1 && parsed <= totalPages) {
            debounceTimerRef.current = setTimeout(() => {
                onPageChange(parsed);
            }, 500);
        }
    };

    const handlePageInputSubmit = () => {
        if (debounceTimerRef.current) {
            clearTimeout(debounceTimerRef.current);
        }
        const parsed = parseInt(inputPage, 10);
        if (!isNaN(parsed)) {
            const clamped = Math.max(1, Math.min(totalPages, parsed));
            onPageChange(clamped);
            setInputPage(clamped.toString());
        } else {
            setInputPage(currentPage.toString());
        }
        onClose();
    };

    return (
        <>
            {/* Backdrop to dismiss when tapping outside */}
            <TouchableOpacity
                style={styles.popoverBackdrop}
                activeOpacity={1}
                onPress={() => {
                    if (isEditingRef.current) {
                        pageInputRef.current?.blur();
                    }
                    onClose();
                }}
            />

            <View
                style={[
                    styles.popoverWrapper,
                    { top: topOffset },
                    rightOffset !== undefined
                        ? { right: rightOffset }
                        : { alignSelf: 'center' },
                ]}
                pointerEvents="box-none"
            >
                {/* Triangular tip pointing up */}
                <View style={styles.popoverArrow} />

                {/* Dark rounded balloon content */}
                <View style={styles.popoverCard}>
                    {/* Number input box */}
                    <View style={styles.pageInputContainer}>
                        <TextInput
                            ref={pageInputRef}
                            style={styles.pageTextInput}
                            value={inputPage}
                            onChangeText={handlePageInputChange}
                            onSubmitEditing={handlePageInputSubmit}
                            onFocus={() => {
                                isEditingRef.current = true;
                            }}
                            onBlur={() => {
                                isEditingRef.current = false;
                                handlePageInputSubmit();
                            }}
                            keyboardType="number-pad"
                            selectTextOnFocus={true}
                            maxLength={4}
                            returnKeyType="done"
                        />
                    </View>

                    {/* Up and Down Chevrons */}
                    <View style={styles.chevronsContainer}>
                        <TouchableOpacity
                            onPress={handlePrevPage}
                            style={styles.chevronButton}
                            activeOpacity={0.6}
                            hitSlop={{ top: 8, bottom: 4, left: 8, right: 8 }}
                        >
                            <MaterialIcon name="keyboard-arrow-up" size={26} color="#ffffff" />
                        </TouchableOpacity>
                        <TouchableOpacity
                            onPress={handleNextPage}
                            style={styles.chevronButton}
                            activeOpacity={0.6}
                            hitSlop={{ top: 4, bottom: 8, left: 8, right: 8 }}
                        >
                            <MaterialIcon name="keyboard-arrow-down" size={26} color="#ffffff" />
                        </TouchableOpacity>
                    </View>
                </View>
            </View>
        </>
    );
};

const styles = StyleSheet.create({
    popoverBackdrop: {
        ...StyleSheet.absoluteFillObject,
        zIndex: 150,
    },
    popoverWrapper: {
        position: 'absolute',
        alignItems: 'center',
        zIndex: 200,
        elevation: 12,
    },
    popoverArrow: {
        width: 0,
        height: 0,
        backgroundColor: 'transparent',
        borderStyle: 'solid',
        borderLeftWidth: 8,
        borderRightWidth: 8,
        borderBottomWidth: 8,
        borderLeftColor: 'transparent',
        borderRightColor: 'transparent',
        borderBottomColor: '#1e293b',
        marginBottom: -1,
    },
    popoverCard: {
        backgroundColor: '#1e293b',
        borderRadius: 14,
        paddingHorizontal: 10,
        paddingVertical: 8,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        borderWidth: 1,
        borderColor: 'rgba(255, 255, 255, 0.15)',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.35,
        shadowRadius: 8,
        elevation: 12,
    },
    pageInputContainer: {
        backgroundColor: '#ffffff',
        borderRadius: 8,
        minWidth: 42,
        height: 40,
        justifyContent: 'center',
        alignItems: 'center',
        paddingHorizontal: 6,
    },
    pageTextInput: {
        fontSize: 19,
        fontWeight: 'bold',
        color: '#0f172a',
        textAlign: 'center',
        padding: 0,
        margin: 0,
        includeFontPadding: false,
    },
    chevronsContainer: {
        flexDirection: 'column',
        justifyContent: 'center',
        alignItems: 'center',
        gap: 0,
    },
    chevronButton: {
        justifyContent: 'center',
        alignItems: 'center',
        padding: 0,
    },
});
