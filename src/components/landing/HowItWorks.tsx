/**
 * "Call and response column": three things you type, each followed by what
 * the InBridge chat really shows. The fragments are built from the chat's
 * own classes and strings (composer, phase line, provenance line, citation
 * chip, source card). No answer text is shown: answers are written fresh by
 * the model for every question, so only retrieval and citation appear here.
 */
import type { ReactNode } from 'react';
import type { Scheme } from '@/lib/schemes';
import { Ref } from './Ref';
import { MARGIN, T } from './type';

function Composer({ text, lang }: { text: string; lang?: string }) {
    return (
        <div data-ui className="w-full max-w-[560px] rounded-xl border border-line bg-surface" aria-label="The InBridge chat box with a typed question" role="group">
            <p lang={lang} className="px-4 pt-3 pb-1 text-base leading-relaxed text-fg">
                {text}
            </p>
            <div className="flex items-center gap-1.5 px-2 pb-2 pt-1" aria-hidden="true">
                <span className="inline-flex h-9 items-center gap-1.5 rounded-full border border-line pl-3 pr-3 text-sm text-muted">
                    Draft a complaint
                </span>
                <span className="ml-auto inline-flex h-9 w-9 items-center justify-center rounded-full text-muted">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="9" y="2" width="6" height="12" rx="3" />
                        <path d="M5 10a7 7 0 0 0 14 0M12 19v3" />
                    </svg>
                </span>
                <span className="inline-flex h-9 w-9 items-center justify-center rounded-full bg-fg text-bg">
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M12 19V5M5 12l7-7 7 7" />
                    </svg>
                </span>
            </div>
        </div>
    );
}

function Phase({ label, lang }: { label: string; lang?: string }) {
    return (
        <div data-ui className="inline-flex items-center gap-2 rounded-lg bg-surface px-3 py-2 text-sm text-muted">
            <span aria-hidden="true" className="lp-dots flex gap-1">
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
                <span className="h-1.5 w-1.5 rounded-full bg-accent" />
            </span>
            <span lang={lang}>{label}</span>
        </div>
    );
}

function SourceResult({ scheme }: { scheme: Scheme }) {
    const url = scheme.source ?? 'https://www.myscheme.gov.in/';
    return (
        <div data-ui className="w-full max-w-[760px] rounded-xl bg-surface p-5 sm:p-6">
            <p className="text-sm text-muted">From the myScheme dataset</p>
            <p className="mt-4 text-[15px] leading-relaxed text-fg">
                <span className="text-muted">A claim in the answer, then its marker:</span>
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    aria-label={`Example citation chip, numbered within its answer: myscheme.gov.in, ${scheme.name} (opens in a new tab)`}
                    className="relative mx-1 inline-flex translate-y-[-1px] items-center gap-1 rounded-full border border-line bg-surface-2 px-1.5 py-px align-baseline text-[13px] font-medium leading-5 text-muted no-underline transition-colors hover:border-accent hover:text-fg"
                >
                    <span className="tabular-nums text-fg">1</span>
                    <span>myscheme.gov.in</span>
                </a>
            </p>
            <p className="mt-6 mb-2 text-sm font-semibold text-muted">Sources</p>
            <div className="flex flex-wrap gap-2">
                <a
                    href={url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="flex min-h-[84px] w-full max-w-[300px] flex-col justify-between rounded-lg border border-line bg-bg p-3 transition-colors hover:border-accent"
                >
                    <span className="line-clamp-2 text-[13px] font-medium leading-snug text-fg">{scheme.name}</span>
                    <span className="mt-2 flex min-w-0 items-center gap-1.5 text-[13px] text-muted">
                        <span className="inline-flex h-5 min-w-5 shrink-0 items-center justify-center rounded bg-surface-2 px-1 text-[13px] font-semibold tabular-nums">1</span>
                        <span className="truncate">myscheme.gov.in</span>
                        <span className="ml-auto shrink-0 font-semibold text-official" title="Government domain (.gov.in / .nic.in)">Official</span>
                    </span>
                    <span className="sr-only">(opens in a new tab)</span>
                </a>
                <div className="flex min-h-[84px] min-w-0 flex-1 basis-56 flex-col justify-center rounded-lg bg-surface-2 p-3 text-[13px] leading-snug text-muted">
                    <span className="text-fg">{scheme.issuer}</span>
                    <span className="mt-1 break-anywhere">{url.replace(/^https:\/\//, '')}</span>
                </div>
            </div>
        </div>
    );
}

function Exchange({ order, call, response, children, wide = false }: { order: string; call: ReactNode; response: ReactNode; children: ReactNode; wide?: boolean }) {
    return (
        <li className="mt-20 first:mt-0 md:mt-[88px]">
            <p className={`${T.l} font-medium text-fg`} data-reveal style={{ ['--reveal-i' as string]: 0 }}>
                {order}
            </p>
            <div className="mt-4" data-reveal style={{ ['--reveal-i' as string]: 1 }}>
                {call}
            </div>
            <div className={`mt-6 md:mt-4 ${wide ? '' : 'md:pl-14'}`} data-reveal style={{ ['--reveal-i' as string]: 2 }}>
                {response}
            </div>
            <p className={`${T.b} mt-5 max-w-[560px] text-fg ${wide ? '' : 'md:pl-14'}`} data-reveal style={{ ['--reveal-i' as string]: 3 }}>
                {children}
            </p>
        </li>
    );
}

export function HowItWorks({ scheme }: { scheme: Scheme }) {
    return (
        <section aria-labelledby="how-heading" className={`${MARGIN} pt-36 md:pt-48 lg:grid lg:grid-cols-[42%_1fr]`}>
            <div className="lg:pr-12">
                <div className="lg:sticky lg:top-12">
                    <h2 id="how-heading" className={`${T.h} text-fg`} data-reveal>
                        From question to source
                    </h2>
                    <p className={`${T.b} mt-6 max-w-[40ch] text-fg`} data-reveal style={{ ['--reveal-i' as string]: 1 }}>
                        What you type, and what the chat shows while it works. Each piece is drawn from the InBridge
                        interface itself; the scheme below is a real record from the dataset
                        <Ref to="pmkisan" />.
                    </p>
                </div>
            </div>

            <ol className="mt-16 lg:mt-0 max-w-[760px]">
                <Exchange
                    order="First, ask the way you would ask a person."
                    call={<Composer text="Who can get PM-KISAN and how do I apply?" />}
                    response={<Phase label="Searching scheme dataset" />}
                >
                    It looks in its copy of the myScheme listing first:
                    names, departments, states and who each scheme is for
                    <Ref to="myscheme" />.
                </Exchange>
                <Exchange
                    order="Then it searches official sites, and only those."
                    call={<Composer lang="hi" text="बिहार में छात्राओं के लिए कौन सी छात्रवृत्तियाँ हैं?" />}
                    response={<Phase lang="hi" label="आधिकारिक सरकारी साइटों पर खोज रहे हैं" />}
                >
                    When the listing is not enough, or the question is about something recent, it searches the web
                    limited to .gov.in and .nic.in pages, and drops anything from another domain before the AI model
                    reads it
                    <Ref to="search" />.
                </Exchange>
                <Exchange
                    wide
                    order="Last, every claim points back to its page."
                    call={<Composer text="PM-KISAN ke liye kaun apply kar sakta hai?" />}
                    response={<SourceResult scheme={scheme} />}
                >
                    The marker and the source card both open the scheme’s page on myScheme
                    <Ref to="pmkisan" />. Check it there before you act: the AI can still get things wrong.
                </Exchange>
            </ol>
        </section>
    );
}
