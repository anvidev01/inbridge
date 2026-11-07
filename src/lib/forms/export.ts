/**
 * Draws the person's answers onto the page pictures and produces the files they download.
 * Browser only; the result is never uploaded.
 */
import { PDFDocument } from 'pdf-lib';
import { loadPdfjs, type FormPage } from './read';

export interface Chip {
    id: string;
    label: string;
    text: string;
    page: number;
    /** Left edge and text baseline, in page pixels. */
    x: number;
    y: number;
    size: number;
    /** False when the label could not be found on the page: the person drags it into place. */
    located: boolean;
    /** Draw a circle around a printed option ("Male / Female") instead of text. w, h = the word's box. */
    circle?: { w: number; h: number };
}

export const INK = '#0b2a6f';
const FONT = '"Noto Sans Devanagari", "Noto Sans", "Mangal", "Nirmala UI", Arial, sans-serif';

export function drawChips(page: FormPage, chips: Chip[], index: number): HTMLCanvasElement {
    const out = document.createElement('canvas');
    out.width = page.width;
    out.height = page.height;
    const ctx = out.getContext('2d')!;
    ctx.drawImage(page.canvas, 0, 0);
    ctx.fillStyle = INK;
    ctx.textBaseline = 'alphabetic';
    for (const c of chips.filter((chip) => chip.page === index && chip.text)) {
        if (c.circle) {
            ctx.strokeStyle = INK;
            ctx.lineWidth = Math.max(2, c.size * 0.1);
            ctx.beginPath();
            ctx.ellipse(c.x + c.circle.w / 2, c.y - c.circle.h * 0.35, c.circle.w / 2 + c.size * 0.35, c.circle.h * 0.75, 0, 0, Math.PI * 2);
            ctx.stroke();
            continue;
        }
        ctx.font = `${c.size}px ${FONT}`;
        ctx.fillText(c.text, c.x, c.y);
    }
    return out;
}

export function canvasToBlob(canvas: HTMLCanvasElement, type = 'image/png', quality?: number): Promise<Blob> {
    return new Promise((resolve, reject) => canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Could not make the picture'))), type, quality));
}

/** One PDF page per picture, A4 width, the picture's own proportions. */
export async function canvasesToPdf(canvases: HTMLCanvasElement[]): Promise<Uint8Array> {
    const doc = await PDFDocument.create();
    for (const canvas of canvases) {
        const jpg = await doc.embedJpg(await (await canvasToBlob(canvas, 'image/jpeg', 0.92)).arrayBuffer());
        const width = 595.28;
        const page = doc.addPage([width, (width * canvas.height) / canvas.width]);
        page.drawImage(jpg, { x: 0, y: 0, width, height: page.getHeight() });
    }
    return doc.save();
}

/** Pictures of a PDF's pages, with form fields drawn in (used for the picture of a filled fillable PDF). */
export async function renderPdfPages(bytes: Uint8Array, maxPages = 4): Promise<HTMLCanvasElement[]> {
    const pdfjs = await loadPdfjs();
    const doc = await pdfjs.getDocument({ data: bytes.slice() }).promise;
    const out: HTMLCanvasElement[] = [];
    for (let n = 1; n <= Math.min(doc.numPages, maxPages); n++) {
        const p = await doc.getPage(n);
        const viewport = p.getViewport({ scale: 1600 / p.getViewport({ scale: 1 }).width });
        const canvas = document.createElement('canvas');
        canvas.width = Math.round(viewport.width);
        canvas.height = Math.round(viewport.height);
        await p.render({ canvas, viewport, annotationMode: pdfjs.AnnotationMode.ENABLE_FORMS }).promise;
        out.push(canvas);
    }
    return out;
}

export function saveBlob(blob: Blob, filename: string): void {
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 10_000);
}
