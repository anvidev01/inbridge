/**
 * Reads and fills a fillable PDF form entirely in the browser (pdf-lib).
 * The file and the person's details never leave the device.
 */
import { PDFCheckBox, PDFDocument, PDFDropdown, PDFOptionList, PDFRadioGroup, PDFTextField } from 'pdf-lib';
import { dateForField, matchField, pickOption, type Profile, type ProfileKey } from './profile';

export type FieldKind = 'text' | 'checkbox' | 'radio' | 'dropdown' | 'other';

export interface FormField {
    name: string;
    kind: FieldKind;
    options: string[];
    maxLength?: number;
}

export const MAX_PDF_BYTES = 10 * 1024 * 1024;

export class NotFillableError extends Error {}

export async function readForm(bytes: ArrayBuffer): Promise<{ fields: FormField[]; pages: number }> {
    let doc: PDFDocument;
    try {
        doc = await PDFDocument.load(bytes, { ignoreEncryption: false, updateMetadata: false });
    } catch {
        throw new NotFillableError('This file could not be read as a PDF (it may be password protected).');
    }
    const fields: FormField[] = doc.getForm().getFields().map((f) => {
        if (f instanceof PDFTextField) return { name: f.getName(), kind: 'text' as const, options: [], maxLength: f.getMaxLength() };
        if (f instanceof PDFCheckBox) return { name: f.getName(), kind: 'checkbox' as const, options: [] };
        if (f instanceof PDFRadioGroup) return { name: f.getName(), kind: 'radio' as const, options: f.getOptions() };
        if (f instanceof PDFDropdown || f instanceof PDFOptionList) return { name: f.getName(), kind: 'dropdown' as const, options: f.getOptions() };
        return { name: f.getName(), kind: 'other' as const, options: [] };
    });
    return { fields, pages: doc.getPageCount() };
}

export interface FillResult {
    bytes: Uint8Array;
    /** field name -> what was written (for the review table). */
    filled: Record<string, string>;
    /** Fields that had a value but could not take it (for example Hindi text in a Latin-only form font). */
    skipped: string[];
}

/** `assignment` maps a field name to a profile key; only keys present in `profile` are written. */
export async function fillForm(
    bytes: ArrayBuffer,
    assignment: Record<string, ProfileKey | null>,
    profile: Profile,
    edits: Record<string, string> = {},
): Promise<FillResult> {
    const doc = await PDFDocument.load(bytes, { updateMetadata: false });
    const form = doc.getForm();
    const filled: Record<string, string> = {};
    const skipped: string[] = [];

    for (const field of form.getFields()) {
        const name = field.getName();
        const key = assignment[name];
        let value = name in edits ? edits[name] : key ? profile[key] : undefined;
        if (!value) continue;
        try {
            if (field instanceof PDFTextField) {
                if (key === 'dob' && !(name in edits)) value = dateForField(value, field.getMaxLength());
                const max = field.getMaxLength();
                field.setText(max ? value.slice(0, max) : value);
                filled[name] = value;
            } else if (field instanceof PDFRadioGroup) {
                const option = pickOption(value, field.getOptions());
                if (option) { field.select(option); filled[name] = option; }
            } else if (field instanceof PDFDropdown || field instanceof PDFOptionList) {
                const option = pickOption(value, field.getOptions());
                if (option) { field.select(option); filled[name] = option; }
            }
            // Check boxes are never ticked automatically: declarations are the person's to make.
        } catch {
            // A field that refuses the value (e.g. Devanagari in a standard font) is left empty and reported.
            skipped.push(name);
        }
    }
    return { bytes: await doc.save(), filled, skipped };
}

/** Rule-based match of every field; the labels it could not place are returned separately. */
export function autoAssign(fields: FormField[]): { assignment: Record<string, ProfileKey | null>; unmatched: string[] } {
    const assignment: Record<string, ProfileKey | null> = {};
    const unmatched: string[] = [];
    for (const f of fields) {
        if (f.kind === 'checkbox' || f.kind === 'other') { assignment[f.name] = null; continue; }
        const key = matchField(f.name);
        assignment[f.name] = key;
        if (!key) unmatched.push(f.name);
    }
    return { assignment, unmatched };
}
