/**
 * Opens a form the person chose and finds its printed text and where each line sits.
 * Runs ONLY in the browser: the file is never uploaded. A PDF's own text layer is used
 * when it has one; scans and photos are read by OCR (tesseract.js, Hindi + English) in
 * the tab. The OCR program and language data are downloaded once from a public CDN (that
 * request carries no part of the form), then cached by the browser.
 */
import type { Line, Word } from './layout';
import { readForm, type FormField } from './pdf';

export const MAX_FILE_BYTES = 12 * 1024 * 1024;
export const MAX_PAGES = 4;
/** Pages are drawn about this wide: sharp enough to read and print, small enough for phones. */
const PAGE_WIDTH_PX = 1600;
const MAX_IMAGE_SIDE = 2400;
/** Fewer characters than this on a page means it is a scan with no usable text layer. */
const MIN_TEXT_CHARS = 30;

export interface FormPage {
    canvas: HTMLCanvasElement;
    width: number;
    height: number;
    lines: Line[];
}

export interface LoadedForm {
    name: string;
    kind: 'fillable-pdf' | 'pages';
    /** The original PDF, kept in memory only for fillable PDFs. */
    pdfBytes?: ArrayBuffer;
    fields: FormField[];
    pages: FormPage[];
    /** All printed text, in reading order. */
    text: string;
    usedOcr: boolean;
}

export type Progress = (message: string, fraction?: number) => void;

export class UnreadableFormError extends Error {}

function newCanvas(w: number, h: number): HTMLCanvasElement {
    const c = document.createElement('canvas');
    c.width = Math.round(w);
    c.height = Math.round(h);
    return c;
}

/** Groups loose text pieces into lines, top to bottom, left to right. */
export function groupIntoLines(words: Word[], page: number): Line[] {
    const sorted = [...words].sort((a, b) => a.y - b.y || a.x - b.x);
    const rows: Word[][] = [];
    for (const w of sorted) {
        const row = rows.find((r) => Math.abs(r[0].y + r[0].h / 2 - (w.y + w.h / 2)) < Math.max(r[0].h, w.h) * 0.5);
        if (row) row.push(w); else rows.push([w]);
    }
    return rows
        .map((row) => {
            const ws = row.sort((a, b) => a.x - b.x);
            const x = Math.min(...ws.map((w) => w.x));
            const y = Math.min(...ws.map((w) => w.y));
            const right = Math.max(...ws.map((w) => w.x + w.w));
            const bottom = Math.max(...ws.map((w) => w.y + w.h));
            return { text: ws.map((w) => w.text).join(' '), x, y, w: right - x, h: bottom - y, words: ws, page };
        })
        .sort((a, b) => a.y - b.y);
}

export async function loadPdfjs() {
    const pdfjs = await import('pdfjs-dist/legacy/build/pdf.mjs');
    pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/legacy/build/pdf.worker.min.mjs', import.meta.url).toString();
    return pdfjs;
}

type OcrWorker = Awaited<ReturnType<(typeof import('tesseract.js'))['createWorker']>>;

async function ocrCanvas(worker: OcrWorker, canvas: HTMLCanvasElement, page: number): Promise<Line[]> {
    const { data } = await worker.recognize(canvas, {}, { blocks: true });
    const lines: Line[] = [];
    for (const block of data.blocks ?? []) {
        for (const para of block.paragraphs) {
            for (const l of para.lines) {
                const words: Word[] = l.words
                    .filter((w) => w.text.trim())
                    .map((w) => ({ text: w.text.trim(), x: w.bbox.x0, y: w.bbox.y0, w: w.bbox.x1 - w.bbox.x0, h: w.bbox.y1 - w.bbox.y0 }));
                if (words.length === 0) continue;
                const x = l.bbox.x0;
                const y = l.bbox.y0;
                lines.push({ text: words.map((w) => w.text).join(' '), x, y, w: l.bbox.x1 - x, h: l.bbox.y1 - y, words, page });
            }
        }
    }
    return lines.sort((a, b) => a.y - b.y);
}

export async function loadForm(file: File, progress: Progress): Promise<LoadedForm> {
    const isPdf = file.type === 'application/pdf' || /\.pdf$/i.test(file.name);
    const isImage = /^image\/(png|jpe?g|webp)$/.test(file.type) || /\.(png|jpe?g|webp)$/i.test(file.name);
    if (!isPdf && !isImage) throw new UnreadableFormError('Please choose a PDF, or a JPG or PNG photo of the form.');
    if (file.size > MAX_FILE_BYTES) throw new UnreadableFormError('That file is larger than 12 MB.');

    const bytes = await file.arrayBuffer();
    const pages: FormPage[] = [];
    let fields: FormField[] = [];
    let kind: LoadedForm['kind'] = 'pages';
    let usedOcr = false;
    let worker: OcrWorker | null = null;

    const needOcr = async (): Promise<OcrWorker> => {
        if (worker) return worker;
        progress('Getting the text reader ready (first time only)...', 0.05);
        const { createWorker } = await import('tesseract.js');
        worker = await createWorker(['hin', 'eng'], 1, {
            logger: (m: { status: string; progress: number }) => {
                if (m.status === 'recognizing text') progress('Reading the form...', m.progress);
            },
        });
        return worker;
    };

    try {
        if (isPdf) {
            try {
                const info = await readForm(bytes.slice(0));
                if (info.fields.some((f) => f.kind !== 'other')) { fields = info.fields; kind = 'fillable-pdf'; }
            } catch { /* not readable by pdf-lib: pdf.js below decides */ }

            const pdfjs = await loadPdfjs();
            let doc;
            try {
                doc = await pdfjs.getDocument({ data: new Uint8Array(bytes.slice(0)) }).promise;
            } catch {
                throw new UnreadableFormError('This PDF could not be opened (it may be damaged or password protected).');
            }
            const count = Math.min(doc.numPages, MAX_PAGES);
            for (let n = 1; n <= count; n++) {
                progress(`Opening page ${n} of ${count}...`, n / (count + 1));
                const p = await doc.getPage(n);
                const base = p.getViewport({ scale: 1 });
                const scale = PAGE_WIDTH_PX / base.width;
                const viewport = p.getViewport({ scale });
                const canvas = newCanvas(viewport.width, viewport.height);
                await p.render({ canvas, viewport }).promise;

                const content = await p.getTextContent();
                const words: Word[] = [];
                for (const item of content.items) {
                    if (!('str' in item) || !item.str.trim()) continue;
                    const [x, yBase] = viewport.convertToViewportPoint(item.transform[4], item.transform[5]);
                    const h = Math.max(8, Math.abs(item.height || item.transform[3]) * scale);
                    const w = Math.abs(item.width) * scale;
                    // Split into words, sharing the width by character count.
                    const total = item.str.length || 1;
                    let at = 0;
                    for (const part of item.str.split(/(\s+)/)) {
                        if (part.trim()) words.push({ text: part, x: x + (at / total) * w, y: yBase - h, w: (part.length / total) * w, h });
                        at += part.length;
                    }
                }
                let lines = groupIntoLines(words, n - 1);
                if (lines.map((l) => l.text).join('').length < MIN_TEXT_CHARS) {
                    usedOcr = true;
                    lines = await ocrCanvas(await needOcr(), canvas, n - 1);
                }
                pages.push({ canvas, width: canvas.width, height: canvas.height, lines });
            }
        } else {
            let bitmap: ImageBitmap;
            try {
                bitmap = await createImageBitmap(new Blob([bytes], { type: file.type || 'image/jpeg' }), { imageOrientation: 'from-image' });
            } catch {
                throw new UnreadableFormError('This picture could not be opened.');
            }
            const scale = Math.min(1, MAX_IMAGE_SIDE / Math.max(bitmap.width, bitmap.height));
            const canvas = newCanvas(bitmap.width * scale, bitmap.height * scale);
            canvas.getContext('2d')!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
            bitmap.close();
            usedOcr = true;
            const lines = await ocrCanvas(await needOcr(), canvas, 0);
            pages.push({ canvas, width: canvas.width, height: canvas.height, lines });
        }
    } finally {
        const w = worker as OcrWorker | null;
        if (w) void w.terminate();
    }

    let text = pages.map((p) => p.lines.map((l) => l.text).join('\n')).join('\n\n');
    // A fillable form with little printed text: its field names say what it asks.
    if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS && fields.length > 0) {
        text = `Fields of the form:\n${fields.map((f) => f.name).join('\n')}`;
    }
    if (text.replace(/\s/g, '').length < MIN_TEXT_CHARS) {
        throw new UnreadableFormError('No readable text was found. Try a straighter, brighter photo, or the PDF from the official site.');
    }
    return { name: file.name, kind, pdfBytes: kind === 'fillable-pdf' ? bytes : undefined, fields, pages, text, usedOcr };
}
