'use client';

/**
 * Upload a form (PDF or photo) -> InBridge explains what it asks -> the person types their
 * details -> a preview they can adjust -> download as PDF or picture.
 *
 * PRIVACY: the file and the person's details stay in this tab. The only request is
 * POST /api/forms/explain with the printed text of the BLANK form (identity and phone numbers
 * masked), after the person presses "Explain this form". Their own details are never sent.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { LanguageSelect, useLanguagePreference } from '@/components/chat/LanguageSelect';
import { canvasesToPdf, canvasToBlob, drawChips, INK, renderPdfPages, saveBlob, type Chip } from '@/lib/forms/export';
import { prepareFormText, type Explanation, type ExplainItem } from '@/lib/forms/explain';
import { loadForm, UnreadableFormError, type LoadedForm } from '@/lib/forms/read';
import { fillForm, type FormField } from '@/lib/forms/pdf';
import { matchFieldsToItems, planOverlay, valueFor } from '@/lib/forms/plan';
import {
    matchField, PROFILE_LABELS, SENSITIVE_KEYS, usableProfile, withDerived,
    type Profile, type ProfileKey,
} from '@/lib/forms/profile';

const input = 'w-full h-11 px-3 rounded-lg border border-line bg-bg text-base text-fg placeholder:text-muted';
const button = 'inline-flex items-center justify-center min-h-11 rounded-full px-5 text-base font-medium transition-[filter] hover:brightness-110 disabled:opacity-60';
const primary = `${button} bg-accent text-accent-fg`;
const secondary = `${button} border border-line text-fg`;

const SELECTS: Partial<Record<ProfileKey, string[]>> = {
    gender: ['', 'Male', 'Female', 'Other'],
    category: ['', 'General', 'OBC', 'SC', 'ST'],
    marital_status: ['', 'Married', 'Unmarried', 'Widowed'],
};

const BY_HAND: Record<string, string> = {
    signature: 'You sign this yourself',
    attachment: 'You attach this yourself',
    office: 'Office use only: leave blank',
};

type Phase = 'idle' | 'reading' | 'read' | 'explaining' | 'explained' | 'filled';

export function FormFiller() {
    const [language, setLanguage] = useLanguagePreference();
    const [phase, setPhase] = useState<Phase>('idle');
    const [form, setForm] = useState<LoadedForm | null>(null);
    const [progress, setProgress] = useState<{ message: string; fraction?: number } | null>(null);
    const [explanation, setExplanation] = useState<Explanation | null>(null);
    const [profile, setProfile] = useState<Profile>({});
    const [allowed, setAllowed] = useState<Set<ProfileKey>>(new Set());
    const [custom, setCustom] = useState<Record<number, string>>({});
    const [chips, setChips] = useState<Chip[]>([]);
    const [fillable, setFillable] = useState<{ bytes: Uint8Array; values: Record<string, string>; skipped: string[]; edits: Record<string, string> } | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);

    const reset = useCallback(() => {
        setPhase('idle'); setForm(null); setProgress(null); setExplanation(null); setProfile({});
        setAllowed(new Set()); setCustom({}); setChips([]); setFillable(null); setError(''); setBusy(false);
    }, []);

    async function onFile(file: File | undefined) {
        if (!file) return;
        reset();
        setPhase('reading');
        try {
            const loaded = await loadForm(file, (message, fraction) => setProgress({ message, fraction }));
            setForm(loaded);
            setPhase('read');
        } catch (e) {
            setPhase('idle');
            setError(e instanceof UnreadableFormError ? e.message : 'Could not read this file. Please try another one.');
        } finally {
            setProgress(null);
        }
    }

    async function explain() {
        if (!form) return;
        setError(''); setPhase('explaining'); setChips([]); setFillable(null);
        try {
            const res = await fetch('/api/forms/explain', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                cache: 'no-store',
                body: JSON.stringify({
                    text: prepareFormText(form.text),
                    language,
                    fieldLabels: form.fields.map((f) => f.name).slice(0, 60),
                }),
            });
            if (!res.ok) {
                setError(res.status === 429 ? 'Too many requests. Please wait a minute and try again.'
                    : res.status === 503 ? 'The explaining service is busy. Please try again in a moment.'
                    : 'Could not explain this form. It may not be a form, or the text was unclear. Try again, or use a clearer file.');
                setPhase('read');
                return;
            }
            const data = (await res.json()) as { explanation: Explanation };
            setExplanation(data.explanation);
            setPhase('explained');
        } catch {
            setError('Could not reach InBridge. Check your connection and try again.');
            setPhase('read');
        }
    }

    const items = useMemo<ExplainItem[]>(() => explanation?.items ?? [], [explanation]);

    // The shared details this form asks for, and the extra ones that are specific to it.
    const sharedKeys = useMemo(() => {
        const seen = new Map<ProfileKey, number>();
        items.forEach((it, i) => { if (it.key && (it.kind === 'text' || it.kind === 'choice') && !seen.has(it.key)) seen.set(it.key, i); });
        return seen;
    }, [items]);
    const customItems = useMemo(
        () => items.map((it, i) => ({ it, i })).filter(({ it }) => !it.key && (it.kind === 'text' || it.kind === 'choice')),
        [items],
    );

    async function fill() {
        if (!form) return;
        setBusy(true); setError('');
        try {
            const prepared = withDerived(usableProfile(profile, allowed));
            if (form.kind === 'fillable-pdf' && form.pdfBytes) {
                const { bytes, values, skipped } = await fillPdf(form, items, prepared, custom, {});
                setFillable({ bytes, values, skipped, edits: {} });
            } else {
                setChips(planOverlay(items, prepared, custom, form.pages));
            }
            setPhase('filled');
        } catch {
            setError('Could not fill this form.');
        } finally {
            setBusy(false);
        }
    }

    async function applyFieldEdits(edits: Record<string, string>) {
        if (!form?.pdfBytes) return;
        setBusy(true);
        try {
            const prepared = withDerived(usableProfile(profile, allowed));
            const { bytes, values, skipped } = await fillPdf(form, items, prepared, custom, edits);
            setFillable({ bytes, values, skipped, edits });
        } finally {
            setBusy(false);
        }
    }

    const baseName = form ? form.name.replace(/\.[^.]+$/, '') : 'form';

    async function downloadPdf() {
        if (!form) return;
        if (fillable) { saveBlob(new Blob([fillable.bytes as BlobPart], { type: 'application/pdf' }), `${baseName}-filled.pdf`); return; }
        const pdf = await canvasesToPdf(form.pages.map((p, i) => drawChips(p, chips, i)));
        saveBlob(new Blob([pdf as BlobPart], { type: 'application/pdf' }), `${baseName}-filled.pdf`);
    }

    async function downloadPictures() {
        if (!form) return;
        const canvases = fillable ? await renderPdfPages(fillable.bytes) : form.pages.map((p, i) => drawChips(p, chips, i));
        for (let i = 0; i < canvases.length; i++) {
            saveBlob(await canvasToBlob(canvases[i]), `${baseName}-filled${canvases.length > 1 ? `-page${i + 1}` : ''}.png`);
        }
    }

    return (
        <div className="mt-10 space-y-10">
            <section aria-labelledby="up-h">
                <h2 id="up-h" className="text-xl font-medium">1. Choose your form</h2>
                <p className="mt-2 text-muted">A PDF, or a clear straight photo (JPG or PNG) of the form. English or Hindi. Max 12 MB. Use a blank form.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className={`${primary} cursor-pointer`}>
                        {form ? 'Choose a different form' : 'Choose form'}
                        <input type="file" accept="application/pdf,.pdf,image/png,image/jpeg,image/webp" className="sr-only"
                            disabled={phase === 'reading'} onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {form && <span className="text-sm text-muted" data-testid="file-name">{form.name} · {form.pages.length} page{form.pages.length === 1 ? '' : 's'}</span>}
                    {form && <button type="button" onClick={reset} className={secondary}>Clear everything</button>}
                </div>
                {phase === 'reading' && progress && (
                    <div className="mt-4" role="status">
                        <p className="text-sm text-muted">{progress.message}</p>
                        <div className="mt-2 h-1.5 w-full max-w-sm overflow-hidden rounded-full bg-surface-2">
                            <div className="h-full bg-accent transition-[width]" style={{ width: `${Math.round((progress.fraction ?? 0.1) * 100)}%` }} />
                        </div>
                    </div>
                )}
                {error && <p role="alert" className="mt-3 text-base text-danger">{error}</p>}
            </section>

            {form && phase !== 'idle' && phase !== 'reading' && (
                <section aria-labelledby="ex-h">
                    <h2 id="ex-h" className="text-xl font-medium">2. What this form asks</h2>
                    {!explanation ? (
                        <>
                            <p className="mt-2 text-muted">
                                InBridge will explain each part of the form in simple words. To do that, the <strong>printed text of the blank form</strong>{' '}
                                (with Aadhaar, PAN and phone numbers hidden) is sent to an AI. Your own details are never sent. If this form already
                                has your details written on it, choose a blank one instead.
                            </p>
                            {form.usedOcr && <p className="mt-2 text-sm text-muted">This looks like a scan or photo, so the text was read in your browser. Mistakes are possible; the AI is told so.</p>}
                            <div className="mt-4 flex flex-wrap items-center gap-3">
                                <LanguageSelect value={language} onChange={setLanguage} />
                                <button type="button" onClick={() => void explain()} disabled={phase === 'explaining'} className={primary}>
                                    {phase === 'explaining' ? 'Reading the form...' : 'Explain this form'}
                                </button>
                            </div>
                        </>
                    ) : (
                        <Explained explanation={explanation} language={language} onLanguage={setLanguage} onAgain={() => { setExplanation(null); setPhase('read'); setChips([]); setFillable(null); }} />
                    )}
                </section>
            )}

            {explanation && (phase === 'explained' || phase === 'filled') && (
                <section aria-labelledby="det-h">
                    <h2 id="det-h" className="text-xl font-medium">3. Your details</h2>
                    <p className="mt-2 text-muted">Only what this form asks for. Typed here and used only in this tab; refreshing the page forgets them.</p>
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {[...sharedKeys].filter(([k]) => !SENSITIVE_KEYS.has(k)).map(([key, i]) => (
                            <label key={key} className={`block ${key === 'address' ? 'sm:col-span-2' : ''}`}>
                                <span className="text-sm text-fg">{PROFILE_LABELS[key]}</span>
                                {items[i].meaning && <span className="block text-xs text-muted">{items[i].meaning}</span>}
                                {SELECTS[key] ? (
                                    <select className={input} value={profile[key] ?? ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}>
                                        {SELECTS[key]!.map((o) => <option key={o} value={o}>{o || 'Select'}</option>)}
                                    </select>
                                ) : (
                                    <input className={input} type={key === 'dob' ? 'date' : 'text'} autoComplete="off"
                                        value={profile[key] ?? ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
                                )}
                            </label>
                        ))}
                        {customItems.map(({ it, i }) => (
                            <label key={i} className="block">
                                <span className="text-sm text-fg">{it.label}</span>
                                {it.meaning && <span className="block text-xs text-muted">{it.meaning}</span>}
                                <input className={input} autoComplete="off" value={custom[i] ?? ''} onChange={(e) => setCustom({ ...custom, [i]: e.target.value })} />
                            </label>
                        ))}
                    </div>
                    {[...sharedKeys.keys()].some((k) => SENSITIVE_KEYS.has(k)) && (
                        <div className="mt-6 rounded-lg bg-surface p-4">
                            <p className="font-medium">This form also asks for identity or contact numbers</p>
                            <p className="mt-1 text-sm text-muted">We recommend writing these by hand on the printed form. If you do want them filled in, switch each one on. They stay in this tab like everything else.</p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {[...sharedKeys.keys()].filter((k) => SENSITIVE_KEYS.has(k)).map((key) => (
                                    <div key={key}>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input type="checkbox" checked={allowed.has(key)} onChange={(e) => {
                                                const next = new Set(allowed);
                                                if (e.target.checked) next.add(key); else next.delete(key);
                                                setAllowed(next);
                                            }} />
                                            Fill in {PROFILE_LABELS[key]}
                                        </label>
                                        {allowed.has(key) && (
                                            <input className={`${input} mt-1`} autoComplete="off" aria-label={PROFILE_LABELS[key]}
                                                value={profile[key] ?? ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })} />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                    <button type="button" onClick={() => void fill()} disabled={busy} className={`${primary} mt-6`}>
                        {busy ? 'Working...' : 'Fill the form'}
                    </button>
                </section>
            )}

            {form && phase === 'filled' && (
                <section aria-labelledby="rev-h">
                    <h2 id="rev-h" className="text-xl font-medium">4. Check and download</h2>
                    <p className="mt-2 text-muted">
                        Read every line against your documents: a wrong entry can get an application rejected. Signatures, photographs and
                        declarations are left for you. InBridge does not submit forms.
                    </p>
                    {fillable ? (
                        <FieldTable fields={form.fields} fillable={fillable} busy={busy} onApply={(edits) => void applyFieldEdits(edits)} />
                    ) : (
                        <Preview form={form} chips={chips} setChips={setChips} />
                    )}
                    <div className="mt-6 flex flex-wrap gap-3">
                        <button type="button" onClick={() => void downloadPdf()} className={primary}>Download PDF</button>
                        <button type="button" onClick={() => void downloadPictures()} className={secondary}>Download as picture (PNG)</button>
                    </div>
                    <p className="mt-2 text-sm text-muted">Open the downloaded file in any viewer or photo app to print it.</p>
                </section>
            )}
        </div>
    );
}

/** Fills a fillable PDF: PDF field name -> detail by rule or by the explained item it belongs to. */
async function fillPdf(form: LoadedForm, items: ExplainItem[], profile: Profile, custom: Record<number, string>, edits: Record<string, string>) {
    const fieldItem = matchFieldsToItems(form.fields.map((f) => f.name), items);
    const assignment: Record<string, ProfileKey | null> = {};
    const own: Record<string, string> = { ...edits };
    for (const f of form.fields as FormField[]) {
        if (f.kind === 'checkbox' || f.kind === 'other') { assignment[f.name] = null; continue; }
        const idx = fieldItem.get(f.name);
        const item = idx !== undefined ? items[idx] : undefined;
        assignment[f.name] = matchField(f.name) ?? item?.key ?? null;
        if (!assignment[f.name] && idx !== undefined && !(f.name in own)) {
            const v = valueFor(item!, idx, profile, custom);
            if (v) own[f.name] = v;
        }
    }
    const out = await fillForm(form.pdfBytes!, assignment, profile, own);
    return { bytes: out.bytes, values: out.filled, skipped: out.skipped };
}

function Explained({ explanation, language, onLanguage, onAgain }: {
    explanation: Explanation; language: Parameters<typeof LanguageSelect>[0]['value']; onLanguage: Parameters<typeof LanguageSelect>[0]['onChange']; onAgain: () => void;
}) {
    return (
        <div className="mt-3" data-testid="explanation">
            {explanation.title && <p className="text-lg font-medium">{explanation.title}</p>}
            {explanation.purpose && <p className="mt-1 text-muted">{explanation.purpose}</p>}
            <ol className="mt-4 space-y-3">
                {explanation.items.map((it, i) => (
                    <li key={i} className="rounded-lg border border-line p-3">
                        <p className="font-medium">{i + 1}. {it.label}</p>
                        {it.meaning && <p className="mt-0.5 text-sm text-muted">{it.meaning}</p>}
                        {BY_HAND[it.kind] && <p className="mt-1 text-xs text-muted">{BY_HAND[it.kind]}</p>}
                    </li>
                ))}
            </ol>
            {explanation.documents.length > 0 && (
                <div className="mt-5">
                    <p className="font-medium">Documents to keep ready</p>
                    <ul className="mt-1 list-disc pl-5 text-muted">{explanation.documents.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
            )}
            {explanation.notes.length > 0 && (
                <div className="mt-5 rounded-lg bg-surface p-4">
                    <p className="font-medium">Good to know</p>
                    <ul className="mt-1 list-disc pl-5 text-muted">{explanation.notes.map((d, i) => <li key={i}>{d}</li>)}</ul>
                </div>
            )}
            <div className="mt-4 flex flex-wrap items-center gap-3">
                <LanguageSelect value={language} onChange={onLanguage} />
                <button type="button" onClick={onAgain} className={secondary}>Explain again in this language</button>
            </div>
            <p className="mt-2 text-xs text-muted">AI can make mistakes. Check the form itself and the official website.</p>
        </div>
    );
}

function FieldTable({ fields, fillable, busy, onApply }: {
    fields: FormField[]; fillable: { values: Record<string, string>; skipped: string[]; edits: Record<string, string> }; busy: boolean; onApply: (edits: Record<string, string>) => void;
}) {
    const [edits, setEdits] = useState<Record<string, string>>(fillable.edits);
    return (
        <div className="mt-4">
            {fillable.skipped.length > 0 && (
                <p role="status" className="mb-3 text-sm text-muted">
                    This PDF&apos;s own font cannot show some characters (for example Hindi letters), so these were left empty: {fillable.skipped.join(', ')}. Write them by hand, or choose the picture version of the form.
                </p>
            )}
            <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface"><tr><th className="p-2 font-medium">Field on the form</th><th className="p-2 font-medium">Filled with (edit if wrong)</th></tr></thead>
                    <tbody>
                        {fields.filter((f) => f.kind !== 'checkbox' && f.kind !== 'other').map((f) => (
                            <tr key={f.name} className="border-t border-line">
                                <td className="p-2 align-top">{f.name}</td>
                                <td className="p-2">
                                    <input className={`${input} h-9`} aria-label={f.name} value={edits[f.name] ?? fillable.values[f.name] ?? ''}
                                        onChange={(e) => setEdits({ ...edits, [f.name]: e.target.value })} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
            <button type="button" onClick={() => onApply(edits)} disabled={busy} className={`${secondary} mt-3`}>Apply my edits</button>
        </div>
    );
}

/** The page pictures with each answer on top. Drag an answer (or use the arrow keys) to move it. */
function Preview({ form, chips, setChips }: { form: LoadedForm; chips: Chip[]; setChips: (c: Chip[]) => void }) {
    const urls = useMemo(() => form.pages.map((p) => p.canvas.toDataURL('image/jpeg', 0.85)), [form]);
    const drag = useRef<{ id: string; sx: number; sy: number; ox: number; oy: number; k: number } | null>(null);
    const move = (id: string, x: number, y: number) => setChips(chips.map((c) => (c.id === id ? { ...c, x, y, located: true } : c)));
    const unplaced = chips.filter((c) => !c.located);

    useEffect(() => { /* urls are data URLs: nothing to revoke */ }, [urls]);

    return (
        <div className="mt-4 space-y-6">
            {unplaced.length > 0 && (
                <p role="status" className="text-sm text-muted">
                    Could not find where {unplaced.map((c) => `"${c.label}"`).join(', ')} {unplaced.length === 1 ? 'goes' : 'go'} (outlined in red, top left). Drag {unplaced.length === 1 ? 'it' : 'them'} into place.
                </p>
            )}
            <p className="text-sm text-muted">Drag any answer to move it, or select it and use the arrow keys. Edit the words in the list below.</p>
            {form.pages.map((page, pi) => (
                <div key={pi} className="relative w-full select-none overflow-hidden rounded-lg border border-line bg-white" style={{ containerType: 'inline-size' }} data-testid={`page-${pi}`}>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={urls[pi]} alt={`Page ${pi + 1} of the form`} className="block h-auto w-full" draggable={false} />
                    {chips.filter((c) => c.page === pi).map((c) => (
                        <div
                            key={c.id}
                            role="button"
                            tabIndex={0}
                            aria-label={`${c.label}: ${c.text}. Drag or use arrow keys to move.`}
                            data-testid="chip"
                            className="absolute cursor-grab touch-none whitespace-nowrap px-0.5 active:cursor-grabbing"
                            style={c.circle ? {
                                // A ring around the chosen printed option.
                                left: `${((c.x - c.size * 0.35) / page.width) * 100}%`,
                                top: `${((c.y - c.circle.h * 1.1) / page.height) * 100}%`,
                                width: `${((c.circle.w + c.size * 0.7) / page.width) * 100}%`,
                                height: `${((c.circle.h * 1.5) / page.height) * 100}%`,
                                border: `${Math.max(2, c.size * 0.1) / page.width * 100}cqw solid ${INK}`,
                                borderRadius: '50%',
                            } : {
                                left: `${(c.x / page.width) * 100}%`,
                                top: `${((c.y - c.size * 0.82) / page.height) * 100}%`,
                                fontSize: `${(c.size / page.width) * 100}cqw`,
                                lineHeight: 1,
                                color: INK,
                                background: 'rgba(255, 244, 150, 0.45)',
                                outline: `1px dashed ${c.located ? 'rgba(11,42,111,0.5)' : '#dc2626'}`,
                            }}
                            onPointerDown={(e) => {
                                const box = e.currentTarget.parentElement!.getBoundingClientRect();
                                e.currentTarget.setPointerCapture(e.pointerId);
                                drag.current = { id: c.id, sx: e.clientX, sy: e.clientY, ox: c.x, oy: c.y, k: page.width / box.width };
                            }}
                            onPointerMove={(e) => {
                                const d = drag.current;
                                if (d && d.id === c.id) move(c.id, d.ox + (e.clientX - d.sx) * d.k, d.oy + (e.clientY - d.sy) * d.k);
                            }}
                            onPointerUp={() => { drag.current = null; }}
                            onKeyDown={(e) => {
                                const step = e.shiftKey ? 20 : 4;
                                const dx = e.key === 'ArrowRight' ? step : e.key === 'ArrowLeft' ? -step : 0;
                                const dy = e.key === 'ArrowDown' ? step : e.key === 'ArrowUp' ? -step : 0;
                                if (dx || dy) { e.preventDefault(); move(c.id, c.x + dx, c.y + dy); }
                            }}
                        >
                            {c.circle ? null : c.text}
                        </div>
                    ))}
                </div>
            ))}
            <div className="overflow-x-auto rounded-lg border border-line">
                <table className="w-full text-left text-sm">
                    <thead className="bg-surface"><tr><th className="p-2 font-medium">Part of the form</th><th className="p-2 font-medium">Written as (edit if wrong)</th></tr></thead>
                    <tbody>
                        {chips.map((c) => (
                            <tr key={c.id} className="border-t border-line">
                                <td className="p-2 align-top">{c.label}</td>
                                <td className="p-2">
                                    <input className={`${input} h-9`} aria-label={c.label} value={c.text} disabled={!!c.circle}
                                        onChange={(e) => setChips(chips.map((x) => (x.id === c.id ? { ...x, text: e.target.value } : x)))} />
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </div>
    );
}
