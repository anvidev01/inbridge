'use client';

/**
 * "Input half, output half": the landing page's live search. The dark field
 * holds an editable search; the light field lists the matching schemes from
 * the real dataset via GET /api/schemes (debounced). Without JavaScript the
 * field is a plain GET form to /services, and the server-rendered results
 * for the prefilled text are already on the page.
 */
import Link from 'next/link';
import { useEffect, useId, useRef, useState } from 'react';
import type { ProbeResponse } from './probe-types';
import { T, MARGIN } from './type';

const DEBOUNCE_MS = 280;
const MAX_LENGTH = 120;

type Status = 'idle' | 'loading' | 'error';

const n = (v: number) => v.toLocaleString('en-IN');

function scopeLine(r: ProbeResponse): string {
    const words = r.q ? `“${r.q}”` : 'all schemes';
    return r.state ? `${words}, Central schemes and ${r.state} schemes` : `${words}, across India`;
}

export function SchemeProbe({ initialText, initial, datasetTotal }: { initialText: string; initial: ProbeResponse; datasetTotal: number }) {
    const [text, setText] = useState(initialText);
    const [result, setResult] = useState<ProbeResponse>(initial);
    const [status, setStatus] = useState<Status>('idle');
    const [version, setVersion] = useState(0);
    const first = useRef(true);
    const inputId = useId();
    const hintId = useId();

    useEffect(() => {
        if (first.current) {
            first.current = false;
            return;
        }
        const controller = new AbortController();
        const timer = setTimeout(async () => {
            setStatus('loading');
            try {
                const params = new URLSearchParams({ q: text.slice(0, MAX_LENGTH), limit: '5' });
                const res = await fetch(`/api/schemes?${params}`, { signal: controller.signal });
                if (!res.ok) throw new Error(String(res.status));
                setResult((await res.json()) as ProbeResponse);
                setVersion((v) => v + 1);
                setStatus('idle');
            } catch (e) {
                if ((e as Error).name !== 'AbortError') setStatus('error');
            }
        }, DEBOUNCE_MS);
        return () => {
            clearTimeout(timer);
            controller.abort();
        };
    }, [text]);

    const empty = !result.q && !result.state;
    const askHref = `/chat?q=${encodeURIComponent(text.trim())}`;

    return (
        <section aria-labelledby="try-heading" className="grid md:grid-cols-2 md:grid-rows-[1fr_auto]">
            {/* The heading is first in reading order and split across the two fields. */}
            <h2 id="try-heading" className={`${T.d} order-2 grid md:col-span-2 md:row-start-2 md:grid-cols-2`}>
                <span data-theme="dark" className={`block bg-bg text-fg ${MARGIN} pb-8 md:pb-10 pt-2`}>
                    Search the
                </span>
                <span data-theme="light" className={`block bg-surface text-fg ${MARGIN} pt-8 pb-2 md:pt-2 md:pb-10`}>
                    dataset
                </span>
            </h2>

            {/* Input field: always the dark ground. */}
            <div data-theme="dark" className={`order-1 bg-bg text-fg ${MARGIN} pt-16 pb-16 md:row-start-1 md:col-start-1 md:pt-[11svh] md:pb-24 md:min-h-[70svh]`}>
                <form action="/services" method="get" role="search" aria-label="Search the scheme dataset" className="max-w-[34ch] md:ml-[8%]" data-reveal style={{ ['--reveal-i' as string]: 1 }}>
                    <label htmlFor={inputId} className={`${T.b} block text-fg`}>
                        Your search
                    </label>
                    <textarea
                        id={inputId}
                        name="q"
                        rows={3}
                        maxLength={MAX_LENGTH}
                        value={text}
                        aria-describedby={hintId}
                        onChange={(e) => setText(e.target.value)}
                        onKeyDown={(e) => {
                            // Enter opens the full list in the directory; the results update as you type anyway.
                            if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                                e.preventDefault();
                                e.currentTarget.form?.requestSubmit();
                            }
                        }}
                        spellCheck={false}
                        className={`${T.l} mt-3 block w-full resize-none rounded-xl bg-surface px-5 py-4 text-fg caret-accent outline-none transition-colors placeholder:text-muted hover:bg-surface-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent`}
                        placeholder="e.g. pension for widows in Kerala"
                    />
                    <p id={hintId} className={`${T.b} mt-3 text-muted`}>
                        Words from a scheme’s name, who it is for, or a state.
                    </p>
                    <button
                        type="submit"
                        className={`${T.b} mt-6 inline-flex min-h-11 items-center font-medium text-fg underline decoration-[0.07em] underline-offset-[0.22em] transition-colors hover:text-accent active:opacity-70`}
                    >
                        Open the full list in the directory
                    </button>
                </form>
            </div>

            {/* Output field: always the light ground. */}
            <div data-theme="light" className={`order-3 bg-surface text-fg ${MARGIN} pt-6 pb-16 md:row-start-1 md:col-start-2 md:pt-[11svh] md:pb-24`}>
                <div data-ui className="w-full max-w-[520px] rounded-xl border border-line bg-surface p-5 sm:p-6 md:ml-[8%]" data-reveal style={{ ['--reveal-i' as string]: 2 }}>
                    <div className="flex items-baseline justify-between gap-4">
                        <p role="status" aria-live="polite" className="text-[15px] font-semibold text-fg tabular-nums">
                            {status === 'error'
                                ? 'Search is unavailable right now'
                                : empty
                                  ? `Type to search ${n(datasetTotal)} schemes`
                                  : result.queryTooGeneral
                                    ? 'Add a more specific word'
                                    : `${n(result.total)} ${result.total === 1 ? 'scheme matches' : 'schemes match'}`}
                        </p>
                        <span aria-hidden="true" className={`lp-dots flex gap-1 transition-opacity ${status === 'loading' ? 'opacity-100' : 'opacity-0'}`}>
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                            <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                        </span>
                    </div>
                    {!empty && status !== 'error' && (
                        <p className="mt-1 text-[13px] text-muted break-anywhere">{scopeLine(result)}</p>
                    )}

                    {result.items.length > 0 && status !== 'error' ? (
                        <ul key={version} className="mt-3">
                            {result.items.map((s, i) => (
                                <li key={s.slug} className="lp-result py-3" style={{ ['--i' as string]: i }}>
                                    <Link
                                        href={`/services/${s.slug}`}
                                        className="text-[15px] font-medium leading-snug text-fg underline-offset-2 hover:text-accent hover:underline"
                                    >
                                        {s.name}
                                    </Link>
                                    <p className="mt-1 flex flex-wrap items-center gap-x-2 text-[13px] text-muted">
                                        <span>{s.issuer}</span>
                                        <span className="rounded bg-surface-2 px-1.5 text-[12px] font-medium text-fg">{s.level}</span>
                                        {s.source && (
                                            <a href={s.source} target="_blank" rel="noopener noreferrer" className="text-official underline-offset-2 hover:underline">
                                                myscheme.gov.in
                                                <span className="sr-only"> (opens in a new tab)</span>
                                            </a>
                                        )}
                                    </p>
                                </li>
                            ))}
                        </ul>
                    ) : (
                        !empty && status !== 'error' && (
                            <p className="mt-4 text-[15px] leading-relaxed text-fg">
                                {result.queryTooGeneral
                                    ? 'Words like “scheme” or “the” match everything. Add who it is for or what it pays for.'
                                    : 'No scheme in the dataset uses those words. Try fewer words, or ask InBridge in your own words.'}
                            </p>
                        )
                    )}

                    <div className="mt-4 flex flex-wrap gap-x-5 gap-y-1 text-[14px] font-medium">
                        {result.total > result.items.length && status !== 'error' && (
                            <Link href={result.href} className="inline-flex min-h-11 items-center text-accent underline-offset-2 hover:underline">
                                See all {n(result.total)} in the directory
                            </Link>
                        )}
                        {text.trim() && (
                            <Link href={askHref} className="inline-flex min-h-11 items-center text-accent underline-offset-2 hover:underline">
                                Ask InBridge about this
                            </Link>
                        )}
                    </div>
                </div>
            </div>
        </section>
    );
}
