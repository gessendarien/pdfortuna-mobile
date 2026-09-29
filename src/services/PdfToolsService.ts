import RNFS from 'react-native-fs';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

export interface WatermarkOptions {
    text?: string;
    imagePath?: string;
    imageBase64?: string;
    opacity?: number;
    size?: number;
    color?: { r: number; g: number; b: number };
    rotation?: number; // degrees
    layout?: 'center' | 'diagonal' | 'repeat' | 'single';
    x?: number;        // in PDF points for 'single'
    y?: number;
    width?: number;
    height?: number;
    pageIndex?: number; // 0-based; if undefined or -1 applies to all pages
    pages?: number[];   // 0-based page indices to apply to
    lineSpacing?: number;
    saveMode?: 'original' | 'copy';
}

export interface DocumentEditItem {
    id: string;
    type: 'whiteout' | 'text' | 'image';
    pageIndex: number; // 0-based
    x: number;         // PDF coordinates (pt)
    y: number;
    width: number;
    height: number;
    text?: string;
    fontSize?: number;
    textColor?: { r: number; g: number; b: number };
    hasBackground?: boolean;
    fontFamily?: string; // 'Helvetica' | 'TimesRoman' | 'Courier'
    imagePath?: string;
    imageBase64?: string;
}

export interface RedactionBox {
    pageIndex: number; // 0-based
    x: number;         // PDF coordinates (pt)
    y: number;
    width: number;
    height: number;
    color?: { r: number; g: number; b: number };
    isBlur?: boolean;
}

export interface SignaturePlacement {
    pageIndex: number;
    pages?: number[]; // 0-indexed page indices to stamp signature on
    rotationDeg?: number; // rotation in degrees
    signatureBase64?: string; // PNG or JPG base64
    svgPaths?: string[];
    strokeColor?: { r: number; g: number; b: number };
    canvasWidth?: number;
    canvasHeight?: number;
    x: number;
    y: number;
    width: number;
    height: number;
}

export interface FormFieldInfo {
    name: string;
    type: 'text' | 'checkbox' | 'dropdown' | 'radio' | 'button' | 'unknown';
    value?: string | boolean;
    options?: string[];
}

export class PdfToolsService {
    /**
     * Resolves and ensures output directory in Downloads/PDFortuna
     */
    static async getOutputDir(): Promise<string> {
        const dir = `${RNFS.DownloadDirectoryPath}/PDFortuna`;
        const exists = await RNFS.exists(dir);
        if (!exists) {
            await RNFS.mkdir(dir);
        }
        return dir;
    }

    /**
     * Generate safe timestamped output path
     */
    static async getUniqueOutputPath(baseName: string): Promise<string> {
        const dir = await this.getOutputDir();
        const cleanBase = baseName.replace(/\.pdf$/i, '').replace(/[^a-zA-Z0-9_\-]/g, '_');
        const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
        return `${dir}/${cleanBase}_${timestamp}.pdf`;
    }

    /**
     * Resolves destination path according to saveMode ('copy' or 'original')
     */
    static async resolveDestinationPath(
        sourcePath: string,
        outputName: string,
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const normalizedSource = sourcePath.replace(/^file:\/\//, '');
        if (saveMode === 'original') {
            return normalizedSource;
        }
        return await this.getUniqueOutputPath(outputName);
    }

    /**
     * Helper to load a PDF from disk into a PDFDocument
     */
    private static async loadPdf(filePath: string): Promise<PDFDocument> {
        const normalizedPath = filePath.replace(/^file:\/\//, '');
        const base64 = await RNFS.readFile(normalizedPath, 'base64');
        const buffer = Buffer.from(base64, 'base64');
        return await PDFDocument.load(buffer, { ignoreEncryption: true });
    }

    /**
     * Helper to save a PDFDocument to a destination path
     */
    private static async savePdf(doc: PDFDocument, destPath: string): Promise<string> {
        const base64 = await doc.saveAsBase64({ dataUri: false });
        await RNFS.writeFile(destPath, base64, 'base64');
        return destPath;
    }

    /**
     * 1. MERGE: Combines multiple PDFs into a single file
     */
    static async mergeFiles(paths: string[], outputName = 'unido'): Promise<string> {
        if (!paths || paths.length < 2) {
            throw new Error('Se requieren al menos 2 documentos para combinar.');
        }

        const mergedDoc = await PDFDocument.create();

        for (const path of paths) {
            const doc = await this.loadPdf(path);
            const copiedPages = await mergedDoc.copyPages(doc, doc.getPageIndices());
            copiedPages.forEach((page) => mergedDoc.addPage(page));
        }

        const dest = await this.getUniqueOutputPath(outputName);
        return await this.savePdf(mergedDoc, dest);
    }

    /**
     * 2. SPLIT: Splits a PDF into multiple PDFs by ranges or page-by-page
     * Ranges format example: "1-3, 4, 5-8"
     */
    static async splitFile(
        sourcePath: string,
        rangesString: string,
        outputBaseName = 'dividido'
    ): Promise<string[]> {
        const doc = await this.loadPdf(sourcePath);
        const totalPages = doc.getPageCount();
        const results: string[] = [];

        // Parse ranges (1-indexed for user)
        const parts = rangesString.split(',').map((p) => p.trim()).filter(Boolean);

        for (let idx = 0; idx < parts.length; idx++) {
            const part = parts[idx];
            let pageIndices: number[] = [];

            if (part.includes('-')) {
                const [startStr, endStr] = part.split('-').map((s) => s.trim());
                const start = Math.max(1, parseInt(startStr, 10));
                const end = Math.min(totalPages, parseInt(endStr, 10));
                if (!isNaN(start) && !isNaN(end) && start <= end) {
                    for (let p = start; p <= end; p++) {
                        pageIndices.push(p - 1);
                    }
                }
            } else {
                const single = parseInt(part, 10);
                if (!isNaN(single) && single >= 1 && single <= totalPages) {
                    pageIndices.push(single - 1);
                }
            }

            if (pageIndices.length > 0) {
                const newDoc = await PDFDocument.create();
                const copied = await newDoc.copyPages(doc, pageIndices);
                copied.forEach((cp) => newDoc.addPage(cp));

                const partName = parts.length > 1 ? `${outputBaseName}_parte_${idx + 1}` : outputBaseName;
                const dest = await this.getUniqueOutputPath(partName);
                await this.savePdf(newDoc, dest);
                results.push(dest);
            }
        }

        if (results.length === 0) {
            throw new Error('No se generaron partes. Verifica los rangos de páginas.');
        }

        return results;
    }

    /**
     * 3. DELETE PAGES: Removes specific pages from a PDF
     * @param pagesToDelete 1-indexed page numbers
     */
    static async deletePages(
        sourcePath: string,
        pagesToDelete: number[],
        outputName = 'paginas_eliminadas'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const total = doc.getPageCount();

        const toDeleteSet = new Set(pagesToDelete.map((p) => p - 1));
        if (toDeleteSet.size >= total) {
            throw new Error('No puedes eliminar todas las páginas del documento.');
        }

        // Keep pages that are not in toDeleteSet
        const keepIndices: number[] = [];
        for (let i = 0; i < total; i++) {
            if (!toDeleteSet.has(i)) {
                keepIndices.push(i);
            }
        }

        const newDoc = await PDFDocument.create();
        const copied = await newDoc.copyPages(doc, keepIndices);
        copied.forEach((p) => newDoc.addPage(p));

        const dest = await this.getUniqueOutputPath(outputName);
        return await this.savePdf(newDoc, dest);
    }

    /**
     * 4. REORDER: Reorders pages according to a new index list (1-indexed)
     */
    static async reorderPages(
        sourcePath: string,
        newOrder: number[],
        outputName = 'reordenado',
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const total = doc.getPageCount();

        if (newOrder.length !== total) {
            throw new Error('La lista de orden debe incluir todas las páginas.');
        }

        const zeroBasedOrder = newOrder.map((p) => p - 1);
        const newDoc = await PDFDocument.create();
        const copied = await newDoc.copyPages(doc, zeroBasedOrder);
        copied.forEach((p) => newDoc.addPage(p));

        const dest = await this.resolveDestinationPath(sourcePath, outputName, saveMode);
        return await this.savePdf(newDoc, dest);
    }

    /**
     * 5. ROTATE: Rotates specific pages by angle (90, 180, 270)
     * @param rotations Record of 1-indexed page number -> added degrees
     */
    static async rotatePages(
        sourcePath: string,
        rotations: Record<number, number>,
        outputName = 'rotado',
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const pages = doc.getPages();

        for (const [pageStr, deg] of Object.entries(rotations)) {
            const pageNum = parseInt(pageStr, 10);
            const pageIndex = pageNum - 1;
            if (pageIndex >= 0 && pageIndex < pages.length && deg !== 0) {
                const page = pages[pageIndex];
                const currentRotation = page.getRotation().angle;
                const newRotation = (currentRotation + deg + 360) % 360;
                page.setRotation(degrees(newRotation));
            }
        }

        const dest = await this.resolveDestinationPath(sourcePath, outputName, saveMode);
        return await this.savePdf(doc, dest);
    }

    /**
     * 6. WATERMARK: Adds text or image watermark across pages (single or repeated)
     */
    static async addWatermark(
        sourcePath: string,
        opts: WatermarkOptions,
        outputName = 'marca_de_agua',
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const pages = doc.getPages();

        const fontSize = opts.size || 36;
        const opacity = Math.max(0.01, Math.min(1.0, opts.opacity ?? 0.3));
        const color = opts.color ? rgb(opts.color.r, opts.color.g, opts.color.b) : rgb(0.86, 0.12, 0.27);
        const rot = degrees(opts.rotation ?? 45);

        let embeddedImage: any = null;
        if (opts.imagePath || opts.imageBase64) {
            try {
                let imgBuffer: Buffer;
                let isJpg = false;
                if (opts.imageBase64) {
                    const cleanB64 = opts.imageBase64.replace(/^data:image\/\w+;base64,/, '');
                    imgBuffer = Buffer.from(cleanB64, 'base64');
                    isJpg = cleanB64.startsWith('/9j/');
                } else if (opts.imagePath) {
                    const cleanPath = opts.imagePath.replace(/^file:\/\//, '');
                    const b64 = await RNFS.readFile(cleanPath, 'base64');
                    imgBuffer = Buffer.from(b64, 'base64');
                    isJpg = cleanPath.toLowerCase().endsWith('.jpg') || cleanPath.toLowerCase().endsWith('.jpeg') || b64.startsWith('/9j/');
                } else {
                    imgBuffer = Buffer.from('');
                }
                embeddedImage = isJpg ? await doc.embedJpg(imgBuffer) : await doc.embedPng(imgBuffer);
            } catch (err) {
                console.warn('Error embedding watermark image:', err);
            }
        }

        const font = opts.text ? await doc.embedFont(StandardFonts.HelveticaBold) : null;

        for (let idx = 0; idx < pages.length; idx++) {
            if (opts.pages && opts.pages.length > 0 && !opts.pages.includes(idx) && !opts.pages.includes(idx + 1)) {
                continue;
            }
            if (opts.pageIndex !== undefined && opts.pageIndex >= 0 && opts.pageIndex !== idx) {
                continue;
            }

            const page = pages[idx];
            const { width, height } = page.getSize();

            if (embeddedImage) {
                const imgAspect = embeddedImage.height / embeddedImage.width;
                if (opts.layout === 'repeat') {
                    const imgW = Math.min(140, width / 3);
                    const imgH = imgW * imgAspect;
                    const stepX = imgW * 1.6;
                    const stepY = imgH * 1.6;
                    for (let x = 20; x < width; x += stepX) {
                        for (let y = 20; y < height; y += stepY) {
                            page.drawImage(embeddedImage, {
                                x,
                                y,
                                width: imgW,
                                height: imgH,
                                opacity,
                                rotate: rot,
                            });
                        }
                    }
                } else if (opts.layout === 'single') {
                    const w = opts.width || 180;
                    const h = opts.height || w * imgAspect;
                    const x = opts.x !== undefined ? opts.x : (width - w) / 2;
                    const y = opts.y !== undefined ? opts.y : (height - h) / 2;

                    let drawX = x;
                    let drawY = y;
                    const rotDeg = opts.rotation || 0;
                    if (rotDeg !== 0) {
                        const rad = (rotDeg * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        const cx = x + w / 2;
                        const cy = y + h / 2;
                        drawX = cx - (w / 2) * cos + (h / 2) * sin;
                        drawY = cy - (w / 2) * sin - (h / 2) * cos;
                    }

                    page.drawImage(embeddedImage, {
                        x: drawX,
                        y: drawY,
                        width: w,
                        height: h,
                        opacity,
                        rotate: degrees(rotDeg),
                    });
                } else {
                    // Center diagonal
                    const w = Math.min(width * 0.6, 260);
                    const h = w * imgAspect;
                    page.drawImage(embeddedImage, {
                        x: (width - w) / 2,
                        y: (height - h) / 2,
                        width: w,
                        height: h,
                        opacity,
                        rotate: rot,
                    });
                }
            } else if (opts.text && font) {
                const textWidth = font.widthOfTextAtSize(opts.text, fontSize);
                const textHeight = font.heightAtSize(fontSize);

                if (opts.layout === 'repeat') {
                    const lineSpacingFactor = opts.lineSpacing || 4.5;
                    const stepX = Math.max(160, textWidth * 1.3);
                    const stepY = Math.max(70, textHeight * lineSpacingFactor);
                    for (let x = 30; x < width + 100; x += stepX) {
                        for (let y = 30; y < height + 100; y += stepY) {
                            page.drawText(opts.text, {
                                x,
                                y,
                                size: fontSize * 0.75,
                                font,
                                color,
                                opacity,
                                rotate: rot,
                            });
                        }
                    }
                } else if (opts.layout === 'single') {
                    const x = opts.x !== undefined ? opts.x : (width - textWidth) / 2;
                    const y = opts.y !== undefined ? opts.y : (height - textHeight) / 2;

                    let drawX = x;
                    let drawY = y;
                    const rotDeg = opts.rotation || 0;
                    if (rotDeg !== 0) {
                        const rad = (rotDeg * Math.PI) / 180;
                        const cos = Math.cos(rad);
                        const sin = Math.sin(rad);
                        const cx = x + textWidth / 2;
                        const cy = y + textHeight / 2;
                        drawX = cx - (textWidth / 2) * cos + (textHeight / 2) * sin;
                        drawY = cy - (textWidth / 2) * sin - (textHeight / 2) * cos;
                    }

                    page.drawText(opts.text, {
                        x: drawX,
                        y: drawY,
                        size: fontSize,
                        font,
                        color,
                        opacity,
                        rotate: degrees(rotDeg),
                    });
                } else {
                    // Center diagonal
                    const centerX = (width - textWidth) / 2;
                    const centerY = (height - textHeight) / 2;
                    page.drawText(opts.text, {
                        x: centerX,
                        y: centerY,
                        size: fontSize,
                        font,
                        color,
                        opacity,
                        rotate: rot,
                    });
                }
            }
        }

        const dest = await this.resolveDestinationPath(sourcePath, outputName, opts.saveMode || saveMode);
        return await this.savePdf(doc, dest);
    }

    /**
     * 7. REDACT: Draws opaque black redaction rectangles over specified areas
     */
    static async redactDocument(
        sourcePath: string,
        boxes: RedactionBox[],
        outputName = 'censurado',
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const pages = doc.getPages();

        for (const box of boxes) {
            if (box.pageIndex >= 0 && box.pageIndex < pages.length) {
                const page = pages[box.pageIndex];
                if (box.isBlur) {
                    // Opaque pixelated blur / mosaic censorship (100% blocks text)
                    // Layer 1: Solid opaque slate base to completely obscure underlying content
                    page.drawRectangle({
                        x: box.x,
                        y: box.y,
                        width: box.width,
                        height: box.height,
                        color: rgb(0.58, 0.64, 0.72),
                        opacity: 1.0,
                    });

                    // Layer 2: Opaque mosaic pixel tiles
                    const blockSize = Math.max(3, Math.min(6, Math.min(box.width, box.height) / 2));
                    const cols = Math.max(1, Math.ceil(box.width / blockSize));
                    const rows = Math.max(1, Math.ceil(box.height / blockSize));
                    const stepW = box.width / cols;
                    const stepH = box.height / rows;

                    const MOSAIC_PALETTE = [
                        rgb(0.58, 0.64, 0.72),
                        rgb(0.79, 0.83, 0.88),
                        rgb(0.88, 0.91, 0.94),
                        rgb(0.40, 0.46, 0.55),
                        rgb(0.94, 0.96, 0.98),
                        rgb(0.48, 0.54, 0.62),
                        rgb(0.70, 0.75, 0.82),
                        rgb(0.82, 0.85, 0.89),
                    ];

                    for (let c = 0; c < cols; c++) {
                        for (let r = 0; r < rows; r++) {
                            const hash = Math.abs(Math.sin((box.x + c * stepW) * 12.9898 + (box.y + r * stepH) * 78.233) * 43758.5453);
                            const palIdx = Math.floor(hash) % MOSAIC_PALETTE.length;
                            const tileColor = MOSAIC_PALETTE[palIdx];

                            page.drawRectangle({
                                x: box.x + c * stepW,
                                y: box.y + r * stepH,
                                width: stepW,
                                height: stepH,
                                color: tileColor,
                                opacity: 1.0,
                                borderColor: rgb(0.92, 0.94, 0.96),
                                borderWidth: 0.3,
                                borderOpacity: 0.6,
                            });
                        }
                    }
                } else {
                    const rectColor = box.color
                        ? rgb(box.color.r, box.color.g, box.color.b)
                        : rgb(0, 0, 0);
                    page.drawRectangle({
                        x: box.x,
                        y: box.y,
                        width: box.width,
                        height: box.height,
                        color: rectColor,
                        opacity: 1.0,
                    });
                }
            }
        }

        const dest = await this.resolveDestinationPath(sourcePath, outputName, saveMode);
        return await this.savePdf(doc, dest);
    }

    /**
     * 8. SIGNATURE: Stamps a signature (image or SVG drawing) on specified page(s)
     */
    static async applySignature(
        sourcePath: string,
        placement: SignaturePlacement,
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const normalizedSource = sourcePath.replace(/^file:\/\//, '');
        const doc = await this.loadPdf(normalizedSource);
        const pages = doc.getPages();

        const targetPageIndices =
            placement.pages && placement.pages.length > 0
                ? placement.pages.filter((idx) => idx >= 0 && idx < pages.length)
                : [placement.pageIndex];

        const validPageIndices = targetPageIndices.filter((idx) => idx >= 0 && idx < pages.length);
        if (validPageIndices.length === 0) {
            throw new Error('Página inválida para insertar firma.');
        }

        const rotDeg = placement.rotationDeg || 0;
        const rad = (rotDeg * Math.PI) / 180;
        const cos = Math.cos(rad);
        const sin = Math.sin(rad);

        // Center coordinates of the bounding box
        const cx = placement.x + placement.width / 2;
        const cy = placement.y + placement.height / 2;

        let embeddedImage: any = null;
        if (placement.signatureBase64) {
            const cleanBase64 = placement.signatureBase64.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(cleanBase64, 'base64');
            if (cleanBase64.startsWith('/9j/')) {
                embeddedImage = await doc.embedJpg(imageBuffer);
            } else {
                embeddedImage = await doc.embedPng(imageBuffer);
            }
        }

        const strokeColor = placement.strokeColor
            ? rgb(placement.strokeColor.r, placement.strokeColor.g, placement.strokeColor.b)
            : rgb(0, 0, 0);

        const canvasW = placement.canvasWidth || 300;
        const canvasH = placement.canvasHeight || 150;
        const scaleX = placement.width / canvasW;
        const scaleY = placement.height / canvasH;
        const scale = Math.min(scaleX, scaleY);

        for (const pageIdx of validPageIndices) {
            const page = pages[pageIdx];

            if (embeddedImage) {
                let imgX = placement.x;
                let imgY = placement.y;
                if (rotDeg !== 0) {
                    imgX = cx - (placement.width / 2) * cos + (placement.height / 2) * sin;
                    imgY = cy - (placement.width / 2) * sin - (placement.height / 2) * cos;
                }
                page.drawImage(embeddedImage, {
                    x: imgX,
                    y: imgY,
                    width: placement.width,
                    height: placement.height,
                    rotate: degrees(rotDeg),
                });
            } else if (placement.svgPaths && placement.svgPaths.length > 0) {
                const lx = placement.width / 2;
                const ly = -placement.height / 2;
                const rx = lx * cos - ly * sin;
                const ry = lx * sin + ly * cos;
                const svgX = cx - rx;
                const svgY = cy - ry;

                for (const p of placement.svgPaths) {
                    page.drawSvgPath(p, {
                        x: svgX,
                        y: svgY,
                        scale,
                        rotate: degrees(rotDeg),
                        borderColor: strokeColor,
                        borderWidth: Math.max(1.5, 2.5 * scale),
                    });
                }
            }
        }

        let destPath: string;
        if (saveMode === 'original') {
            destPath = normalizedSource;
        } else {
            const dir = normalizedSource.substring(0, normalizedSource.lastIndexOf('/'));
            const fileName = normalizedSource.substring(normalizedSource.lastIndexOf('/') + 1);
            const baseName = fileName.replace(/\.pdf$/i, '');
            destPath = `${dir}/${baseName}_firmado.pdf`;

            try {
                const dirExists = await RNFS.exists(dir);
                if (!dirExists) {
                    const outDir = await this.getOutputDir();
                    destPath = `${outDir}/${baseName}_firmado.pdf`;
                }
            } catch {
                const outDir = await this.getOutputDir();
                destPath = `${outDir}/${baseName}_firmado.pdf`;
            }
        }

        return await this.savePdf(doc, destPath);
    }

    /**
     * 9. EDIT: Whiteout, text insertion, and image insertion
     */
    static async applyDocumentEdits(
        sourcePath: string,
        edits: DocumentEditItem[],
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const cleanSource = sourcePath.replace(/^file:\/\//, '');
        const doc = await this.loadPdf(cleanSource);
        const pages = doc.getPages();

        // Embed available standard fonts
        const fontHelvetica = await doc.embedFont(StandardFonts.Helvetica);
        const fontTimes     = await doc.embedFont(StandardFonts.TimesRoman);
        const fontCourier   = await doc.embedFont(StandardFonts.Courier);
        const fontMap: Record<string, typeof fontHelvetica> = {
            Helvetica: fontHelvetica,
            TimesRoman: fontTimes,
            Courier: fontCourier,
            Arial: fontHelvetica,
            Georgia: fontTimes,
        };
        const getFont = (family?: string) => fontMap[family || 'Helvetica'] || fontHelvetica;

        for (const item of edits) {
            if (item.pageIndex < 0 || item.pageIndex >= pages.length) continue;
            const page = pages[item.pageIndex];

            if (item.type === 'whiteout') {
                page.drawRectangle({
                    x: item.x,
                    y: item.y,
                    width: item.width,
                    height: item.height,
                    color: rgb(1, 1, 1),
                    opacity: 1.0,
                });
            } else if (item.type === 'text' && item.text) {
                // If hasBackground is true (default true), cover whatever text was under it like Sejda / Word
                if (item.hasBackground !== false) {
                    page.drawRectangle({
                        x: item.x,
                        y: item.y,
                        width: Math.max(item.width, 20),
                        height: Math.max(item.height, 14),
                        color: rgb(1, 1, 1),
                        opacity: 1.0,
                    });
                }

                const textColor = item.textColor
                    ? rgb(item.textColor.r, item.textColor.g, item.textColor.b)
                    : rgb(0, 0, 0);
                const size = item.fontSize || 14;
                const lineHeight = size * 1.25;
                const lines = item.text.split('\n');
                const totalTextH = (lines.length - 1) * lineHeight + size;
                const verticalPadding = Math.max(2, (item.height - totalTextH) / 2);
                const firstLineBaseline = item.y + item.height - size - verticalPadding;

                page.drawText(item.text, {
                    x: item.x + 3,
                    y: firstLineBaseline,
                    size,
                    lineHeight,
                    font: getFont(item.fontFamily),
                    color: textColor,
                });
            } else if (item.type === 'image' && (item.imagePath || item.imageBase64)) {
                try {
                    let imgBuffer: Buffer;
                    let isJpg = false;
                    if (item.imageBase64) {
                        const cleanB64 = item.imageBase64.replace(/^data:image\/\w+;base64,/, '');
                        imgBuffer = Buffer.from(cleanB64, 'base64');
                        isJpg = cleanB64.startsWith('/9j/');
                    } else if (item.imagePath) {
                        const cleanPath = item.imagePath.replace(/^file:\/\//, '');
                        const b64 = await RNFS.readFile(cleanPath, 'base64');
                        imgBuffer = Buffer.from(b64, 'base64');
                        isJpg = cleanPath.toLowerCase().endsWith('.jpg') || cleanPath.toLowerCase().endsWith('.jpeg') || b64.startsWith('/9j/');
                    } else {
                        continue;
                    }

                    const embeddedImg = isJpg ? await doc.embedJpg(imgBuffer) : await doc.embedPng(imgBuffer);
                    page.drawImage(embeddedImg, {
                        x: item.x,
                        y: item.y,
                        width: item.width,
                        height: item.height,
                    });
                } catch (imgErr) {
                    console.warn('Error embedding image in edit:', imgErr);
                }
            }
        }

        let destPath: string;
        if (saveMode === 'original') {
            destPath = cleanSource;
        } else {
            const dir = cleanSource.substring(0, cleanSource.lastIndexOf('/'));
            const fileName = cleanSource.substring(cleanSource.lastIndexOf('/') + 1);
            const baseName = fileName.replace(/\.pdf$/i, '');
            destPath = `${dir}/${baseName}_editado.pdf`;

            try {
                const dirExists = await RNFS.exists(dir);
                if (!dirExists) {
                    const outDir = await this.getOutputDir();
                    destPath = `${outDir}/${baseName}_editado.pdf`;
                }
            } catch {
                const outDir = await this.getOutputDir();
                destPath = `${outDir}/${baseName}_editado.pdf`;
            }
        }

        return await this.savePdf(doc, destPath);
    }

    /**
     * 10. FORM FIELDS: Get AcroForm fields
     */
    static async getFormFields(sourcePath: string): Promise<FormFieldInfo[]> {
        const doc = await this.loadPdf(sourcePath);
        const form = doc.getForm();
        const fields = form.getFields();

        return fields.map((f) => {
            const name = f.getName();
            let type: FormFieldInfo['type'] = 'unknown';
            let value: string | boolean | undefined = undefined;
            let options: string[] | undefined = undefined;

            const constructorName = f.constructor.name;
            if (constructorName.includes('PDFTextField')) {
                type = 'text';
                try {
                    const tf = form.getTextField(name);
                    value = tf.getText() || '';
                } catch {}
            } else if (constructorName.includes('PDFCheckBox')) {
                type = 'checkbox';
                try {
                    const cb = form.getCheckBox(name);
                    value = cb.isChecked();
                } catch {}
            } else if (constructorName.includes('PDFDropdown')) {
                type = 'dropdown';
                try {
                    const dd = form.getDropdown(name);
                    options = dd.getOptions();
                    const sel = dd.getSelected();
                    value = sel && sel.length > 0 ? sel[0] : (options.length > 0 ? options[0] : '');
                } catch {}
            } else if (constructorName.includes('PDFOptionList')) {
                type = 'dropdown';
                try {
                    const optList = form.getOptionList(name);
                    options = optList.getOptions();
                    const sel = optList.getSelected();
                    value = sel && sel.length > 0 ? sel[0] : (options.length > 0 ? options[0] : '');
                } catch {}
            } else if (constructorName.includes('PDFRadioGroup')) {
                type = 'radio';
                try {
                    const rg = form.getRadioGroup(name);
                    options = rg.getOptions();
                    value = rg.getSelected();
                } catch {}
            } else if (constructorName.includes('PDFButton')) {
                type = 'button';
            }

            return {
                name,
                type,
                value,
                options,
            };
        });
    }

    /**
     * 10. FORM FIELDS: Fill fields and flatten
     */
    static async fillForm(
        sourcePath: string,
        values: Record<string, string | boolean>,
        flatten = false,
        outputName = 'formulario_completado',
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const form = doc.getForm();

        for (const [name, val] of Object.entries(values)) {
            try {
                const field = form.getField(name);
                const cname = field.constructor.name;
                if (cname.includes('PDFTextField') && typeof val === 'string') {
                    form.getTextField(name).setText(val);
                } else if (cname.includes('PDFCheckBox')) {
                    if (val === true || val === 'true') form.getCheckBox(name).check();
                    else form.getCheckBox(name).uncheck();
                } else if (cname.includes('PDFDropdown') && typeof val === 'string') {
                    form.getDropdown(name).select(val);
                } else if (cname.includes('PDFOptionList') && typeof val === 'string') {
                    form.getOptionList(name).select(val);
                } else if (cname.includes('PDFRadioGroup') && typeof val === 'string') {
                    form.getRadioGroup(name).select(val);
                }
            } catch (e) {
                console.warn(`Could not set field ${name}:`, e);
            }
        }

        if (flatten) {
            form.flatten();
        }

        const dest = await this.resolveDestinationPath(sourcePath, outputName, saveMode);
        return await this.savePdf(doc, dest);
    }

    /**
     * Inspect PDF page dimensions and total pages
     */
    static async getPdfInfo(filePath: string): Promise<{
        pageCount: number;
        pages: { width: number; height: number; rotation: number }[];
    }> {
        const doc = await this.loadPdf(filePath);
        const pages = doc.getPages();
        return {
            pageCount: pages.length,
            pages: pages.map((p) => ({
                width: p.getWidth(),
                height: p.getHeight(),
                rotation: p.getRotation().angle,
            })),
        };
    }
}
