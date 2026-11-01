/**
 * app/services/[slug]/page.tsx — Scheme detail
 * Built from the myScheme snapshot (lib/schemes.ts). Shows only what the
 * dataset holds: no helplines, fees, timelines, documents or eligibility,
 * because the dataset does not contain them. Those come from the official
 * page or from a cited chat answer.
 */
import type { ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { LevelBadge } from '@/components/scheme/SchemeCard';
import {
    DATASET_LABEL,
    askHref,
    audienceLabel,
    categoryLabel,
    getRelatedSchemes,
    getScheme,
    servicesHref,
} from '@/lib/schemes';

/**
 * The old page hard-coded /services/aadhaar and /services/pan. Those are
 * identity documents, not schemes, so they are not in the dataset. Rather than
 * 404 old links, send them to the chat with the question pre-filled.
 */
const LEGACY_SLUGS: Record<string, string> = {
    aadhaar: 'How do I enrol for Aadhaar or update my Aadhaar details?',
    pan: 'How do I apply for a PAN card or correct my PAN details?',
};

// Pages render on first request and are then cached; 4,739 pages are not prebuilt.
export const dynamicParams = true;
export function generateStaticParams() {
    return [];
}

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const scheme = getScheme(slug);
    if (!scheme) return { title: 'Scheme not found' };
    return {
        title: scheme.name,
        description: scheme.brief,
        alternates: { canonical: `/services/${scheme.slug}` },
    };
}

function Fact({ label, children }: { label: string; children: ReactNode }) {
    return (
        <div className="grid gap-1 py-4 border-b border-line sm:grid-cols-[12rem_1fr] sm:gap-6">
            <dt className="text-sm text-muted">{label}</dt>
            <dd className="text-fg min-w-0 break-words">{children}</dd>
        </div>
    );
}

export default async function SchemeDetailPage({ params }: PageProps) {
    const { slug } = await params;

    const legacy = LEGACY_SLUGS[slug];
    if (legacy) redirect(askHref(legacy));

    const scheme = getScheme(slug);
    if (!scheme) notFound();

    const askQuestion = `Tell me about ${scheme.name}: who it is for, what it offers and how to apply.`;
    const primaryCategory = scheme.categories[0];
    // Same issuer / state first, then by name (see rankRelated in lib/schemes.ts).
    const related = getRelatedSchemes(scheme, 3);

    return (
        <>
            <SiteHeader current="services" />
            <main id="main-content" className="mx-auto max-w-4xl px-4 sm:px-6 pt-8 sm:pt-12">
                <nav aria-label="Breadcrumb">
                    <ol className="flex flex-wrap items-center gap-1 text-sm text-muted">
                        <li><Link href="/" className="inline-flex items-center min-h-11 pr-1 hover:text-fg">Home</Link></li>
                        <li aria-hidden="true">/</li>
                        <li><Link href="/services" className="inline-flex items-center min-h-11 px-1 hover:text-fg">Schemes</Link></li>
                        <li aria-hidden="true">/</li>
                        <li aria-current="page" className="px-1 text-fg truncate max-w-[16rem] sm:max-w-md">{scheme.short || scheme.name}</li>
                    </ol>
                </nav>

                <header className="mt-6">
                    <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                        <LevelBadge level={scheme.level} />
                        <span className="break-words min-w-0">{scheme.issuer}</span>
                    </div>
                    <h1 className="mt-4 font-serif text-3xl sm:text-5xl leading-tight tracking-tight text-fg break-words">
                        {scheme.name}
                    </h1>
                    <p className="mt-6 text-lg leading-relaxed text-fg max-w-[68ch] break-words">{scheme.brief}</p>
                </header>

                <div className="mt-8 flex flex-col sm:flex-row gap-3">
                    <Link
                        href={askHref(askQuestion)}
                        className="inline-flex items-center justify-center gap-2 min-h-12 rounded-lg bg-accent px-5 text-base font-medium text-accent-fg"
                    >
                        <MessageSquare size={18} aria-hidden="true" />
                        Ask InBridge about this scheme
                    </Link>
                    {scheme.source && (
                        <a
                            href={scheme.source}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center justify-center gap-2 min-h-12 rounded-lg border border-line px-5 text-base text-fg hover:bg-surface-2"
                        >
                            Official page on myScheme
                            <ArrowUpRight size={18} aria-hidden="true" />
                            <span className="sr-only"> (opens in a new tab)</span>
                        </a>
                    )}
                </div>

                <section aria-labelledby="facts-heading" className="mt-12">
                    <h2 id="facts-heading" className="font-serif text-2xl text-fg">At a glance</h2>
                    <dl className="mt-4 border-t border-line">
                        <Fact label="Level">{scheme.level === 'Central' ? 'Central government' : 'State government'}</Fact>
                        <Fact label="Issued by">{scheme.issuer || 'Not stated in the dataset'}</Fact>
                        <Fact label="States / UTs">
                            {scheme.allIndia
                                ? 'All India'
                                : scheme.states.length ? scheme.states.join(', ') : 'Not stated in the dataset'}
                        </Fact>
                        <Fact label="Areas">
                            <ul className="flex flex-wrap gap-2">
                                {scheme.categories.map((c) => (
                                    <li key={c}>
                                        <Link
                                            href={servicesHref({ category: c })}
                                            className="inline-flex items-center min-h-11 rounded-full border border-line px-3 text-sm text-fg hover:bg-surface-2"
                                        >
                                            {categoryLabel(c)}
                                        </Link>
                                    </li>
                                ))}
                            </ul>
                        </Fact>
                        <Fact label="Scheme for">{scheme.audience ? audienceLabel(scheme.audience) : 'Not stated in the dataset'}</Fact>
                        {scheme.tags.length > 0 && (
                            <Fact label="Tags">
                                <ul className="flex flex-wrap gap-2">
                                    {scheme.tags.map((t) => (
                                        <li key={t} className="inline-flex items-center rounded-full bg-surface-2 px-3 py-1 text-sm text-fg">{t}</li>
                                    ))}
                                </ul>
                            </Fact>
                        )}
                    </dl>
                </section>

                <aside className="mt-10 rounded-lg border border-line bg-surface p-5 text-sm text-muted leading-relaxed">
                    <p>
                        Information from the {DATASET_LABEL} — confirm on the official page. Eligibility, documents,
                        benefits and deadlines are set by the issuing department and are not part of this listing.
                    </p>
                </aside>

                {related.length > 0 && (
                    <section aria-labelledby="related-heading" className="mt-16">
                        <h2 id="related-heading" className="font-serif text-2xl text-fg">
                            More in {categoryLabel(primaryCategory)}
                        </h2>
                        <ul className="mt-4 border-t border-line">
                            {related.map((s) => (
                                <li key={s.slug} className="border-b border-line">
                                    <Link href={`/services/${s.slug}`} className="block py-4 group">
                                        <span className="block text-fg group-hover:text-accent break-words">{s.name}</span>
                                        <span className="block mt-1 text-sm text-muted">{s.issuer}</span>
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <Link
                            href={servicesHref({ category: primaryCategory, state: scheme.allIndia ? undefined : scheme.states[0] })}
                            className="mt-4 inline-flex items-center min-h-11 text-sm text-accent hover:underline underline-offset-4"
                        >
                            See all in this area
                        </Link>
                    </section>
                )}
            </main>
            <SiteFooter />
        </>
    );
}
