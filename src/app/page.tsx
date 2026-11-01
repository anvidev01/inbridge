/**
 * app/page.tsx — Landing page
 * Server component. The only client JS is HeroComposer, which hands the
 * question to /chat?q= (pre-filled, not sent). Every number on this page is
 * computed from the myScheme dataset at build time; there are no user counts,
 * testimonials, logos or accuracy claims.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Image from 'next/image';
import Link from 'next/link';
import { ArrowRight, DoorOpen, EyeOff, Link2, Scale, X } from 'lucide-react';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { HeroComposer } from '@/components/site/HeroComposer';
import { SchemeCard } from '@/components/scheme/SchemeCard';
import { DATASET_LABEL, askHref, getFilterOptions, getScheme, getStats, servicesHref } from '@/lib/schemes';
import { LANGUAGES } from '@/lib/chat/protocol';
import { pngSize } from '@/lib/site';

export const metadata: Metadata = {
    title: { absolute: 'InBridge — ask about any Indian government scheme, with answers linked to official sources' },
    description:
        'An independent AI assistant for Indian government schemes. Ask in English, Hindi or Hinglish; answers link to official .gov.in and .nic.in sources.',
    alternates: { canonical: '/' },
};

/** One example per supported language. They pre-fill the chat composer. */
const EXAMPLES = [
    { text: 'Who can get PM-KISAN and how do I apply?', lang: 'en-IN' },
    { text: 'बिहार में छात्राओं के लिए कौन सी छात्रवृत्तियाँ हैं?', lang: 'hi' },
    { text: 'Mudra loan ke liye kaun apply kar sakta hai?', lang: 'hi-Latn' },
];

/** Real records from the dataset shown as a sample of the directory. */
const SAMPLE_SLUGS = ['pm-kisan', 'pmmy', 'ab-pmjay'];

const STEPS = [
    {
        title: 'Ask in your words',
        body: 'Type or speak in English, Hindi or Hinglish. No sign-up, and no personal numbers needed.',
    },
    {
        title: 'InBridge looks it up',
        body: 'It searches its myScheme dataset first, then live .gov.in and .nic.in portals when it needs more.',
    },
    {
        title: 'Get a cited answer',
        body: 'A plain answer with numbered links to the official pages it used, and the official place to take the next step.',
    },
];

const TRUST = [
    {
        icon: Link2,
        title: 'Government sources only',
        body: 'Live search is limited to .gov.in and .nic.in websites, and every result is checked again before the AI reads it.',
    },
    {
        icon: EyeOff,
        title: 'Personal numbers blocked',
        body: 'Messages that look like an Aadhaar or PAN number are stopped before they reach the AI model.',
    },
    {
        icon: DoorOpen,
        title: 'No login needed',
        body: 'Use it straight away. Your chat history stays in your own browser.',
    },
    {
        icon: Scale,
        title: 'Independent',
        body: 'InBridge is not a government website and is not affiliated with any government body.',
    },
];

const DOES_NOT = [
    'File applications or complaints for you',
    'Fetch your application status or personal records',
    'Ask for your Aadhaar, PAN, OTP or bank details',
];

/**
 * A real screenshot of an InBridge answer, if one has been added at
 * public/landing/answer-dark.png. No mockups: when the file is missing the
 * "See it answer" section is not rendered at all.
 */
const ANSWER_SCREENSHOT = '/landing/answer-dark.png';

function readAnswerScreenshot(): { width: number; height: number } | null {
    try {
        return pngSize(readFileSync(path.join(process.cwd(), 'public', ANSWER_SCREENSHOT)));
    } catch {
        return null;
    }
}

function SectionHeading({ id, eyebrow, children }: { id: string; eyebrow: string; children: ReactNode }) {
    return (
        <div className="max-w-2xl">
            <p className="text-sm text-muted">{eyebrow}</p>
            <h2 id={id} className="mt-3 font-serif text-3xl sm:text-4xl leading-tight tracking-tight text-fg">
                {children}
            </h2>
        </div>
    );
}

export default function HomePage() {
    const stats = getStats();
    const categories = [...getFilterOptions().categories].sort((a, b) => b.count - a.count);
    const samples = SAMPLE_SLUGS.map(getScheme).filter((s) => s !== undefined);
    const n = (v: number) => v.toLocaleString('en-IN');
    const screenshot = readAnswerScreenshot();

    const coverage = [
        { value: n(stats.total), label: 'schemes in the dataset' },
        { value: n(stats.central), label: 'Central schemes' },
        { value: n(stats.state), label: 'State schemes' },
        { value: n(stats.states), label: 'states and union territories' },
        { value: n(stats.categories), label: 'categories' },
    ];

    return (
        <>
            <SiteHeader />
            <main id="main-content">
                {/* ── Hero ─────────────────────────────────────────── */}
                <section aria-labelledby="hero-heading" className="mx-auto max-w-6xl px-4 sm:px-6 pt-16 sm:pt-28 pb-20 sm:pb-28">
                    <p className="text-sm text-muted">An independent AI assistant — not a government website</p>
                    <h1
                        id="hero-heading"
                        className="mt-5 max-w-4xl font-serif text-[2.5rem] leading-[1.08] sm:text-6xl lg:text-7xl tracking-tight text-fg"
                    >
                        Ask about any Indian government scheme. Get answers linked to official sources.
                    </h1>
                    <p lang="hi" className="mt-6 max-w-2xl font-serif text-xl sm:text-2xl text-muted">
                        किसी भी सरकारी योजना के बारे में पूछें — जवाब, आधिकारिक स्रोतों के लिंक के साथ।
                    </p>

                    <div className="mt-10 max-w-2xl">
                        <HeroComposer />
                        <ul className="mt-4 flex flex-wrap gap-2" aria-label="Example questions">
                            {EXAMPLES.map((ex) => (
                                <li key={ex.text} className="min-w-0">
                                    <Link
                                        href={askHref(ex.text)}
                                        lang={ex.lang}
                                        className="inline-flex items-center min-h-11 max-w-full rounded-full border border-line px-4 py-2 text-sm text-muted hover:text-fg hover:bg-surface-2 break-words"
                                    >
                                        {ex.text}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                    </div>

                    <div className="mt-10">
                        <Link
                            href="/services"
                            className="inline-flex items-center gap-2 min-h-11 text-base text-fg underline-offset-4 hover:underline"
                        >
                            Or browse {n(stats.total)} schemes
                            <ArrowRight size={18} aria-hidden="true" />
                        </Link>
                    </div>
                </section>

                {/* ── How it works ─────────────────────────────────── */}
                <section aria-labelledby="how-heading" className="border-t border-line">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
                        <SectionHeading id="how-heading" eyebrow="How it works">
                            Three steps, every source shown.
                        </SectionHeading>
                        <ol className="mt-12 grid gap-10 md:grid-cols-3 md:gap-8">
                            {STEPS.map((step, i) => (
                                <li key={step.title} className="border-t border-line pt-6">
                                    <span className="font-serif text-4xl text-accent tabular-nums" aria-hidden="true">
                                        {i + 1}
                                    </span>
                                    <h3 className="mt-4 text-lg font-semibold text-fg">{step.title}</h3>
                                    <p className="mt-2 text-muted leading-relaxed">{step.body}</p>
                                </li>
                            ))}
                        </ol>
                    </div>
                </section>

                {/* ── See it answer (only with a real screenshot) ──── */}
                {screenshot && (
                    <section aria-labelledby="answer-heading" className="border-t border-line">
                        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
                            <SectionHeading id="answer-heading" eyebrow="See it answer">
                                A real answer, with its sources.
                            </SectionHeading>
                            <Image
                                src={ANSWER_SCREENSHOT}
                                width={screenshot.width}
                                height={screenshot.height}
                                sizes="(min-width: 72rem) 72rem, 100vw"
                                alt="Screenshot of a real InBridge answer in the dark theme, with numbered links to the official sources it cited."
                                className="mt-12 h-auto w-full rounded-lg border border-line"
                            />
                        </div>
                    </section>
                )}

                {/* ── Coverage (computed from the dataset) ─────────── */}
                <section aria-labelledby="coverage-heading" className="border-t border-line bg-surface">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
                        <SectionHeading id="coverage-heading" eyebrow={`Coverage · ${DATASET_LABEL}`}>
                            Central and State schemes, from one search.
                        </SectionHeading>

                        <dl className="mt-12 grid grid-cols-2 gap-x-6 gap-y-10 sm:grid-cols-3 lg:grid-cols-5">
                            {coverage.map((c) => (
                                <div key={c.label} className="flex flex-col border-t border-line pt-5 min-w-0">
                                    <dt className="text-sm text-muted">{c.label}</dt>
                                    <dd className="order-first mt-2 font-serif text-4xl sm:text-5xl tracking-tight text-fg tabular-nums">
                                        {c.value}
                                    </dd>
                                </div>
                            ))}
                            <div className="border-t border-line pt-5 min-w-0 col-span-2 sm:col-span-3 lg:col-span-5">
                                <dt className="text-sm text-muted">languages</dt>
                                <dd className="mt-2 font-serif text-2xl sm:text-3xl text-fg">
                                    {LANGUAGES.map((l, i) => (
                                        <span key={l.code}>
                                            {i > 0 && <span className="text-muted" aria-hidden="true"> · </span>}
                                            <span lang={l.htmlLang}>{l.native}</span>
                                        </span>
                                    ))}
                                </dd>
                            </div>
                        </dl>

                        <h3 className="mt-16 text-sm font-medium text-fg">Browse by area</h3>
                        <ul className="mt-4 flex flex-wrap gap-2">
                            {categories.map((c) => (
                                <li key={c.value}>
                                    <Link
                                        href={servicesHref({ category: c.value })}
                                        className="inline-flex items-center gap-2 min-h-11 rounded-full border border-line bg-bg px-4 text-sm text-fg hover:border-accent"
                                    >
                                        {c.label}
                                        <span className="text-muted tabular-nums">{n(c.count)}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>

                        <p className="mt-8 max-w-2xl text-sm text-muted">
                            Counts come from the {DATASET_LABEL} held by InBridge. They are not a count of every
                            scheme in India, and some schemes belong to more than one area.
                        </p>
                    </div>
                </section>

                {/* ── Sample of the directory (real records) ───────── */}
                {samples.length > 0 && (
                    <section aria-labelledby="sample-heading" className="border-t border-line">
                        <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
                            <SectionHeading id="sample-heading" eyebrow="From the directory">
                                Every scheme links to its official page.
                            </SectionHeading>
                            <ul className="mt-12 grid gap-4 lg:grid-cols-3">
                                {samples.map((s) => (
                                    <li key={s.slug} className="min-w-0">
                                        <SchemeCard scheme={s} headingLevel="h3" />
                                    </li>
                                ))}
                            </ul>
                            <Link
                                href="/services"
                                className="mt-8 inline-flex items-center gap-2 min-h-11 text-base text-accent underline-offset-4 hover:underline"
                            >
                                Browse all schemes
                                <ArrowRight size={18} aria-hidden="true" />
                            </Link>
                        </div>
                    </section>
                )}

                {/* ── Trust ────────────────────────────────────────── */}
                <section aria-labelledby="trust-heading" className="border-t border-line">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28">
                        <SectionHeading id="trust-heading" eyebrow="Trust">
                            Built so every answer can be checked.
                        </SectionHeading>
                        <ul className="mt-12 grid gap-10 sm:grid-cols-2 sm:gap-x-12">
                            {TRUST.map(({ icon: Icon, title, body }) => (
                                <li key={title} className="flex gap-4">
                                    <Icon size={22} className="mt-0.5 shrink-0 text-accent" aria-hidden="true" />
                                    <div>
                                        <h3 className="text-lg font-semibold text-fg">{title}</h3>
                                        <p className="mt-1 text-muted leading-relaxed">{body}</p>
                                    </div>
                                </li>
                            ))}
                        </ul>
                        <Link
                            href="/about"
                            className="mt-12 inline-flex items-center gap-2 min-h-11 text-base text-accent underline-offset-4 hover:underline"
                        >
                            How InBridge works
                            <ArrowRight size={18} aria-hidden="true" />
                        </Link>
                    </div>
                </section>

                {/* ── Honest scope ─────────────────────────────────── */}
                <section aria-labelledby="scope-heading" className="border-t border-line bg-surface">
                    <div className="mx-auto max-w-6xl px-4 sm:px-6 py-20 sm:py-28 grid gap-10 md:grid-cols-2 md:gap-16">
                        <SectionHeading id="scope-heading" eyebrow="Scope">
                            What InBridge does not do.
                        </SectionHeading>
                        <div>
                            <ul className="border-t border-line">
                                {DOES_NOT.map((item) => (
                                    <li key={item} className="flex items-start gap-3 border-b border-line py-5 text-lg text-fg">
                                        <X size={20} className="mt-1 shrink-0 text-muted" aria-hidden="true" />
                                        {item}
                                    </li>
                                ))}
                            </ul>
                            <p className="mt-6 text-muted leading-relaxed">
                                It explains schemes and points you to the official portal, where you apply, track and
                                complain yourself.
                            </p>
                        </div>
                    </div>
                </section>
            </main>
            <SiteFooter />
        </>
    );
}
