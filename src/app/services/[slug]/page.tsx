/**
 * app/services/[slug]/page.tsx: one scheme.
 * Built from the myScheme snapshot (lib/schemes.ts). Shows only what the
 * dataset holds: no helplines, fees, timelines, documents or eligibility,
 * because the dataset does not contain them. Those come from the official
 * page or from a cited chat answer.
 */
import type { CSSProperties, ReactNode } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound, redirect } from 'next/navigation';
import { ArrowUpRight } from 'lucide-react';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Reveal } from '@/components/site/Reveal';
import { AXIS, BUTTON, Masthead, PAGE_X, PhotoCredits, TEXT_LINK, TYPE, type MastheadPhotos } from '@/components/site/InfoPage';
import type { PhotoKey } from '@/lib/photos';
import {
    DATASET_LABEL,
    askHref,
    audienceLabel,
    categoryLabel,
    getRelatedSchemes,
    getScheme,
    servicesHref,
    type Scheme,
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

/**
 * Masthead photographs: the one that leads is chosen from the scheme's first
 * area, the rest follow in a fixed order. They show the world the area
 * touches (a field, a school gate, a post office counter), never the scheme
 * itself or the people it serves.
 */
const LEAD_PHOTO: Record<string, PhotoKey> = {
    'Agriculture,Rural & Environment': 'farmer',
    'Education & Learning': 'village-school',
    'Banking,Financial Services and Insurance': 'post-office',
    'Transport & Infrastructure': 'station',
    'Travel & Tourism': 'station',
};
const PHOTO_ORDER: PhotoKey[] = ['bridge-crowd', 'farmer', 'post-office', 'village-school', 'station', 'bridge-fog'];

function mastheadPhotos(scheme: Scheme): MastheadPhotos {
    const lead = LEAD_PHOTO[scheme.categories[0] ?? ''] ?? 'bridge-crowd';
    const [a, b, c] = PHOTO_ORDER.filter((p) => p !== lead);
    return [lead, a, b, c];
}

/** Long names step down to the heading size so the title still holds to two lines (no extra type step). */
function titleSize(name: string): string {
    return name.length <= 26 ? TYPE.display : TYPE.head;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
    return (
        <tr className="border-b border-line align-top">
            <th scope="row" className="w-32 sm:w-44 py-5 pr-6 text-left text-sm font-medium text-muted">{label}</th>
            <td className="py-5 text-lg leading-[1.55] text-fg break-words">{children}</td>
        </tr>
    );
}

/** A full-bleed field of one tone: cancels the page margin, then restores it inside. */
const BAND = '-mx-5 sm:-mx-8 lg:-mx-12 px-5 sm:px-8 lg:px-12 py-16 sm:py-20';

const NOT_STATED = <span className="text-muted">Not stated in the dataset</span>;

export default async function SchemeDetailPage({ params }: PageProps) {
    const { slug } = await params;

    const legacy = LEGACY_SLUGS[slug];
    if (legacy) redirect(askHref(legacy));

    const scheme = getScheme(slug);
    if (!scheme) notFound();

    const askQuestion = `Tell me about ${scheme.name}: who it is for, what it offers and how to apply.`;
    const primaryCategory = scheme.categories[0];
    // Same issuer and state first, then shared tags, then by name (see rankRelated in lib/schemes.ts).
    const related = getRelatedSchemes(scheme, 3);
    const photos = mastheadPhotos(scheme);

    return (
        <>
            <SiteHeader current="services" />
            <Reveal />
            <main id="main-content">
                <Masthead photos={photos} variant="lead" />
                <div className={PAGE_X}>
                    <header className={`${AXIS} pt-10 sm:pt-14 lg:pt-20`}>
                        <nav aria-label="Breadcrumb" className="lg:col-start-1 lg:row-start-1 lg:pr-16">
                            <ol className="flex flex-wrap items-center gap-x-2 text-sm text-muted">
                                <li><Link href="/" className="inline-flex items-center min-h-11 transition-colors hover:text-fg">Home</Link></li>
                                <li aria-hidden="true">/</li>
                                <li><Link href="/services" className="inline-flex items-center min-h-11 transition-colors hover:text-fg">Schemes</Link></li>
                                <li aria-hidden="true">/</li>
                                <li aria-current="page" className="text-fg truncate max-w-[14rem] sm:max-w-xs">{scheme.short || scheme.name}</li>
                            </ol>
                        </nav>

                        <div className="mt-6 lg:mt-0 lg:col-start-2 lg:row-start-1 min-w-0">
                            <h1 className={`font-serif ${titleSize(scheme.name)} text-fg break-words text-balance`}>
                                <span className="line-mask"><span>{scheme.name}</span></span>
                            </h1>
                            {scheme.brief && (
                                <p className={`mt-8 max-w-[44ch] ${TYPE.lead} text-fg break-words`}>{scheme.brief}</p>
                            )}
                            <div className="mt-10 flex flex-col items-start gap-x-8 gap-y-3 sm:flex-row sm:items-center">
                                <Link href={askHref(askQuestion)} className={BUTTON}>
                                    Ask InBridge about this scheme
                                </Link>
                                {scheme.source && (
                                    <a
                                        href={scheme.source}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className={`inline-flex items-center gap-1.5 min-h-12 text-lg ${TEXT_LINK}`}
                                    >
                                        Official page on myScheme
                                        <ArrowUpRight size={18} aria-hidden="true" />
                                        <span className="sr-only"> (opens in a new tab)</span>
                                    </a>
                                )}
                            </div>
                        </div>
                    </header>

                    <section aria-labelledby="facts-heading" className={`${AXIS} ${BAND} mt-20 sm:mt-28 bg-surface`}>
                        <h2 id="facts-heading" data-reveal className={`font-serif ${TYPE.head} text-fg lg:pr-16`}>
                            At a glance
                        </h2>
                        <div data-reveal className="mt-6 lg:mt-0 min-w-0">
                            <table className="w-full border-t border-line">
                                <caption className="sr-only">What the myScheme listing says about {scheme.name}</caption>
                                <tbody>
                                    <Row label="Level">{scheme.level === 'Central' ? 'Central government' : 'State government'}</Row>
                                    <Row label="Issued by">{scheme.issuer || NOT_STATED}</Row>
                                    <Row label="States and UTs">
                                        {scheme.allIndia
                                            ? 'All India'
                                            : scheme.states.length ? scheme.states.join(', ') : NOT_STATED}
                                    </Row>
                                    <Row label="Areas">
                                        <ul className="flex flex-col gap-1">
                                            {scheme.categories.map((c) => (
                                                <li key={c}>
                                                    <Link href={servicesHref({ category: c })} className={TEXT_LINK}>
                                                        {categoryLabel(c)}
                                                    </Link>
                                                </li>
                                            ))}
                                        </ul>
                                    </Row>
                                    <Row label="Scheme for">{scheme.audience ? audienceLabel(scheme.audience) : NOT_STATED}</Row>
                                    {scheme.tags.length > 0 && <Row label="Tags">{scheme.tags.join(', ')}</Row>}
                                </tbody>
                            </table>
                        </div>
                    </section>

                    <section aria-labelledby="before-heading" className={`${AXIS} ${BAND} bg-surface-2`}>
                        <h2 id="before-heading" data-reveal className={`font-serif ${TYPE.head} text-fg lg:pr-16`}>
                            Before you apply
                        </h2>
                        <div data-reveal className={`mt-6 lg:mt-1.5 max-w-[60ch] ${TYPE.body} text-fg`}>
                            <p>
                                Information from the {DATASET_LABEL}. Confirm it on the official page: eligibility,
                                documents, benefits and deadlines are set by the issuing department and are not part of
                                this listing.
                            </p>
                            <p className="mt-5">
                                The listing holds only the name, issuing department, level, states, areas, who the
                                scheme is for, a short description, tags and the myScheme link. For anything else, use
                                the official page, or ask InBridge: its answers link to the government pages they draw on.
                            </p>
                        </div>
                    </section>

                    {related.length > 0 && (
                        <section aria-labelledby="related-heading" className={`${AXIS} mt-20 sm:mt-28 pt-3`}>
                            <div data-reveal className="lg:pr-16">
                                <h2 id="related-heading" className={`font-serif ${TYPE.head} text-fg`}>
                                    Related schemes
                                </h2>
                                <p className={`mt-5 ${TYPE.body} text-fg max-w-[36ch]`}>
                                    More in {categoryLabel(primaryCategory)}, with the same issuer and state first.
                                </p>
                            </div>
                            <div className="mt-8 lg:mt-0 min-w-0">
                                <ul className="grid gap-y-8 sm:grid-cols-2 sm:gap-x-10">
                                    {related.map((s, i) => (
                                        <li key={s.slug} data-reveal style={{ '--reveal-i': i } as CSSProperties}>
                                            <Link href={`/services/${s.slug}`} className="group block">
                                                <span className={`block font-serif ${TYPE.lead} text-fg break-words decoration-accent decoration-2 underline-offset-[6px] transition-colors duration-200 group-hover:underline group-hover:text-accent`}>
                                                    {s.name}
                                                </span>
                                                <span className="mt-1 block text-sm text-muted">{s.issuer}</span>
                                            </Link>
                                        </li>
                                    ))}
                                </ul>
                                <Link
                                    href={servicesHref({ category: primaryCategory, state: scheme.allIndia ? undefined : scheme.states[0] })}
                                    className={`mt-10 inline-flex items-center min-h-11 text-lg ${TEXT_LINK}`}
                                >
                                    See all in this area
                                </Link>
                            </div>
                        </section>
                    )}

                    <div className={`${AXIS} mt-20 sm:mt-24`}>
                        <div className="lg:col-start-2">
                            <PhotoCredits photos={photos} />
                        </div>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
