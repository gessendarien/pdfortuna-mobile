/**
 * PDF Editor HTML engine — loaded inside a WebView.
 *
 * Click-to-edit with Word-like text replacement:
 * - Deterministic text fragment IDs (p1_t0, p1_t1...) across renders.
 * - Tapping any text opens an enlarged editing card (textarea + Aceptar).
 * - Clicking "Aceptar" commits the text into the document:
 *   physically whites out the canvas underneath and draws the new text with the
 *   exact chosen font, size, and color — completely seamless like Microsoft Word!
 * - Real-time textarea feedback when adjusting size, font, or color.
 * - Undo stack support with single-step undo and full reset.
 * - Draggable boxes have 4-way move arrows handle, + and − zoom buttons at bottom-left (like signature tool).
 * - Strict mutual exclusion: editing one element disables interaction with others.
 */

export function buildPdfEditorHtml(themeColors: {
  primary: string;
  text: string;
  textSecondary: string;
  background: string;
  surface: string;
  border: string;
}): string {
  const c = themeColors;

  return `<!DOCTYPE html>
<html lang="es">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width,initial-scale=1,maximum-scale=1,user-scalable=no"/>
<style>
*{margin:0;padding:0;box-sizing:border-box;-webkit-tap-highlight-color:transparent;
  -webkit-user-select:none;user-select:none}
html,body{width:100%;height:100%;overflow:hidden;background:${c.background};
  font-family:system-ui,-apple-system,sans-serif;touch-action:none}

/* ── Loading ───────────────────────────────────── */
#loading{position:fixed;inset:0;display:flex;flex-direction:column;align-items:center;
  justify-content:center;background:${c.background};z-index:2000}
#loading .spinner{width:36px;height:36px;border:3px solid ${c.border};
  border-top-color:${c.primary};border-radius:50%;animation:spin .8s linear infinite}
#loading .label{margin-top:12px;font-size:13px;color:${c.textSecondary}}
@keyframes spin{to{transform:rotate(360deg)}}
.hidden{display:none!important}

/* ── Page container ────────────────────────────── */
#page-wrap{position:relative;width:100%;height:100%;overflow:auto;
  -webkit-overflow-scrolling:touch;display:flex;align-items:flex-start;
  justify-content:center;padding:6px 0}
#zoom-container{transform-origin:center top;transition:transform .08s ease-out}
#page-box{position:relative;margin:0 auto;background:#fff;
  box-shadow:0 2px 14px rgba(0,0,0,.2)}

/* ── Canvas ────────────────────────────────────── */
#pdf-canvas{display:block}

/* ── Text overlay layer ────────────────────────── */
#text-layer{position:absolute;inset:0;overflow:visible}

/* Unedited text: transparent clickable target */
.text-frag{position:absolute;cursor:pointer;color:transparent;
  background:transparent;border:none;border-radius:0;
  white-space:pre;line-height:1.15;padding:0;margin:0;
  box-sizing:border-box;overflow:visible;pointer-events:auto;outline:none}
.text-frag:hover{background:rgba(37,99,235,.12);
  outline:1px dashed rgba(37,99,235,.5)}

/* COMMITTED / EDITED TEXT: seamless like Word! */
.text-frag.edited{
  display:inline-block;
  white-space:pre-wrap;word-break:break-word;
  line-height:1.15;padding:0 2px;margin:0;
  border:none;outline:none;box-shadow:none;
  z-index:10;pointer-events:auto}

/* ── New draggable text items ─────────────────── */
#new-layer{position:absolute;inset:0;overflow:visible;pointer-events:none}
.new-wrap{position:absolute;pointer-events:auto;border-radius:4px}

/* When IDLE / FIXED: clean integrated text with no handles or edit borders */
.new-text{border:1px dashed transparent;border-radius:4px;padding:4px 6px;
  outline:none;font-size:14px;color:#111827;line-height:1.3;
  white-space:pre-wrap;word-break:break-word;min-width:70px;min-height:28px;
  cursor:pointer;box-sizing:border-box}

/* By default, hide all editing handles when not active */
.new-wrap .drag-handle,
.new-wrap .delete-btn,
.new-wrap .resize-handle,
.new-wrap .box-scale-pill{display:none!important}

/* When ACTIVE / EDITING: show handles and highlight box */
.new-wrap.active{z-index:50}
.new-wrap.active .new-text{border:1.5px dashed ${c.primary};
  box-shadow:0 1px 8px rgba(0,0,0,.18);cursor:text;
  -webkit-user-select:text;user-select:text}
.new-wrap.active .new-text:focus{border-style:solid;box-shadow:0 0 0 2px ${c.primary}}

.new-wrap.active .drag-handle{position:absolute;top:-25px;left:0;display:flex!important;align-items:center;
  justify-content:center;background:#2563eb;color:#fff;
  width:26px;height:22px;border-radius:6px;cursor:grab;z-index:30;pointer-events:auto;
  touch-action:none}
.new-wrap.active .drag-handle svg{width:14px;height:14px;fill:#ffffff}

.new-wrap.active .delete-btn{position:absolute;top:-25px;right:0;width:22px;height:22px;
  background:#ef4444;border-radius:11px;display:flex!important;align-items:center;
  justify-content:center;cursor:pointer;z-index:30;pointer-events:auto}
.new-wrap.active .delete-btn::after{content:'✕';color:#fff;font-size:12px;font-weight:700}

.new-wrap.active .resize-handle{position:absolute;bottom:-6px;right:-6px;width:18px;height:18px;
  background:${c.primary};border-radius:4px;cursor:nwse-resize;z-index:30;
  pointer-events:auto;touch-action:none;
  display:flex!important;align-items:center;justify-content:center}
.new-wrap.active .resize-handle::after{content:'⤡';color:#fff;font-size:11px}

/* Size +/- pill in bottom-left corner of draggable box (like signature tool) */
.new-wrap.active .box-scale-pill{position:absolute;bottom:-25px;left:0;display:flex!important;align-items:center;
  background:#1e293b;border-radius:6px;padding:1px 3px;z-index:30;pointer-events:auto;
  box-shadow:0 2px 6px rgba(0,0,0,.25)}
.new-wrap.active .box-scale-btn{width:22px;height:20px;display:flex;align-items:center;justify-content:center;
  border:none;background:transparent;color:#ffffff;font-size:15px;font-weight:700;cursor:pointer}
.new-wrap.active .box-scale-btn:active{background:rgba(255,255,255,.2)}
.new-wrap.active .box-scale-divider{width:1px;height:12px;background:rgba(255,255,255,.25)}

/* ── Editing Card Popup (Enlarged Card Interface) ─ */
#edit-card-overlay{position:fixed;inset:0;background:rgba(15,23,42,.3);
  z-index:1500;display:none;align-items:flex-start;justify-content:center;
  padding:20px 16px;pointer-events:auto}
#edit-card-overlay.visible{display:flex}

.edit-card-box{width:100%;max-width:340px;background:#ffffff;
  border-radius:14px;border:2px solid ${c.primary};
  box-shadow:0 10px 30px rgba(0,0,0,.25);padding:14px;
  display:flex;flex-direction:column;gap:10px;animation:cardIn .15s ease-out;
  margin-top:20px}
@keyframes cardIn{from{transform:scale(.93);opacity:0}to{transform:scale(1);opacity:1}}

.edit-card-header{display:flex;align-items:center;justify-content:space-between}
.edit-card-title{font-size:13px;font-weight:700;color:#1e293b}
.edit-card-badge{font-size:11px;font-weight:700;color:#2563eb;background:#eff6ff;
  border:1px solid #bfdbfe;padding:2px 8px;border-radius:10px}

.edit-card-textarea{width:100%;min-height:80px;max-height:160px;
  border:1.5px solid #cbd5e1;border-radius:8px;padding:8px 10px;
  font-size:15px;color:#111827;line-height:1.35;outline:none;resize:none;
  background:#f8fafc;-webkit-user-select:text;user-select:text;
  transition:font-size .1s ease, color .1s ease}
.edit-card-textarea:focus{border-color:${c.primary};background:#ffffff;
  box-shadow:0 0 0 2px rgba(221,31,71,.15)}

.edit-card-footer{display:flex;align-items:center;justify-content:flex-end;gap:8px}
.btn-card-cancel{padding:6px 14px;border-radius:8px;border:1px solid #cbd5e1;
  background:#f8fafc;font-size:12px;font-weight:600;color:#64748b;cursor:pointer}
.btn-card-ok{padding:7px 18px;border-radius:8px;border:none;background:#10b981;
  font-size:13px;font-weight:700;color:#ffffff;cursor:pointer;
  box-shadow:0 2px 6px rgba(16,185,129,.3)}
.btn-card-ok:active{transform:scale(.97)}

/* ── Floating zoom controls ───────────────────── */
#zoom-bar{position:fixed;right:12px;bottom:12px;display:flex;flex-direction:column;
  background:${c.surface};border:1px solid ${c.border};border-radius:12px;
  overflow:hidden;z-index:400;box-shadow:0 2px 10px rgba(0,0,0,.18)}
.zoom-btn{width:38px;height:34px;display:flex;align-items:center;justify-content:center;
  font-size:20px;font-weight:700;color:${c.text};cursor:pointer;border:none;background:none}
.zoom-btn:active{background:rgba(0,0,0,.08)}
.zoom-label{font-size:10px;font-weight:700;color:${c.primary};text-align:center;
  padding:3px 0;border-top:1px solid ${c.border};border-bottom:1px solid ${c.border};
  cursor:pointer}
</style>
</head>
<body>

<!-- Loading -->
<div id="loading"><div class="spinner"></div><div class="label">Cargando editor…</div></div>

<!-- Page container -->
<div id="page-wrap">
  <div id="zoom-container">
    <div id="page-box">
      <canvas id="pdf-canvas"></canvas>
      <div id="text-layer"></div>
      <div id="new-layer"></div>
    </div>
  </div>
</div>

<!-- Enlarged Editing Card Overlay -->
<div id="edit-card-overlay">
  <div class="edit-card-box">
    <div class="edit-card-header">
      <span class="edit-card-title">Editar texto</span>
      <span class="edit-card-badge" id="edit-card-size">14 pt</span>
    </div>
    <textarea id="edit-card-textarea" class="edit-card-textarea" placeholder="Escribe el texto…"></textarea>
    <div class="edit-card-footer">
      <button class="btn-card-cancel" id="btn-card-cancel">Cancelar</button>
      <button class="btn-card-ok" id="btn-card-ok">✓ Aceptar</button>
    </div>
  </div>
</div>

<!-- Zoom controls -->
<div id="zoom-bar">
  <div class="zoom-btn" id="btn-zoom-in">+</div>
  <div class="zoom-label" id="lbl-zoom">100%</div>
  <div class="zoom-btn" id="btn-zoom-out">−</div>
</div>

<script type="module">
// ═══════════════════════════════════════════════════
//  PDF.js setup
// ═══════════════════════════════════════════════════
import * as pdfjsLib from 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.min.mjs';
pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdn.jsdelivr.net/npm/pdfjs-dist@4.9.155/build/pdf.worker.min.mjs';

const COLORS = {
  black:  { r:0.07, g:0.07, b:0.10, hex:'#111827' },
  blue:   { r:0.15, g:0.39, b:0.85, hex:'#2563eb' },
  red:    { r:0.87, g:0.12, b:0.28, hex:'#dd1f47' },
  green:  { r:0.09, g:0.64, b:0.29, hex:'#16a34a' },
  orange: { r:0.92, g:0.35, b:0.05, hex:'#ea580c' },
  purple: { r:0.49, g:0.23, b:0.93, hex:'#7c3aed' },
  gray:   { r:0.28, g:0.33, b:0.41, hex:'#475569' },
  brown:  { r:0.47, g:0.21, b:0.06, hex:'#78350f' },
};

const FONT_CSS = {
  Helvetica:  'Helvetica, Arial, sans-serif',
  TimesRoman: '"Times New Roman", Times, serif',
  Courier:    '"Courier New", Courier, monospace',
  Arial:      'Arial, Helvetica, sans-serif',
  Georgia:    'Georgia, "Times New Roman", serif',
};

// ═══════════════════════════════════════════════════
//  State
// ═══════════════════════════════════════════════════
let pdfDoc      = null;
let currentPage  = 1;
let totalPages   = 0;
let scale        = 1;
let dpr          = Math.min(window.devicePixelRatio || 1, 3);
let pageWidthPt  = 595;
let pageHeightPt = 842;
let cssW = 0, cssH = 0;

let zoomLevel = 1;

// Maps for persisted edits
const pageEdits    = new Map(); // Map<pageNum, Map<fragId, editData>>
const pageNewItems = new Map(); // Map<pageNum, Array<itemData>>

// Undo stack
const undoStack = []; // Array<{ type: 'frag'|'new'|'delNew', page: number, ... }>

let activeFragId = null; // editing card is open
let activeNewId  = null; // draggable box is active

let dragState   = null;
let resizeState = null;
let newIdC      = 0;
const nextNewId = () => 'n' + (++newIdC);

// ═══════════════════════════════════════════════════
//  DOM refs
// ═══════════════════════════════════════════════════
const $loading   = document.getElementById('loading');
const $canvas    = document.getElementById('pdf-canvas');
const $textLayer = document.getElementById('text-layer');
const $newLayer  = document.getElementById('new-layer');
const $pageBox   = document.getElementById('page-box');
const $pageWrap  = document.getElementById('page-wrap');
const $zoomC     = document.getElementById('zoom-container');
const ctx        = $canvas.getContext('2d');

const $cardOverlay   = document.getElementById('edit-card-overlay');
const $cardTextarea  = document.getElementById('edit-card-textarea');
const $cardSizeBadge = document.getElementById('edit-card-size');
const $btnCardOk     = document.getElementById('btn-card-ok');
const $btnCardCancel = document.getElementById('btn-card-cancel');

function postRN(obj) {
  try { window.ReactNativeWebView.postMessage(JSON.stringify(obj)); } catch(e) {}
}

function mapFontKey(fontName) {
  if (!fontName) return 'Helvetica';
  const n = fontName.toLowerCase();
  if (n.includes('times') || (n.includes('serif') && !n.includes('sans'))) return 'TimesRoman';
  if (n.includes('courier') || n.includes('mono')) return 'Courier';
  if (n.includes('georgia')) return 'Georgia';
  if (n.includes('arial')) return 'Arial';
  return 'Helvetica';
}

// ═══════════════════════════════════════════════════
//  Mutual Exclusion Enforcer
// ═══════════════════════════════════════════════════
function updateInteractionLocks() {
  const allWraps = document.querySelectorAll('.new-wrap');
  if (activeFragId) {
    // Editing an existing text card: block textLayer and all new boxes completely
    $textLayer.style.pointerEvents = 'none';
    $newLayer.style.pointerEvents = 'none';
    for (let i = 0; i < allWraps.length; i++) allWraps[i].style.pointerEvents = 'none';
  } else if (activeNewId) {
    // Editing a draggable box: block document text so dragging/typing doesn't hit background
    $textLayer.style.pointerEvents = 'none';
    $newLayer.style.pointerEvents = 'none';
    for (let i = 0; i < allWraps.length; i++) {
      allWraps[i].style.pointerEvents = (allWraps[i].id === 'wrap_' + activeNewId) ? 'auto' : 'none';
    }
  } else {
    // Idle: background text interactive, and each box can be clicked to activate
    $textLayer.style.pointerEvents = 'auto';
    $newLayer.style.pointerEvents = 'none';
    for (let i = 0; i < allWraps.length; i++) allWraps[i].style.pointerEvents = 'auto';
  }
}

// ═══════════════════════════════════════════════════
//  Zoom
// ═══════════════════════════════════════════════════
function applyZoom() {
  $zoomC.style.transform = 'scale(' + zoomLevel + ')';
  document.getElementById('lbl-zoom').textContent = Math.round(zoomLevel * 100) + '%';
}
document.getElementById('btn-zoom-in').addEventListener('click', () => {
  zoomLevel = Math.min(3, +(zoomLevel + 0.25).toFixed(2));
  applyZoom();
});
document.getElementById('btn-zoom-out').addEventListener('click', () => {
  zoomLevel = Math.max(0.5, +(zoomLevel - 0.25).toFixed(2));
  applyZoom();
});
document.getElementById('lbl-zoom').addEventListener('click', () => {
  zoomLevel = 1; applyZoom();
});

let pinchStartDist = 0, pinchStartZoom = 1;
$pageWrap.addEventListener('touchstart', (e) => {
  if (e.touches.length === 2) {
    pinchStartDist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
    pinchStartZoom = zoomLevel;
    e.preventDefault();
  }
}, { passive: false });
$pageWrap.addEventListener('touchmove', (e) => {
  if (e.touches.length === 2 && pinchStartDist > 0) {
    const dist = Math.hypot(
      e.touches[0].clientX - e.touches[1].clientX,
      e.touches[0].clientY - e.touches[1].clientY);
    zoomLevel = Math.max(0.5, Math.min(3, +(pinchStartZoom * dist / pinchStartDist).toFixed(2)));
    applyZoom();
    e.preventDefault();
  }
}, { passive: false });
$pageWrap.addEventListener('touchend', () => { pinchStartDist = 0; });

// ═══════════════════════════════════════════════════
//  Render page (HiDPI)
// ═══════════════════════════════════════════════════
async function renderPage(pageNum) {
  if (!pdfDoc) return;
  pageNum = Math.max(1, Math.min(pageNum, totalPages));
  currentPage = pageNum;
  closeEditCard();
  deactivateAll();

  const page = await pdfDoc.getPage(pageNum);
  const vp1 = page.getViewport({ scale: 1 });
  pageWidthPt = vp1.width;
  pageHeightPt = vp1.height;

  const containerW = $pageWrap.clientWidth - 8;
  scale = containerW / vp1.width;
  const viewport = page.getViewport({ scale });

  cssW = Math.round(viewport.width);
  cssH = Math.round(viewport.height);

  $canvas.width  = Math.round(cssW * dpr);
  $canvas.height = Math.round(cssH * dpr);
  $canvas.style.width  = cssW + 'px';
  $canvas.style.height = cssH + 'px';
  $pageBox.style.width  = cssW + 'px';
  $pageBox.style.height = cssH + 'px';

  ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  await page.render({ canvasContext: ctx, viewport }).promise;

  await buildTextLayer(page, viewport);
  restoreNewItems(pageNum);
  updateInteractionLocks();

  postRN({ type:'pageRendered', page: pageNum, totalPages,
           pageWidthPt, pageHeightPt, cssW, cssH });
}

// ═══════════════════════════════════════════════════
//  Build text layer with DETERMINISTIC IDs
// ═══════════════════════════════════════════════════
async function buildTextLayer(page, viewport) {
  $textLayer.innerHTML = '';
  const textContent = await page.getTextContent();
  const editsMap = pageEdits.get(currentPage) || new Map();

  let itemIdx = 0;
  for (const item of textContent.items) {
    itemIdx++;
    if (!item.str || !item.str.trim()) continue;

    const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
    const fontHeight = Math.hypot(tx[2], tx[3]);
    if (fontHeight < 3) continue;

    const left   = tx[4];
    const top    = tx[5] - fontHeight;
    const width  = item.width * scale;
    const height = fontHeight * 1.25;

    if (width < 3) continue;

    // Deterministic ID so it always maps to the same edit across re-renders
    const fragId = 'p' + currentPage + '_t' + itemIdx;
    const fontKey = mapFontKey(item.fontName);

    const div = document.createElement('div');
    div.className = 'text-frag';
    div.id = fragId;
    div.style.left       = left + 'px';
    div.style.top        = top + 'px';
    div.style.width      = width + 'px';
    div.style.height     = height + 'px';
    div.style.fontSize   = fontHeight + 'px';
    div.style.fontFamily = FONT_CSS[fontKey];
    div.textContent = item.str;

    div.dataset.origText     = item.str;
    div.dataset.origFontKey  = fontKey;
    div.dataset.origFontSize = String(Math.round(fontHeight));
    div.dataset.pdfX         = String(item.transform[4]);
    div.dataset.pdfY         = String(item.transform[5]);
    div.dataset.pdfFontH     = String(Math.hypot(item.transform[2], item.transform[3]));
    div.dataset.pdfW         = String(item.width);
    div.dataset.pdfH         = String(item.height || Math.hypot(item.transform[2], item.transform[3]));
    div.dataset.fontKey      = fontKey;
    div.dataset.colorKey     = 'black';
    div.dataset.hasBg        = 'true';
    div.dataset.fontSize     = String(Math.round(fontHeight));
    div.dataset.cssLeft      = String(left);
    div.dataset.cssTop       = String(top);
    div.dataset.cssWidth     = String(width);
    div.dataset.cssHeight    = String(height);

    // Restore previous edit if exists
    const prevEdit = editsMap.get(fragId);
    if (prevEdit) {
      const pW = (prevEdit.renderedW || width) + 4;
      const pH = (prevEdit.renderedH || height) + 4;
      ctx.save();
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(left - 2, top - 2, pW, pH);
      ctx.restore();
      applyEditToFragmentElement(div, prevEdit);
    }

    div.addEventListener('click', (ev) => {
      ev.stopPropagation();
      if (activeNewId) return; // blocked by mutual exclusion
      openEditCard(fragId);
    });

    $textLayer.appendChild(div);
  }
}

// ═══════════════════════════════════════════════════
//  Editing Card logic
// ═══════════════════════════════════════════════════
function openEditCard(fragId) {
  deactivateAll();
  const div = document.getElementById(fragId);
  if (!div) return;

  activeFragId = fragId;
  updateInteractionLocks();

  const currentText = div.classList.contains('edited') ? (div.textContent || '') : (div.dataset.origText || '');
  const fontSize = parseInt(div.dataset.fontSize || div.dataset.origFontSize || '14', 10);
  const colorKey = div.dataset.colorKey || 'black';
  const fontKey  = div.dataset.fontKey || div.dataset.origFontKey || 'Helvetica';
  const hasBg    = div.dataset.hasBg !== 'false';

  $cardTextarea.value = currentText;
  $cardTextarea.style.color = COLORS[colorKey].hex;
  $cardTextarea.style.fontFamily = FONT_CSS[fontKey];

  const previewSize = Math.max(13, Math.min(26, 15 + (fontSize - 14) * 0.7));
  $cardTextarea.style.fontSize = previewSize + 'px';
  $cardSizeBadge.textContent = fontSize + ' pt';

  $cardOverlay.classList.add('visible');
  $cardTextarea.focus();
  $cardTextarea.setSelectionRange($cardTextarea.value.length, $cardTextarea.value.length);

  postRN({
    type: 'textSelected',
    isNew: false,
    fontSize,
    colorKey,
    fontKey,
    hasBackground: hasBg,
  });
}

function commitEditCard() {
  if (!activeFragId) return;
  const div = document.getElementById(activeFragId);
  if (!div) { closeEditCard(); return; }

  const newText = $cardTextarea.value;
  const origText = div.dataset.origText || '';
  const fontKey = div.dataset.fontKey || 'Helvetica';
  const colorKey = div.dataset.colorKey || 'black';
  const fontSize = parseInt(div.dataset.fontSize || '14', 10);
  const hasBg = div.dataset.hasBg !== 'false';

  const origFontKey = div.dataset.origFontKey || 'Helvetica';
  const origFontSize = parseInt(div.dataset.origFontSize || '14', 10);

  const isChanged = (newText !== origText) ||
                    (colorKey !== 'black') ||
                    (fontKey !== origFontKey) ||
                    (fontSize !== origFontSize);

  if (isChanged) {
    if (!pageEdits.has(currentPage)) pageEdits.set(currentPage, new Map());
    const prevStored = pageEdits.get(currentPage).get(activeFragId) || null;

    const cL = parseFloat(div.dataset.cssLeft || '0');
    const cT = parseFloat(div.dataset.cssTop || '0');
    const cW = parseFloat(div.dataset.cssWidth || '50');
    const cH = parseFloat(div.dataset.cssHeight || '20');
    const curW = Math.max(cW, div.scrollWidth || 0);
    const curH = Math.max(cH, div.scrollHeight || 0);

    const editData = {
      fragId: activeFragId,
      origText,
      newText,
      pdfX: parseFloat(div.dataset.pdfX),
      pdfY: parseFloat(div.dataset.pdfY),
      pdfFontH: parseFloat(div.dataset.pdfFontH),
      pdfW: parseFloat(div.dataset.pdfW),
      pdfH: parseFloat(div.dataset.pdfH),
      fontKey,
      colorKey,
      hasBg,
      fontSize,
      renderedW: curW,
      renderedH: curH,
    };
    pageEdits.get(currentPage).set(activeFragId, editData);

    // Push to undo stack
    undoStack.push({
      type: 'frag',
      page: currentPage,
      fragId: activeFragId,
      prevEdit: prevStored,
    });

    // 1. Physically whiteout the old text on the canvas so it NEVER peeks through!
    ctx.save();
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.fillStyle = '#ffffff';
    ctx.fillRect(cL - 2, cT - 2, curW + 4, curH + 4);
    ctx.restore();

    // 2. Render seamlessly on top like Microsoft Word!
    applyEditToFragmentElement(div, editData);
  } else {
    // Revert if identical to original
    const wasEdited = pageEdits.has(currentPage) && pageEdits.get(currentPage).has(activeFragId);
    if (wasEdited) {
      pageEdits.get(currentPage).delete(activeFragId);
      renderPage(currentPage);
    } else {
      div.classList.remove('edited');
      div.style.color = 'transparent';
      div.style.background = 'transparent';
      div.textContent = origText;
    }
  }

  closeEditCard();
  notifyEditCount();
}

function closeEditCard() {
  $cardOverlay.classList.remove('visible');
  activeFragId = null;
  updateInteractionLocks();
  postRN({ type: 'textDeselected' });
}

function applyEditToFragmentElement(div, edit) {
  div.classList.add('edited');
  div.textContent = edit.newText;
  div.dataset.fontSize = String(edit.fontSize);
  div.dataset.colorKey = edit.colorKey;
  div.dataset.fontKey  = edit.fontKey;

  // Exact styles for Word-like seamless rendering:
  div.style.color = COLORS[edit.colorKey || 'black'].hex;
  div.style.fontFamily = FONT_CSS[edit.fontKey || 'Helvetica'];
  div.style.fontSize = (edit.fontSize || 14) + 'px';
  div.style.backgroundColor = edit.hasBg !== false ? '#ffffff' : 'transparent';
  div.style.width = 'auto';

  // Ensure width covers at least original bounds plus new text expansion
  const origW = parseFloat(div.dataset.cssWidth || '0');
  div.style.minWidth = Math.max(origW, (parseFloat(div.dataset.pdfW || '0') * scale)) + 'px';
  div.style.minHeight = Math.max(parseFloat(div.dataset.cssHeight || '0'), (edit.fontSize || 14) * 1.25) + 'px';
  div.style.zIndex = '10';
}

$btnCardOk.addEventListener('click', (e) => {
  e.stopPropagation();
  commitEditCard();
});

$btnCardCancel.addEventListener('click', (e) => {
  e.stopPropagation();
  closeEditCard();
});

// ═══════════════════════════════════════════════════
//  New draggable text items
// ═══════════════════════════════════════════════════
function addNewTextItem() {
  if (activeFragId || activeNewId) return; // blocked by mutual exclusion
  closeEditCard();
  deactivateAll();

  const id = nextNewId();
  const w = Math.min(200, cssW * 0.55);
  const h = 34;
  const x = Math.max(8, (cssW - w) / 2);
  const y = Math.max(30, cssH * 0.3);

  const itemData = { id, x, y, w, h, text:'', fontSize:14, colorKey:'black', fontKey:'Helvetica', hasBackground:true };

  if (!pageNewItems.has(currentPage)) pageNewItems.set(currentPage, []);
  pageNewItems.get(currentPage).push(itemData);

  undoStack.push({ type: 'new', page: currentPage, id });

  const el = createNewTextEl(itemData);
  $newLayer.appendChild(el);

  activateNewItem(id);
  notifyEditCount();
}

function activateNewItem(id) {
  if (activeFragId) return;
  if (activeNewId === id) return;

  if (activeNewId && activeNewId !== id) {
    deactivateAll();
  }

  const items = pageNewItems.get(currentPage) || [];
  const item = items.find(i => i.id === id);
  const wrap = document.getElementById('wrap_' + id);
  const txt = wrap?.querySelector('.new-text');
  if (!item || !wrap || !txt) return;

  activeNewId = id;
  wrap.classList.add('active');
  txt.setAttribute('contenteditable', 'true');
  txt.focus();

  updateInteractionLocks();

  postRN({
    type: 'textSelected', isNew: true,
    fontSize: item.fontSize, colorKey: item.colorKey,
    fontKey: item.fontKey, hasBackground: item.hasBackground,
  });
}

function createNewTextEl(item) {
  const wrap = document.createElement('div');
  wrap.className = 'new-wrap';
  wrap.id = 'wrap_' + item.id;
  wrap.style.left = item.x + 'px';
  wrap.style.top  = item.y + 'px';

  // Drag handle: 4-way arrows icon
  const drag = document.createElement('div');
  drag.className = 'drag-handle';
  drag.title = 'Mover';
  drag.innerHTML = '<svg viewBox="0 0 24 24"><path d="M10 9h4V6h3l-5-5-5 5h3v3zm-1 1H6V7l-5 5 5 5v-3h3v-4zm14 2l-5-5v3h-3v4h3v3l5-5zm-9 3h-4v3H7l5 5 5-5h-3v-3z"/></svg>';
  drag.addEventListener('touchstart', (e) => startDrag(e, item.id), { passive: false });

  // Delete button
  const del = document.createElement('div');
  del.className = 'delete-btn';
  del.title = 'Eliminar';
  const onDel = (e) => { e.preventDefault(); e.stopPropagation(); removeNewItem(item.id); };
  del.addEventListener('touchstart', onDel, { passive: false });
  del.addEventListener('click', onDel);

  // Corner resize handle (bottom-right)
  const rs = document.createElement('div');
  rs.className = 'resize-handle';
  rs.title = 'Redimensionar';
  rs.addEventListener('touchstart', (e) => startResize(e, item.id), { passive: false });

  // Scale pill at bottom-left: + and - buttons like Signature Tool!
  const pill = document.createElement('div');
  pill.className = 'box-scale-pill';
  pill.innerHTML = '<button class="box-scale-btn btn-down">−</button><div class="box-scale-divider"></div><button class="box-scale-btn btn-up">+</button>';
  
  const onDown = (e) => { e.preventDefault(); e.stopPropagation(); changeBoxSize(item.id, -20); };
  const onUp = (e) => { e.preventDefault(); e.stopPropagation(); changeBoxSize(item.id, +20); };
  const btnDown = pill.querySelector('.btn-down');
  const btnUp = pill.querySelector('.btn-up');
  btnDown.addEventListener('touchstart', onDown, { passive: false });
  btnDown.addEventListener('click', onDown);
  btnUp.addEventListener('touchstart', onUp, { passive: false });
  btnUp.addEventListener('click', onUp);

  // Text element
  const txt = document.createElement('div');
  txt.className = 'new-text';
  txt.setAttribute('spellcheck', 'false');
  txt.style.width     = item.w + 'px';
  txt.style.minHeight = item.h + 'px';
  txt.style.fontSize  = item.fontSize + 'px';
  txt.style.color     = COLORS[item.colorKey].hex;
  txt.style.fontFamily = FONT_CSS[item.fontKey];
  txt.style.background = item.hasBackground ? '#ffffff' : 'transparent';
  if (item.text) txt.textContent = item.text;

  txt.addEventListener('input', () => {
    item.text = txt.textContent || '';
    notifyEditCount();
  });

  // Tap wrap or text to activate when fixed!
  wrap.addEventListener('click', (e) => {
    e.stopPropagation();
    if (activeFragId) return;
    if (activeNewId !== item.id) {
      activateNewItem(item.id);
    }
  });

  wrap.appendChild(drag);
  wrap.appendChild(del);
  wrap.appendChild(txt);
  wrap.appendChild(rs);
  wrap.appendChild(pill);
  return wrap;
}

function changeBoxSize(id, delta) {
  const items = pageNewItems.get(currentPage) || [];
  const item = items.find(x => x.id === id);
  const wrap = document.getElementById('wrap_' + id);
  const txt = wrap?.querySelector('.new-text');
  if (!item || !txt) return;

  item.w = Math.max(70, Math.min(cssW - 20, item.w + delta));
  item.h = Math.max(28, Math.min(cssH - 30, item.h + delta * 0.5));
  txt.style.width = item.w + 'px';
  txt.style.minHeight = item.h + 'px';
}

function removeNewItem(id) {
  const w = document.getElementById('wrap_' + id);
  if (w) w.remove();
  for (const [, items] of pageNewItems) {
    const i = items.findIndex(x => x.id === id);
    if (i >= 0) {
      items.splice(i, 1);
      break;
    }
  }
  const uIdx = undoStack.findIndex(u => u.type === 'new' && u.id === id);
  if (uIdx >= 0) undoStack.splice(uIdx, 1);

  if (activeNewId === id) {
    activeNewId = null;
    updateInteractionLocks();
    postRN({ type: 'textDeselected' });
  }
  notifyEditCount();
}

function restoreNewItems(pageNum) {
  $newLayer.innerHTML = '';
  for (const item of (pageNewItems.get(pageNum) || [])) {
    $newLayer.appendChild(createNewTextEl(item));
  }
}

function startDrag(e, id) {
  e.preventDefault(); e.stopPropagation();
  const t = e.touches[0]; if (!t) return;
  const wrap = document.getElementById('wrap_' + id);
  if (!wrap) return;
  dragState = {
    id, sx: t.clientX, sy: t.clientY,
    ox: parseFloat(wrap.style.left), oy: parseFloat(wrap.style.top)
  };
  document.addEventListener('touchmove', onDragMove, { passive: false });
  document.addEventListener('touchend', onDragEnd);
  document.addEventListener('touchcancel', onDragEnd);
}
function onDragMove(e) {
  if (!dragState) return;
  e.preventDefault();
  const t = e.touches[0]; if (!t) return;
  const dx = (t.clientX - dragState.sx) / zoomLevel;
  const dy = (t.clientY - dragState.sy) / zoomLevel;
  const nl = Math.max(0, Math.min(cssW - 40, dragState.ox + dx));
  const nt = Math.max(0, Math.min(cssH - 20, dragState.oy + dy));
  const wrap = document.getElementById('wrap_' + dragState.id);
  if (wrap) { wrap.style.left = nl + 'px'; wrap.style.top = nt + 'px'; }
}
function onDragEnd() {
  if (dragState) {
    const wrap = document.getElementById('wrap_' + dragState.id);
    if (wrap) {
      const items = pageNewItems.get(currentPage) || [];
      const item = items.find(x => x.id === dragState.id);
      if (item) { item.x = parseFloat(wrap.style.left); item.y = parseFloat(wrap.style.top); }
    }
  }
  dragState = null;
  document.removeEventListener('touchmove', onDragMove);
  document.removeEventListener('touchend', onDragEnd);
  document.removeEventListener('touchcancel', onDragEnd);
}

function startResize(e, id) {
  e.preventDefault(); e.stopPropagation();
  const t = e.touches[0]; if (!t) return;
  const wrap = document.getElementById('wrap_' + id);
  const txt = wrap?.querySelector('.new-text');
  if (!txt) return;
  resizeState = { id, sx: t.clientX, sy: t.clientY, ow: parseFloat(txt.style.width), oh: txt.offsetHeight };
  document.addEventListener('touchmove', onResizeMove, { passive: false });
  document.addEventListener('touchend', onResizeEnd);
  document.addEventListener('touchcancel', onResizeEnd);
}
function onResizeMove(e) {
  if (!resizeState) return;
  e.preventDefault();
  const t = e.touches[0]; if (!t) return;
  const dx = (t.clientX - resizeState.sx) / zoomLevel;
  const dy = (t.clientY - resizeState.sy) / zoomLevel;
  const wrap = document.getElementById('wrap_' + resizeState.id);
  const txt = wrap?.querySelector('.new-text');
  if (!txt) return;
  txt.style.width     = Math.max(60, resizeState.ow + dx) + 'px';
  txt.style.minHeight = Math.max(26, resizeState.oh + dy) + 'px';
}
function onResizeEnd() {
  if (resizeState) {
    const wrap = document.getElementById('wrap_' + resizeState.id);
    const txt = wrap?.querySelector('.new-text');
    if (txt) {
      const items = pageNewItems.get(currentPage) || [];
      const item = items.find(x => x.id === resizeState.id);
      if (item) { item.w = parseFloat(txt.style.width); item.h = txt.offsetHeight; }
    }
  }
  resizeState = null;
  document.removeEventListener('touchmove', onResizeMove);
  document.removeEventListener('touchend', onResizeEnd);
  document.removeEventListener('touchcancel', onResizeEnd);
}

// ═══════════════════════════════════════════════════
//  Format changes from Top Bar
// ═══════════════════════════════════════════════════
function applyFormat(action, value) {
  if (activeFragId) {
    const div = document.getElementById(activeFragId);
    if (!div) return;
    let fs = parseInt(div.dataset.fontSize || '14', 10);
    if (action === 'sizeDown') fs = Math.max(6, fs - 1);
    else if (action === 'sizeUp') fs = Math.min(60, fs + 1);
    else if (action === 'font') div.dataset.fontKey = value;
    else if (action === 'color') div.dataset.colorKey = value;
    else if (action === 'bgToggle') div.dataset.hasBg = div.dataset.hasBg === 'false' ? 'true' : 'false';

    div.dataset.fontSize = String(fs);
    $cardSizeBadge.textContent = fs + ' pt';

    // Live update inside textarea
    const previewSize = Math.max(13, Math.min(26, 15 + (fs - 14) * 0.7));
    $cardTextarea.style.fontSize = previewSize + 'px';
    $cardTextarea.style.color = COLORS[div.dataset.colorKey || 'black'].hex;
    $cardTextarea.style.fontFamily = FONT_CSS[div.dataset.fontKey || 'Helvetica'];

    postRN({
      type: 'formatUpdated',
      fontSize: fs,
      colorKey: div.dataset.colorKey,
      fontKey: div.dataset.fontKey,
      hasBackground: div.dataset.hasBg !== 'false',
    });
    return;
  }

  if (activeNewId) {
    const items = pageNewItems.get(currentPage) || [];
    const item = items.find(i => i.id === activeNewId);
    const wrap = document.getElementById('wrap_' + activeNewId);
    const txt = wrap?.querySelector('.new-text');
    if (!item || !txt) return;

    if (action === 'sizeDown') item.fontSize = Math.max(8, item.fontSize - 1);
    else if (action === 'sizeUp') item.fontSize = Math.min(48, item.fontSize + 1);
    else if (action === 'font') item.fontKey = value;
    else if (action === 'color') item.colorKey = value;
    else if (action === 'bgToggle') item.hasBackground = !item.hasBackground;

    txt.style.fontSize = item.fontSize + 'px';
    txt.style.fontFamily = FONT_CSS[item.fontKey];
    txt.style.color = COLORS[item.colorKey].hex;
    txt.style.background = item.hasBackground ? '#ffffff' : 'transparent';

    postRN({
      type: 'formatUpdated',
      fontSize: item.fontSize,
      colorKey: item.colorKey,
      fontKey: item.fontKey,
      hasBackground: item.hasBackground,
    });
  }
}

// ═══════════════════════════════════════════════════
//  Undo last edit
// ═══════════════════════════════════════════════════
function undoLastEdit() {
  if (undoStack.length === 0) return;
  const action = undoStack.pop();

  if (action.type === 'frag') {
    const editsMap = pageEdits.get(action.page);
    if (editsMap) {
      if (action.prevEdit) {
        editsMap.set(action.fragId, action.prevEdit);
      } else {
        editsMap.delete(action.fragId);
      }
    }
    // Re-render the page to cleanly repaint the original canvas and remaining edits!
    renderPage(action.page);
  } else if (action.type === 'new') {
    removeNewItem(action.id);
  }

  notifyEditCount();
}

function deactivateAll() {
  if (activeNewId) {
    const currentId = activeNewId;
    const wrap = document.getElementById('wrap_' + currentId);
    const txt = wrap?.querySelector('.new-text');
    let textVal = '';
    if (txt) {
      txt.blur();
      txt.removeAttribute('contenteditable');
      textVal = (txt.textContent || '').trim();
    }
    activeNewId = null;

    if (!textVal) {
      // If user created a box but left it empty, discard it cleanly
      removeNewItem(currentId);
    } else {
      // Save text into item data
      for (const [, items] of pageNewItems) {
        const item = items.find(i => i.id === currentId);
        if (item) {
          item.text = txt ? (txt.textContent || '') : '';
          break;
        }
      }
      if (wrap) wrap.classList.remove('active');
      updateInteractionLocks();
      postRN({ type: 'textDeselected' });
      notifyEditCount();
    }
  }
}

$pageWrap.addEventListener('click', (e) => {
  if (e.target === $pageWrap || e.target === $pageBox || e.target === $canvas || e.target === $zoomC || e.target === $newLayer || e.target === $textLayer) {
    deactivateAll();
  }
});

// ═══════════════════════════════════════════════════
//  Collect all edits for saving
// ═══════════════════════════════════════════════════
function collectEdits() {
  const edits = [];

  for (const [pageNum, editMap] of pageEdits) {
    for (const [, ed] of editMap) {
      if (ed.newText === ed.origText && ed.colorKey === 'black' && ed.fontKey === 'Helvetica') continue;
      const pdfFontSize = ed.fontSize || ed.pdfFontH;
      const whiteoutH = ed.pdfFontH * 1.4;
      const whiteoutY = ed.pdfY - ed.pdfFontH * 0.25;
      const div = document.getElementById(ed.fragId);
      const measuredW = div ? div.scrollWidth : 0;
      const whiteoutW = Math.max(ed.pdfW, measuredW / scale) + 6;

      edits.push({
        id: 'e_' + pageNum + '_' + edits.length,
        type: 'text',
        pageIndex: pageNum - 1,
        x: ed.pdfX - 1,
        y: whiteoutY,
        width: whiteoutW,
        height: whiteoutH,
        text: ed.newText,
        fontSize: Math.round(pdfFontSize),
        fontFamily: ed.fontKey || 'Helvetica',
        textColor: COLORS[ed.colorKey || 'black'],
        hasBackground: ed.hasBg !== false,
      });
    }
  }

  for (const [pageNum, items] of pageNewItems) {
    for (const item of items) {
      if (!item.text || !item.text.trim()) continue;
      const pdfX = item.x / scale;
      const pdfYTop = item.y / scale;
      const pdfH = item.h / scale;
      const pdfY = pageHeightPt - pdfYTop - pdfH;
      const pdfW = item.w / scale;

      edits.push({
        id: item.id,
        type: 'text',
        pageIndex: pageNum - 1,
        x: pdfX,
        y: pdfY,
        width: pdfW,
        height: pdfH,
        text: item.text,
        fontSize: Math.round(item.fontSize),
        fontFamily: item.fontKey || 'Helvetica',
        textColor: COLORS[item.colorKey || 'black'],
        hasBackground: item.hasBackground !== false,
      });
    }
  }
  return edits;
}

function notifyEditCount() {
  let c = 0;
  for (const [, m] of pageEdits) c += m.size;
  for (const [, a] of pageNewItems) c += a.filter(i => i.text && i.text.trim()).length;
  postRN({
    type: 'editCount',
    count: c,
    canUndo: undoStack.length > 0,
  });
}

function resetAll() {
  pageEdits.clear();
  pageNewItems.clear();
  undoStack.length = 0;
  closeEditCard();
  deactivateAll();
  renderPage(currentPage);
  notifyEditCount();
}

function handleRNMessage(event) {
  let msg;
  try { msg = JSON.parse(event.data); } catch { return; }
  switch (msg.action) {
    case 'loadPdf':          loadPdf(msg.base64); break;
    case 'goToPage':         renderPage(msg.page); break;
    case 'addNewText':       addNewTextItem(); break;
    case 'requestEdits':     postRN({ type:'editsReady', edits: collectEdits() }); break;
    case 'reset':            resetAll(); break;
    case 'undo':             undoLastEdit(); break;
    case 'commitActiveText': commitEditCard(); deactivateAll(); break;
    case 'format':           applyFormat(msg.fmt, msg.value); break;
    case 'deselect':         closeEditCard(); deactivateAll(); break;
  }
}
document.addEventListener('message', handleRNMessage);
window.addEventListener('message', handleRNMessage);

async function loadPdf(base64) {
  try {
    $loading.classList.remove('hidden');
    const raw = atob(base64);
    const bytes = new Uint8Array(raw.length);
    for (let i = 0; i < raw.length; i++) bytes[i] = raw.charCodeAt(i);
    pdfDoc = await pdfjsLib.getDocument({ data: bytes }).promise;
    totalPages = pdfDoc.numPages;
    postRN({ type:'pdfLoaded', pageCount: totalPages, currentPage: 1 });
    await renderPage(1);
    $loading.classList.add('hidden');
  } catch (err) {
    postRN({ type:'error', message: 'Error cargando PDF: ' + (err.message || err) });
    $loading.classList.add('hidden');
  }
}

postRN({ type:'ready' });
</script>
</body>
</html>`;
}
