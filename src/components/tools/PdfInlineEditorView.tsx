import React, { useState, useRef, useEffect, useCallback } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  StyleSheet,
  ActivityIndicator,
  Alert,
  ScrollView,
} from 'react-native';
import WebView from 'react-native-webview';
import RNFS from 'react-native-fs';
import Icon from 'react-native-vector-icons/MaterialIcons';
import { useTheme } from '../../theme/ThemeContext';
import { DocumentEditItem } from '../../services/PdfToolsService';
import { ConfirmModal } from '../ConfirmModal';
import { SaveModeModal } from './shared/SaveModeModal';
import { buildPdfEditorHtml } from '../../assets/web/pdfEditorHtml';

interface Props {
  totalPages: number;
  sourcePath: string;
  onProcess: (edits: DocumentEditItem[], saveMode?: 'original' | 'copy') => Promise<void>;
  isProcessing: boolean;
}

const COLOR_OPTIONS = [
  { key: 'black',  label: 'Negro',       hex: '#111827', r: 0.07, g: 0.07, b: 0.10 },
  { key: 'blue',   label: 'Azul',        hex: '#2563eb', r: 0.15, g: 0.39, b: 0.85 },
  { key: 'red',    label: 'Rojo',        hex: '#dd1f47', r: 0.87, g: 0.12, b: 0.28 },
  { key: 'green',  label: 'Verde',       hex: '#16a34a', r: 0.09, g: 0.64, b: 0.29 },
  { key: 'orange', label: 'Naranja',     hex: '#ea580c', r: 0.92, g: 0.35, b: 0.05 },
  { key: 'purple', label: 'Morado',      hex: '#7c3aed', r: 0.49, g: 0.23, b: 0.93 },
  { key: 'gray',   label: 'Gris oscuro', hex: '#475569', r: 0.28, g: 0.33, b: 0.41 },
  { key: 'brown',  label: 'Marrón',      hex: '#78350f', r: 0.47, g: 0.21, b: 0.06 },
];

const FONT_OPTIONS = [
  { key: 'Helvetica',  label: 'Helvética',   fontDescription: 'Sans-serif estándar' },
  { key: 'TimesRoman', label: 'Times Roman', fontDescription: 'Serif formal' },
  { key: 'Courier',    label: 'Courier',     fontDescription: 'Monoespaciada' },
  { key: 'Arial',      label: 'Arial',       fontDescription: 'Sans-serif moderna' },
  { key: 'Georgia',    label: 'Georgia',     fontDescription: 'Serif elegante' },
];

interface FormatState {
  fontSize: number;
  colorKey: string;
  fontKey: string;
  hasBackground: boolean;
  isNew: boolean;
}

export const PdfInlineEditorView: React.FC<Props> = ({
  totalPages: totalPagesProp,
  sourcePath,
  onProcess,
  isProcessing,
}) => {
  const { colors } = useTheme();
  const webViewRef = useRef<any>(null);

  const [webViewReady, setWebViewReady] = useState(false);
  const [pdfLoaded, setPdfLoaded] = useState(false);
  const [loading, setLoading] = useState(true);

  const [currentPage, setCurrentPage] = useState(1);
  const [pageCount, setPageCount] = useState(totalPagesProp);
  const [editCount, setEditCount] = useState(0);
  const [canUndo, setCanUndo] = useState(false);

  // Format bar state (non-null when text/card is active)
  const [formatState, setFormatState] = useState<FormatState | null>(null);

  // Top dropdown menu ('font' | 'color' | null) — rendered inline to NOT close keyboard!
  const [activeDropdown, setActiveDropdown] = useState<'font' | 'color' | null>(null);

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showResetConfirm, setShowResetConfirm] = useState(false);
  const [showUndoConfirm, setShowUndoConfirm] = useState(false);

  const pendingSaveModeRef = useRef<'original' | 'copy'>('copy');

  const htmlContent = useRef(
    buildPdfEditorHtml({
      primary: colors.primary,
      text: colors.text,
      textSecondary: colors.textSecondary,
      background: '#cbd5e1',
      surface: colors.surfaceLight,
      border: colors.border,
    }),
  ).current;

  const displayFontSize = formatState?.fontSize ?? 14;
  const displayFontKey = formatState?.fontKey ?? 'Helvetica';
  const displayColorKey = formatState?.colorKey ?? 'black';
  const displayHasBg = formatState?.hasBackground ?? true;
  const isSelected = formatState !== null;

  const currentFont = FONT_OPTIONS.find((f) => f.key === displayFontKey) || FONT_OPTIONS[0];
  const currentColor = COLOR_OPTIONS.find((c) => c.key === displayColorKey) || COLOR_OPTIONS[0];

  // ─── Send PDF data to WebView ──────────────────────
  const sendPdfToWebView = useCallback(async () => {
    if (!webViewReady) return;
    setLoading(true);
    try {
      const cleanPath = sourcePath.replace(/^file:\/\//, '');
      const base64 = await RNFS.readFile(cleanPath, 'base64');
      webViewRef.current?.postMessage(
        JSON.stringify({ action: 'loadPdf', base64 }),
      );
    } catch (err: any) {
      Alert.alert('Error', 'No se pudo leer el archivo PDF: ' + (err.message || err));
      setLoading(false);
    }
  }, [webViewReady, sourcePath]);

  useEffect(() => {
    if (webViewReady && !pdfLoaded) {
      sendPdfToWebView();
    }
  }, [webViewReady, pdfLoaded, sendPdfToWebView]);

  const sendCmd = useCallback(
    (msg: Record<string, any>) => {
      webViewRef.current?.postMessage(JSON.stringify(msg));
    },
    [],
  );

  // ─── Handle messages FROM WebView ──────────────────
  const handleWebViewMessage = useCallback(
    (event: any) => {
      let msg: any;
      try { msg = JSON.parse(event.nativeEvent.data); } catch { return; }

      switch (msg.type) {
        case 'ready':
          setWebViewReady(true);
          break;
        case 'pdfLoaded':
          setPdfLoaded(true);
          setLoading(false);
          setPageCount(msg.pageCount || totalPagesProp);
          setCurrentPage(msg.currentPage || 1);
          break;
        case 'pageRendered':
          setCurrentPage(msg.page);
          if (msg.totalPages) setPageCount(msg.totalPages);
          break;
        case 'editCount':
          setEditCount(msg.count || 0);
          if (typeof msg.canUndo === 'boolean') {
            setCanUndo(msg.canUndo);
          }
          break;
        case 'textSelected':
          setFormatState({
            fontSize: msg.fontSize || 14,
            colorKey: msg.colorKey || 'black',
            fontKey: msg.fontKey || 'Helvetica',
            hasBackground: msg.hasBackground !== false,
            isNew: msg.isNew || false,
          });
          break;
        case 'textDeselected':
          setFormatState(null);
          setActiveDropdown(null);
          break;
        case 'formatUpdated':
          setFormatState((prev) =>
            prev
              ? {
                  ...prev,
                  fontSize: msg.fontSize ?? prev.fontSize,
                  colorKey: msg.colorKey ?? prev.colorKey,
                  fontKey: msg.fontKey ?? prev.fontKey,
                  hasBackground: msg.hasBackground ?? prev.hasBackground,
                }
              : null,
          );
          break;
        case 'editsReady':
          processEdits(msg.edits || []);
          break;
        case 'error':
          setLoading(false);
          Alert.alert('Error del editor', msg.message || 'Error desconocido');
          break;
      }
    },
    [totalPagesProp],
  );

  const processEdits = (rawEdits: any[]) => {
    if (!rawEdits || rawEdits.length === 0) {
      Alert.alert('Atención', 'No has realizado cambios en el documento.');
      return;
    }
    const edits: DocumentEditItem[] = rawEdits.map((e: any) => ({
      id: e.id,
      type: 'text' as const,
      pageIndex: e.pageIndex,
      x: e.x,
      y: e.y,
      width: e.width,
      height: e.height,
      text: e.text || '',
      fontSize: e.fontSize || 14,
      textColor: e.textColor
        ? { r: e.textColor.r, g: e.textColor.g, b: e.textColor.b }
        : { r: 0.07, g: 0.07, b: 0.1 },
      hasBackground: e.hasBackground !== false,
      fontFamily: e.fontFamily || 'Helvetica',
    }));
    onProcess(edits, pendingSaveModeRef.current);
  };

  const sendFormat = (fmt: string, value?: any) => {
    sendCmd({ action: 'format', fmt, value });
  };

  const goToPage = (page: number) => {
    const p = Math.max(1, Math.min(pageCount, page));
    sendCmd({ action: 'goToPage', page: p });
    setCurrentPage(p);
    setFormatState(null);
    setActiveDropdown(null);
  };

  const handleAddText = () => {
    if (isSelected) return; // Prevent creating boxes while already editing
    sendCmd({ action: 'addNewText' });
  };

  const handleCommitActive = () => {
    sendCmd({ action: 'commitActiveText' });
  };

  const handleUndo = () => {
    if (!canUndo || isSelected) return;
    setShowUndoConfirm(true);
  };

  const confirmUndo = () => {
    sendCmd({ action: 'undo' });
    setShowUndoConfirm(false);
  };

  const handleReset = () => {
    if (editCount === 0 || isSelected) return;
    setShowResetConfirm(true);
  };

  const confirmReset = () => {
    sendCmd({ action: 'reset' });
    setEditCount(0);
    setCanUndo(false);
    setFormatState(null);
    setActiveDropdown(null);
    setShowResetConfirm(false);
  };

  const handleSave = () => {
    if (editCount === 0) {
      Alert.alert('Atención', 'No has realizado cambios en el documento.');
      return;
    }
    setShowSaveModal(true);
  };

  const confirmSave = (saveMode: 'original' | 'copy') => {
    setShowSaveModal(false);
    pendingSaveModeRef.current = saveMode;
    sendCmd({ action: 'requestEdits' });
  };

  return (
    <View style={styles.container}>
      {/* ─── Unified Top Menu: ALWAYS VISIBLE ─── */}
      <View style={[styles.topBar, { backgroundColor: colors.surfaceLight, borderBottomColor: colors.border }]}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topBarScroll}
        >
          {/* 1. Size Stepper: − and + tight to text (disabled if no text selected) */}
          <View
            style={[
              styles.stepperContainer,
              {
                borderColor: colors.border,
                backgroundColor: colors.backgroundLight,
                opacity: isSelected ? 1 : 0.38,
              },
            ]}
            pointerEvents={isSelected ? 'auto' : 'none'}
          >
            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => sendFormat('sizeDown')}
              hitSlop={{ top: 8, bottom: 8, left: 6, right: 4 }}
            >
              <Icon name="remove" size={16} color={colors.text} />
            </TouchableOpacity>

            <Text style={[styles.stepperText, { color: colors.text }]}>
              {displayFontSize} pt
            </Text>

            <TouchableOpacity
              style={styles.stepperBtn}
              onPress={() => sendFormat('sizeUp')}
              hitSlop={{ top: 8, bottom: 8, left: 4, right: 6 }}
            >
              <Icon name="add" size={16} color={colors.text} />
            </TouchableOpacity>
          </View>

          {/* 2. Font Dropdown with arrow ▾ (disabled if no text selected) */}
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              {
                borderColor: colors.border,
                backgroundColor: colors.backgroundLight,
                opacity: isSelected ? 1 : 0.38,
              },
            ]}
            onPress={() => setActiveDropdown(activeDropdown === 'font' ? null : 'font')}
            disabled={!isSelected}
            activeOpacity={0.7}
          >
            <Text style={[styles.dropdownTriggerText, { color: colors.text }]} numberOfLines={1}>
              {currentFont.label}
            </Text>
            <Icon name="arrow-drop-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* 3. Color Dropdown with arrow ▾ (disabled if no text selected) */}
          <TouchableOpacity
            style={[
              styles.dropdownTrigger,
              {
                borderColor: colors.border,
                backgroundColor: colors.backgroundLight,
                opacity: isSelected ? 1 : 0.38,
              },
            ]}
            onPress={() => setActiveDropdown(activeDropdown === 'color' ? null : 'color')}
            disabled={!isSelected}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.colorDotSmall,
                {
                  backgroundColor: currentColor.hex,
                  borderColor: currentColor.key === 'black' ? '#94a3b8' : 'rgba(0,0,0,0.15)',
                  borderWidth: currentColor.key === 'black' ? 1.5 : 0.5,
                },
              ]}
            />
            <Text style={[styles.dropdownTriggerText, { color: colors.text }]} numberOfLines={1}>
              {currentColor.label}
            </Text>
            <Icon name="arrow-drop-down" size={18} color={colors.textSecondary} />
          </TouchableOpacity>

          {/* 4. Fondo blanco protector toggle (disabled if no text selected) */}
          <TouchableOpacity
            style={[
              styles.fondoBtn,
              {
                backgroundColor: isSelected && displayHasBg ? colors.primary : colors.backgroundLight,
                borderColor: isSelected && displayHasBg ? colors.primary : colors.border,
                opacity: isSelected ? 1 : 0.38,
              },
            ]}
            onPress={() => sendFormat('bgToggle')}
            disabled={!isSelected}
            activeOpacity={0.7}
          >
            <Icon
              name="layers"
              size={14}
              color={isSelected && displayHasBg ? '#fff' : colors.text}
            />
            <Text
              style={[
                styles.fondoBtnText,
                { color: isSelected && displayHasBg ? '#fff' : colors.text },
              ]}
            >
              Fondo
            </Text>
          </TouchableOpacity>

          <View style={[styles.fmtSep, { backgroundColor: colors.border }]} />

          {/* 5. Texto button when idle, OR Aceptar button when editing! */}
          {isSelected ? (
            <TouchableOpacity
              style={[
                styles.topBarBtn,
                styles.acceptBtn,
                {
                  backgroundColor: '#10b981',
                  borderColor: '#059669',
                },
              ]}
              onPress={handleCommitActive}
              activeOpacity={0.75}
            >
              <Icon name="check" size={16} color="#ffffff" />
              <Text style={[styles.topBarBtnText, { color: '#ffffff', fontWeight: 'bold' }]}>
                Aceptar
              </Text>
            </TouchableOpacity>
          ) : (
            <TouchableOpacity
              style={[
                styles.topBarBtn,
                styles.addTextBtn,
                {
                  backgroundColor: colors.backgroundLight,
                  borderColor: colors.primary,
                  opacity: !pdfLoaded ? 0.35 : 1,
                },
              ]}
              onPress={handleAddText}
              activeOpacity={0.75}
              disabled={!pdfLoaded}
            >
              <Icon name="text-fields" size={15} color={colors.primary} />
              <Text style={[styles.topBarBtnText, { color: colors.primary, fontWeight: '700' }]}>
                + Texto
              </Text>
            </TouchableOpacity>
          )}

          {/* 6. Deshacer button (undo last change) */}
          <TouchableOpacity
            style={[
              styles.topBarBtn,
              styles.undoBtn,
              {
                borderColor: canUndo && !isSelected ? colors.border : 'transparent',
                backgroundColor: canUndo && !isSelected ? colors.backgroundLight : 'transparent',
                opacity: canUndo && !isSelected ? 1 : 0.35,
              },
            ]}
            onPress={handleUndo}
            disabled={!canUndo || isSelected}
            activeOpacity={0.7}
          >
            <Icon
              name="undo"
              size={16}
              color={canUndo && !isSelected ? colors.text : colors.textSecondary}
            />
            <Text
              style={[
                styles.topBarBtnText,
                { color: canUndo && !isSelected ? colors.text : colors.textSecondary },
              ]}
            >
              Deshacer
            </Text>
          </TouchableOpacity>

          {/* 7. Restablecer button (reset all document changes) */}
          <TouchableOpacity
            style={[
              styles.topBarBtn,
              styles.resetBtn,
              {
                borderColor: editCount > 0 && !isSelected ? colors.border : 'transparent',
                backgroundColor: editCount > 0 && !isSelected ? colors.backgroundLight : 'transparent',
                opacity: editCount > 0 && !isSelected ? 1 : 0.35,
              },
            ]}
            onPress={handleReset}
            disabled={editCount === 0 || isSelected}
            activeOpacity={0.7}
          >
            <Icon
              name="restore"
              size={16}
              color={editCount > 0 && !isSelected ? colors.primary : colors.textSecondary}
            />
            <Text
              style={[
                styles.topBarBtnText,
                { color: editCount > 0 && !isSelected ? colors.text : colors.textSecondary },
              ]}
            >
              Restablecer
            </Text>
          </TouchableOpacity>
        </ScrollView>
      </View>

      {/* ─── Top Floating Dropdown Menus (WITHOUT closing the keyboard!) ─── */}
      {activeDropdown !== null && (
        <View style={styles.dropdownFloatingWrapper} pointerEvents="box-none">
          {/* Backdrop tap catcher */}
          <TouchableOpacity
            style={StyleSheet.absoluteFillObject}
            activeOpacity={1}
            onPress={() => setActiveDropdown(null)}
          />

          {/* Floating dropdown card anchored at the top, scrollable to show ~3 items */}
          <View
            style={[
              styles.floatingDropdownCard,
              {
                backgroundColor: colors.surfaceLight,
                borderColor: colors.border,
                left: activeDropdown === 'font' ? 70 : 160,
              },
            ]}
          >
            <ScrollView
              style={{ maxHeight: 135 }}
              showsVerticalScrollIndicator={true}
              nestedScrollEnabled={true}
            >
              {activeDropdown === 'font'
                ? FONT_OPTIONS.map((f) => {
                    const isOptionSelected = displayFontKey === f.key;
                    return (
                      <TouchableOpacity
                        key={f.key}
                        style={[
                          styles.dropdownItemRow,
                          isOptionSelected && { backgroundColor: colors.backgroundLight },
                        ]}
                        onPress={() => {
                          sendFormat('font', f.key);
                          setActiveDropdown(null);
                        }}
                      >
                        <View style={{ flex: 1 }}>
                          <Text style={[styles.dropdownItemTitle, { color: colors.text }]}>{f.label}</Text>
                          <Text style={[styles.dropdownItemSub, { color: colors.textSecondary }]}>
                            {f.fontDescription}
                          </Text>
                        </View>
                        {isOptionSelected && <Icon name="check" size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })
                : COLOR_OPTIONS.map((c) => {
                    const isOptionSelected = displayColorKey === c.key;
                    return (
                      <TouchableOpacity
                        key={c.key}
                        style={[
                          styles.dropdownItemRow,
                          isOptionSelected && { backgroundColor: colors.backgroundLight },
                        ]}
                        onPress={() => {
                          sendFormat('color', c.key);
                          setActiveDropdown(null);
                        }}
                      >
                        <View
                          style={[
                            styles.colorDotMedium,
                            {
                              backgroundColor: c.hex,
                              borderColor: c.key === 'black' ? '#94a3b8' : 'rgba(0,0,0,0.15)',
                              borderWidth: c.key === 'black' ? 1.5 : 1,
                              marginRight: 10,
                            },
                          ]}
                        />
                        <Text style={[styles.dropdownItemTitle, { color: colors.text, flex: 1 }]}>
                          {c.label}
                        </Text>
                        {isOptionSelected && <Icon name="check" size={16} color={colors.primary} />}
                      </TouchableOpacity>
                    );
                  })}
            </ScrollView>
          </View>
        </View>
      )}

      {/* ─── WebView PDF Canvas & Editor ─── */}
      <View style={styles.webViewContainer}>
        {loading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
              Cargando editor PDF…
            </Text>
          </View>
        )}
        <WebView
          ref={webViewRef}
          source={{ html: htmlContent }}
          style={styles.webView}
          originWhitelist={['*']}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          mixedContentMode="always"
          onMessage={handleWebViewMessage}
          scrollEnabled={false}
          bounces={false}
          showsVerticalScrollIndicator={false}
          showsHorizontalScrollIndicator={false}
          overScrollMode="never"
          startInLoadingState={false}
          setSupportMultipleWindows={false}
          keyboardDisplayRequiresUserAction={false}
        />
      </View>

      {/* ─── Bottom bar: page nav & Save button ─── */}
      <View style={[styles.bottomSection, { backgroundColor: colors.surfaceLight, borderTopColor: colors.border }]}>
        <View style={styles.pageNavRow}>
          <TouchableOpacity
            style={[
              styles.navPageBtn,
              {
                backgroundColor: colors.backgroundLight,
                borderColor: colors.border,
                opacity: currentPage <= 1 ? 0.35 : 1,
              },
            ]}
            onPress={() => goToPage(currentPage - 1)}
            disabled={currentPage <= 1}
          >
            <Icon name="chevron-left" size={18} color={colors.text} />
            <Text style={[styles.navPageBtnText, { color: colors.text }]}>Anterior</Text>
          </TouchableOpacity>

          <View style={[styles.pageIndicatorPill, { backgroundColor: colors.backgroundLight, borderColor: colors.border }]}>
            <Text style={[styles.pageIndicatorText, { color: colors.textSecondary }]}>
              Página{' '}
              <Text style={{ color: colors.text, fontWeight: 'bold' }}>{currentPage}</Text>
              {' '}de {pageCount}
            </Text>
          </View>

          <TouchableOpacity
            style={[
              styles.navPageBtn,
              {
                backgroundColor: colors.backgroundLight,
                borderColor: colors.border,
                opacity: currentPage >= pageCount ? 0.35 : 1,
              },
            ]}
            onPress={() => goToPage(currentPage + 1)}
            disabled={currentPage >= pageCount}
          >
            <Text style={[styles.navPageBtnText, { color: colors.text }]}>Siguiente</Text>
            <Icon name="chevron-right" size={18} color={colors.text} />
          </TouchableOpacity>
        </View>

        <TouchableOpacity
          style={[
            styles.applyBtn,
            { backgroundColor: editCount > 0 ? colors.primary : 'rgba(221, 31, 71, 0.4)' },
          ]}
          onPress={handleSave}
          disabled={editCount === 0 || isProcessing}
          activeOpacity={0.85}
        >
          {isProcessing ? (
            <ActivityIndicator color="#ffffff" />
          ) : (
            <>
              <Icon name="save" size={20} color="#ffffff" style={{ marginRight: 8 }} />
              <Text style={styles.applyBtnText}>
                {editCount === 0
                  ? 'Guardar cambios'
                  : `Guardar cambios (${editCount} ${editCount === 1 ? 'edición' : 'ediciones'})`}
              </Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Save Mode Modal */}
      <SaveModeModal
        visible={showSaveModal}
        onClose={() => setShowSaveModal(false)}
        onConfirm={confirmSave}
        title="¿Cómo deseas guardar el PDF?"
        description="Selecciona una opción para aplicar las ediciones al documento:"
      />

      {/* Undo Confirmation Modal */}
      <ConfirmModal
        visible={showUndoConfirm}
        title="¿Deshacer último cambio?"
        message="¿Estás seguro de deshacer el último cambio realizado?"
        confirmText="Deshacer"
        cancelText="Cancelar"
        confirmColor={colors.primary}
        onConfirm={confirmUndo}
        onCancel={() => setShowUndoConfirm(false)}
      />

      {/* Reset Confirmation Modal */}
      <ConfirmModal
        visible={showResetConfirm}
        title="¿Restablecer documento?"
        message="¿Estás seguro de que deseas descartar todos los cambios realizados en el documento?"
        confirmText="Restablecer"
        cancelText="Cancelar"
        confirmColor="#ef4444"
        onConfirm={confirmReset}
        onCancel={() => setShowResetConfirm(false)}
      />
    </View>
  );
};

const styles = StyleSheet.create({
  container: { flex: 1 },

  /* ── Top bar: always visible ── */
  topBar: {
    paddingVertical: 6,
    borderBottomWidth: 1,
    minHeight: 46,
    zIndex: 100,
  },
  topBarScroll: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    gap: 6,
  },

  /* ── Stepper: − and + tightly hugging text ── */
  stepperContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    paddingHorizontal: 2,
  },
  stepperBtn: {
    paddingHorizontal: 6,
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  stepperText: {
    fontSize: 12,
    fontWeight: '700',
    minWidth: 36,
    textAlign: 'center',
    paddingHorizontal: 2,
  },

  /* ── Dropdown trigger button with arrow ── */
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingLeft: 8,
    paddingRight: 4,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    gap: 2,
  },
  dropdownTriggerText: {
    fontSize: 11,
    fontWeight: '700',
  },
  colorDotSmall: {
    width: 12,
    height: 12,
    borderRadius: 6,
    marginRight: 4,
  },

  /* ── Fondo Button ── */
  fondoBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    gap: 4,
  },
  fondoBtnText: {
    fontSize: 11,
    fontWeight: '700',
  },

  fmtSep: { width: 1, height: 20 },

  /* ── Action Buttons ── */
  topBarBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 9,
    borderRadius: 8,
    borderWidth: 1,
    height: 32,
    gap: 4,
  },
  topBarBtnText: {
    fontSize: 11,
    fontWeight: '600',
  },
  acceptBtn: {
    paddingHorizontal: 12,
  },
  addTextBtn: {},
  undoBtn: {},
  resetBtn: {},

  /* ── Top Floating Dropdown Menus (No Keyboard Dismiss) ── */
  dropdownFloatingWrapper: {
    ...StyleSheet.absoluteFillObject,
    zIndex: 1200,
  },
  floatingDropdownCard: {
    position: 'absolute',
    top: 48,
    width: 175,
    borderRadius: 12,
    borderWidth: 1,
    elevation: 8,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.25,
    shadowRadius: 10,
    overflow: 'hidden',
  },
  dropdownItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 9,
  },
  dropdownItemTitle: {
    fontSize: 12,
    fontWeight: '600',
  },
  dropdownItemSub: {
    fontSize: 10,
    marginTop: 1,
  },
  colorDotMedium: {
    width: 16,
    height: 16,
    borderRadius: 8,
  },

  /* ── WebView ── */
  webViewContainer: { flex: 1, position: 'relative' },
  webView: { flex: 1, backgroundColor: '#cbd5e1' },
  loadingOverlay: {
    ...StyleSheet.absoluteFillObject,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(203,213,225,0.85)',
    zIndex: 10,
  },
  loadingText: { marginTop: 12, fontSize: 13 },

  /* ── Bottom ── */
  bottomSection: {
    paddingHorizontal: 14,
    paddingTop: 10,
    paddingBottom: 14,
    borderTopWidth: 1,
    gap: 10,
  },
  pageNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  navPageBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
    gap: 2,
  },
  navPageBtnText: { fontSize: 12, fontWeight: '600' },
  pageIndicatorPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 8,
    borderWidth: 1,
  },
  pageIndicatorText: { fontSize: 12 },
  applyBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 14,
    borderRadius: 14,
  },
  applyBtnText: { color: '#ffffff', fontSize: 15, fontWeight: 'bold' },
});
