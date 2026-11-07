'use client';

/**
 * Upload a fillable PDF, enter details, review, download. Everything happens in
 * this tab: the file and the details are never sent to a server. The ONLY network
 * call is POST /api/forms/map with field LABELS of the blank form (never values),
 * and only for labels the built-in rules could not place.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { autoAssign, fillForm, MAX_PDF_BYTES, NotFillableError, readForm, type FormField } from '@/lib/forms/pdf';
import {
    PROFILE_KEYS, PROFILE_LABELS, SENSITIVE_KEYS, usableProfile, withDerived,
    type Profile, type ProfileKey,
} from '@/lib/forms/profile';

const input = 'w-full h-11 px-3 rounded-lg border border-line bg-bg text-base text-fg placeholder:text-muted';
const button = 'inline-flex items-center justify-center min-h-11 rounded-full px-5 text-base font-medium transition-[filter] hover:brightness-110';
const primary = `${button} bg-accent text-accent-fg`;
const secondary = `${button} border border-line text-fg`;

/** Short list shown by default; the rest appear only when the uploaded form asks for them. */
const ALWAYS: ProfileKey[] = ['full_name', 'father_name', 'dob', 'gender', 'address', 'district', 'state', 'pincode'];
const SELECTS: Partial<Record<ProfileKey, string[]>> = {
    gender: ['', 'Male', 'Female', 'Other'],
    category: ['', 'General', 'OBC', 'SC', 'ST'],
    marital_status: ['', 'Married', 'Unmarried', 'Widowed'],
};

export function FormFiller() {
    const [file, setFile] = useState<{ name: string; bytes: ArrayBuffer } | null>(null);
    const [fields, setFields] = useState<FormField[]>([]);
    const [assignment, setAssignment] = useState<Record<string, ProfileKey | null>>({});
    const [profile, setProfile] = useState<Profile>({});
    const [allowed, setAllowed] = useState<Set<ProfileKey>>(new Set());
    const [edits, setEdits] = useState<Record<string, string>>({});
    const [result, setResult] = useState<{ url: string; filled: Record<string, string> } | null>(null);
    const [error, setError] = useState('');
    const [busy, setBusy] = useState(false);
    const [aiNote, setAiNote] = useState('');
    const urlRef = useRef<string | null>(null);

    // Release the filled file from memory when it is replaced or the tab closes.
    useEffect(() => () => { if (urlRef.current) URL.revokeObjectURL(urlRef.current); }, []);

    const reset = useCallback(() => {
        if (urlRef.current) URL.revokeObjectURL(urlRef.current);
        urlRef.current = null;
        setFile(null); setFields([]); setAssignment({}); setProfile({}); setAllowed(new Set());
        setEdits({}); setResult(null); setError(''); setAiNote('');
    }, []);

    async function onFile(f: File | undefined) {
        if (!f) return;
        reset();
        if (f.size > MAX_PDF_BYTES) { setError('That file is larger than 10 MB.'); return; }
        if (!/\.pdf$/i.test(f.name) && f.type !== 'application/pdf') { setError('Please choose a PDF file.'); return; }
        setBusy(true);
        try {
            const bytes = await f.arrayBuffer();
            const { fields: found } = await readForm(bytes);
            if (found.length === 0) {
                setError('This PDF has no fillable fields (it looks like a scanned or printed form). Support for scanned forms is coming; for now you can print it and fill it by hand.');
                return;
            }
            const { assignment: auto, unmatched } = autoAssign(found);
            setFile({ name: f.name, bytes });
            setFields(found);
            setAssignment(auto);
            if (unmatched.length > 0) void askAi(unmatched, auto);
        } catch (e) {
            setError(e instanceof NotFillableError ? e.message : 'Could not read this file.');
        } finally {
            setBusy(false);
        }
    }

    /** Sends only the labels of fields the rules could not place. Never any values. */
    async function askAi(labels: string[], base: Record<string, ProfileKey | null>) {
        try {
            const res = await fetch('/api/forms/map', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ labels: labels.slice(0, 60) }),
                cache: 'no-store',
            });
            if (!res.ok) return;
            const data = (await res.json()) as { mapping?: Record<string, ProfileKey | null>; ai?: boolean };
            if (!data.mapping) return;
            const merged = { ...base };
            let n = 0;
            for (const [label, key] of Object.entries(data.mapping)) if (key && PROFILE_KEYS.includes(key)) { merged[label] = key; n += 1; }
            setAssignment((prev) => ({ ...prev, ...Object.fromEntries(Object.entries(merged).filter(([k]) => labels.includes(k))) }));
            if (n > 0) setAiNote(`${n} more field${n === 1 ? '' : 's'} were matched with AI from the field names only. Please check them below.`);
        } catch { /* matching by rules still works */ }
    }

    // Which details to ask for: the usual ones plus whatever the form needs.
    const needed = useMemo(() => {
        const keys = new Set<ProfileKey>(ALWAYS);
        for (const key of Object.values(assignment)) if (key) keys.add(key);
        return PROFILE_KEYS.filter((k) => keys.has(k) && !['first_name', 'middle_name', 'last_name', 'age'].includes(k));
    }, [assignment]);

    async function onFill() {
        if (!file) return;
        setBusy(true); setError('');
        try {
            const prepared = withDerived(usableProfile(profile, allowed));
            const out = await fillForm(file.bytes, assignment, prepared, edits);
            if (urlRef.current) URL.revokeObjectURL(urlRef.current);
            const url = URL.createObjectURL(new Blob([out.bytes as BlobPart], { type: 'application/pdf' }));
            urlRef.current = url;
            setResult({ url, filled: out.filled });
        } catch {
            setError('Could not fill this form.');
        } finally {
            setBusy(false);
        }
    }

    const outName = file ? file.name.replace(/\.pdf$/i, '') + '-filled.pdf' : 'form-filled.pdf';

    return (
        <div className="mt-10 space-y-8">
            <section aria-labelledby="up-h">
                <h2 id="up-h" className="text-xl font-medium">1. Choose your form</h2>
                <p className="mt-2 text-muted">A fillable PDF from an official site (.gov.in or .nic.in). Max 10 MB.</p>
                <div className="mt-4 flex flex-wrap items-center gap-3">
                    <label className={`${primary} cursor-pointer`}>
                        {file ? 'Choose a different PDF' : 'Choose PDF'}
                        <input type="file" accept="application/pdf,.pdf" className="sr-only" onChange={(e) => { void onFile(e.target.files?.[0]); e.target.value = ''; }} />
                    </label>
                    {file && <span className="text-sm text-muted" data-testid="file-name">{file.name} · {fields.length} fields found</span>}
                    {file && <button type="button" onClick={reset} className={secondary}>Clear everything</button>}
                </div>
                {error && <p role="alert" className="mt-3 text-base text-danger">{error}</p>}
            </section>

            {file && (
                <section aria-labelledby="det-h">
                    <h2 id="det-h" className="text-xl font-medium">2. Your details</h2>
                    <p className="mt-2 text-muted">Typed here and used only in this tab. Closing or refreshing the page forgets them.</p>
                    {aiNote && <p className="mt-2 text-sm text-muted">{aiNote}</p>}
                    <div className="mt-4 grid gap-4 sm:grid-cols-2">
                        {needed.filter((k) => !SENSITIVE_KEYS.has(k)).map((key) => (
                            <label key={key} className={`block ${key === 'address' ? 'sm:col-span-2' : ''}`}>
                                <span className="text-sm text-muted">{PROFILE_LABELS[key]}</span>
                                {SELECTS[key] ? (
                                    <select className={input} value={profile[key] ?? ''} onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}>
                                        {SELECTS[key]!.map((o) => <option key={o} value={o}>{o || 'Select'}</option>)}
                                    </select>
                                ) : (
                                    <input
                                        className={input}
                                        type={key === 'dob' ? 'date' : 'text'}
                                        autoComplete="off"
                                        value={profile[key] ?? ''}
                                        onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                                    />
                                )}
                            </label>
                        ))}
                    </div>

                    {needed.some((k) => SENSITIVE_KEYS.has(k)) && (
                        <div className="mt-6 rounded-lg bg-surface p-4">
                            <p className="font-medium">This form also asks for identity or contact numbers</p>
                            <p className="mt-1 text-sm text-muted">
                                We recommend writing these by hand on the printed form. If you do want them filled in, switch each one on. They stay in this tab like everything else.
                            </p>
                            <div className="mt-3 grid gap-3 sm:grid-cols-2">
                                {needed.filter((k) => SENSITIVE_KEYS.has(k)).map((key) => (
                                    <div key={key}>
                                        <label className="flex items-center gap-2 text-sm">
                                            <input
                                                type="checkbox"
                                                checked={allowed.has(key)}
                                                onChange={(e) => {
                                                    const next = new Set(allowed);
                                                    if (e.target.checked) next.add(key); else next.delete(key);
                                                    setAllowed(next);
                                                }}
                                            />
                                            Fill in {PROFILE_LABELS[key]}
                                        </label>
                                        {allowed.has(key) && (
                                            <input
                                                className={`${input} mt-1`}
                                                autoComplete="off"
                                                aria-label={PROFILE_LABELS[key]}
                                                value={profile[key] ?? ''}
                                                onChange={(e) => setProfile({ ...profile, [key]: e.target.value })}
                                            />
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    <button type="button" onClick={() => void onFill()} disabled={busy} className={`${primary} mt-6`}>
                        {busy ? 'Working...' : 'Fill the form'}
                    </button>
                </section>
            )}

            {result && (
                <section aria-labelledby="rev-h">
                    <h2 id="rev-h" className="text-xl font-medium">3. Check and download</h2>
                    <p className="mt-2 text-muted">
                        Read every line against your documents. A wrong entry can get an application rejected. Signatures,
                        photographs and declarations are left for you. InBridge does not submit forms.
                    </p>
                    <div className="mt-4 overflow-x-auto rounded-lg border border-line">
                        <table className="w-full text-left text-sm">
                            <thead className="bg-surface"><tr><th className="p-2 font-medium">Field on the form</th><th className="p-2 font-medium">Filled with (edit if wrong)</th></tr></thead>
                            <tbody>
                                {fields.filter((f) => f.kind !== 'checkbox' && f.kind !== 'other').map((f) => (
                                    <tr key={f.name} className="border-t border-line">
                                        <td className="p-2 align-top">{f.name}</td>
                                        <td className="p-2">
                                            <input
                                                className={`${input} h-9`}
                                                aria-label={f.name}
                                                value={edits[f.name] ?? result.filled[f.name] ?? ''}
                                                onChange={(e) => setEdits({ ...edits, [f.name]: e.target.value })}
                                            />
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                    <div className="mt-4 flex flex-wrap gap-3">
                        <button type="button" onClick={() => void onFill()} disabled={busy} className={secondary}>Apply my edits</button>
                        <a href={result.url} download={outName} className={primary}>Download filled PDF</a>
                        <span className="self-center text-sm text-muted">Open the downloaded file in any PDF viewer to print it.</span>
                    </div>
                </section>
            )}
        </div>
    );
}
