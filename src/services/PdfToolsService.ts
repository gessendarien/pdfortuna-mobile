import RNFS from 'react-native-fs';
import { PDFDocument, rgb, degrees, StandardFonts } from 'pdf-lib';
import { Buffer } from 'buffer';

export interface WatermarkOptions {
    text: string;
    opacity?: number;
    size?: number;
    color?: { r: number; g: number; b: number };
    rotation?: number; // degrees
    layout?: 'center' | 'diagonal' | 'repeat';
}

export interface RedactionBox {
    pageIndex: number; // 0-based
    x: number;         // PDF coordinates (pt)
    y: number;
    width: number;
    height: number;
}

export interface SignaturePlacement {
    pageIndex: number;
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

                const dest = await this.getUniqueOutputPath(`${outputBaseName}_parte_${idx + 1}`);
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
        outputName = 'reordenado'
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

        const dest = await this.getUniqueOutputPath(outputName);
        return await this.savePdf(newDoc, dest);
    }

    /**
     * 5. ROTATE: Rotates specific pages by angle (90, 180, 270)
     * @param rotations Record of 1-indexed page number -> added degrees
     */
    static async rotatePages(
        sourcePath: string,
        rotations: Record<number, number>,
        outputName = 'rotado'
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

        const dest = await this.getUniqueOutputPath(outputName);
        return await this.savePdf(doc, dest);
    }

    /**
     * 6. WATERMARK: Adds text watermark across pages
     */
    static async addWatermark(
        sourcePath: string,
        opts: WatermarkOptions,
        outputName = 'marca_de_agua'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const font = await doc.embedFont(StandardFonts.HelveticaBold);
        const pages = doc.getPages();

        const fontSize = opts.size || 48;
        const opacity = opts.opacity ?? 0.3;
        const color = opts.color ? rgb(opts.color.r, opts.color.g, opts.color.b) : rgb(0.8, 0.1, 0.2);
        const rot = degrees(opts.rotation ?? 45);

        for (const page of pages) {
            const { width, height } = page.getSize();
            const textWidth = font.widthOfTextAtSize(opts.text, fontSize);
            const textHeight = font.heightAtSize(fontSize);

            if (opts.layout === 'repeat') {
                // Repeat watermark grid
                const stepX = width / 2;
                const stepY = height / 3;
                for (let x = 50; x < width; x += stepX) {
                    for (let y = 80; y < height; y += stepY) {
                        page.drawText(opts.text, {
                            x,
                            y,
                            size: fontSize * 0.7,
                            font,
                            color,
                            opacity,
                            rotate: rot,
                        });
                    }
                }
            } else {
                // Diagonal center watermark
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

        const dest = await this.getUniqueOutputPath(outputName);
        return await this.savePdf(doc, dest);
    }

    /**
     * 7. REDACT: Draws opaque black redaction rectangles over specified areas
     */
    static async redactDocument(
        sourcePath: string,
        boxes: RedactionBox[],
        outputName = 'censurado'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const pages = doc.getPages();

        for (const box of boxes) {
            if (box.pageIndex >= 0 && box.pageIndex < pages.length) {
                const page = pages[box.pageIndex];
                page.drawRectangle({
                    x: box.x,
                    y: box.y,
                    width: box.width,
                    height: box.height,
                    color: rgb(0, 0, 0),
                    opacity: 1.0,
                });
            }
        }

        const dest = await this.getUniqueOutputPath(outputName);
        return await this.savePdf(doc, dest);
    }

    /**
     * 8. SIGNATURE: Stamps a signature (image or SVG drawing) on the specified page
     */
    static async applySignature(
        sourcePath: string,
        placement: SignaturePlacement,
        saveMode: 'original' | 'copy' = 'copy'
    ): Promise<string> {
        const normalizedSource = sourcePath.replace(/^file:\/\//, '');
        const doc = await this.loadPdf(normalizedSource);
        const pages = doc.getPages();

        if (placement.pageIndex < 0 || placement.pageIndex >= pages.length) {
            throw new Error('Página inválida para insertar firma.');
        }

        const page = pages[placement.pageIndex];

        if (placement.signatureBase64) {
            const cleanBase64 = placement.signatureBase64.replace(/^data:image\/\w+;base64,/, '');
            const imageBuffer = Buffer.from(cleanBase64, 'base64');
            let embeddedImage;
            if (cleanBase64.startsWith('/9j/')) {
                embeddedImage = await doc.embedJpg(imageBuffer);
            } else {
                embeddedImage = await doc.embedPng(imageBuffer);
            }

            page.drawImage(embeddedImage, {
                x: placement.x,
                y: placement.y,
                width: placement.width,
                height: placement.height,
            });
        } else if (placement.svgPaths && placement.svgPaths.length > 0) {
            const strokeColor = placement.strokeColor
                ? rgb(placement.strokeColor.r, placement.strokeColor.g, placement.strokeColor.b)
                : rgb(0, 0, 0);

            const canvasW = placement.canvasWidth || 300;
            const canvasH = placement.canvasHeight || 150;
            const scaleX = placement.width / canvasW;
            const scaleY = placement.height / canvasH;
            const scale = Math.min(scaleX, scaleY);

            // In pdf-lib, drawSvgPath flips Y via scale(scale, -scale).
            // So y anchor is top of the box in PDF coordinates:
            const startY = placement.y + placement.height;

            for (const p of placement.svgPaths) {
                page.drawSvgPath(p, {
                    x: placement.x,
                    y: startY,
                    scale,
                    borderColor: strokeColor,
                    borderWidth: Math.max(1.5, 2.5 * scale),
                });
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
     * 9. FORM FIELDS: Get AcroForm fields
     */
    static async getFormFields(sourcePath: string): Promise<FormFieldInfo[]> {
        const doc = await this.loadPdf(sourcePath);
        const form = doc.getForm();
        const fields = form.getFields();

        return fields.map((f) => {
            const name = f.getName();
            let type: FormFieldInfo['type'] = 'unknown';

            // Check field constructor / type
            const constructorName = f.constructor.name;
            if (constructorName.includes('PDFTextField')) type = 'text';
            else if (constructorName.includes('PDFCheckBox')) type = 'checkbox';
            else if (constructorName.includes('PDFDropdown')) type = 'dropdown';
            else if (constructorName.includes('PDFRadioGroup')) type = 'radio';
            else if (constructorName.includes('PDFButton')) type = 'button';

            return {
                name,
                type,
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
        outputName = 'formulario_completado'
    ): Promise<string> {
        const doc = await this.loadPdf(sourcePath);
        const form = doc.getForm();

        for (const [name, val] of Object.entries(values)) {
            try {
                const field = form.getField(name);
                const cname = field.constructor.name;
                if (cname.includes('PDFTextField') && typeof val === 'string') {
                    form.getTextField(name).setText(val);
                } else if (cname.includes('PDFCheckBox') && typeof val === 'boolean') {
                    if (val) form.getCheckBox(name).check();
                    else form.getCheckBox(name).uncheck();
                } else if (cname.includes('PDFDropdown') && typeof val === 'string') {
                    form.getDropdown(name).select(val);
                }
            } catch (e) {
                console.warn(`Could not set field ${name}:`, e);
            }
        }

        if (flatten) {
            form.flatten();
        }

        const dest = await this.getUniqueOutputPath(outputName);
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
