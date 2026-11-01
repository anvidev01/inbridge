/**
 * app/services/page.tsx: the scheme directory.
 * Server-rendered from the myScheme snapshot (lib/schemes.ts). Search,
 * filters and pagination all live in the query string, so the page works
 * without JavaScript and the dataset never reaches the browser.
 * Layout: the search panel stays in the left column while the results hang
 * from the text axis as an editorial list.
 */
import type { CSSProperties } from 'react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Reveal } from '@/components/site/Reveal';
import { AXIS, BUTTON, Masthead, PAGE_X, PhotoCredits, TYPE, type MastheadPhotos } from '@/components/site/InfoPage';
import { SchemeCard } from '@/components/scheme/SchemeCard';
import { SchemeFilters } from '@/components/scheme/SchemeFilters';
import { Pagination } from '@/components/scheme/Pagination';
import { extractState } from '@/components/landing/scheme-query';
import {
    DATASET_LABEL,
    DATASET_MONTH,
    askHref,
    audienceLabel,
    categoryLabel,
    getFilterOptions,
    getSchemes,
    getStats,
    parseSchemeFilters,
    type SchemeFilters as Filters,
} from '@/lib/schemes';

export const metadata: Metadata = {
    title: 'Browse government schemes',
    description:
        'Search and filter Indian government schemes from the myScheme dataset by state, area, Central or State level and who they are for. Check eligibility on the official page.',
    alternates: { canonical: '/services' },
};

/** How many result entries get a scroll entrance. */
const REVEALED_ENTRIES = 6;

const PHOTOS: MastheadPhotos = ['station', 'farmer', 'post-office', 'village-school'];

interface PageProps {
    searchParams: Promise<Record<string, string | string[] | undefined>>;
}

/** Human summary of the active filters, e.g. "Bihar · Education & Learning". */
function describeFilters(f: Filters): string {
    return [
        f.state,
        f.category && categoryLabel(f.category),
        f.level && `${f.level} schemes`,
        f.audience && audienceLabel(f.audience),
    ].filter(Boolean).join(' · ');
}

export default async function ServicesPage({ searchParams }: PageProps) {
    const options = getFilterOptions();
    const parsed = parseSchemeFilters(await searchParams, options);
    const { page } = parsed;
    // "scholarship for girls in Bihar" typed into a search box: read the state
    // out of the text, as the landing page's live search does, so both run the
    // same query (and the no-JS form lands on the same results).
    let filters = parsed.filters;
    if (filters.q && !filters.state) {
        const found = extractState(filters.q, options.states.map((st) => st.value));
        if (found.state) filters = { ...filters, q: found.q || undefined, state: found.state };
    }
    const result = getSchemes(filters, page);
    const stats = getStats();
    const n = (v: number) => v.toLocaleString('en-IN');

    const summary = describeFilters(filters);
    const first = (result.page - 1) * result.pageSize + 1;
    const last = first + result.items.length - 1;

    return (
        <>
            <SiteHeader current="services" />
            <Reveal />
            <main id="main-content">
                <Masthead photos={PHOTOS} />
                <div className={PAGE_X}>
                    <header className={`${AXIS} pt-12 sm:pt-16 lg:pt-24`}>
                        <h1 className={`font-serif ${TYPE.display} text-fg lg:col-start-2 lg:row-start-1`}>
                            <span className="line-mask"><span>Find a scheme</span></span>
                        </h1>
                        <p className={`mt-8 lg:mt-2 lg:col-start-1 lg:row-start-1 lg:pr-16 max-w-[36ch] ${TYPE.lead} text-fg`}>
                            Search {n(stats.total)} Central and State schemes listed on myScheme, in a snapshot taken
                            in {DATASET_MONTH}. It cannot tell you whether you qualify: every scheme sets its own rules
                            on its official page.
                        </p>
                    </header>

                    <div className={`${AXIS} mt-16 lg:mt-24`}>
                        <section aria-labelledby="filters-heading" className="lg:pr-16" data-reveal>
                            <div className="lg:sticky lg:top-6">
                                <SchemeFilters options={options} filters={filters} headingId="filters-heading" />
                            </div>
                        </section>

                        <section aria-labelledby="results-heading" className="mt-16 lg:mt-0 min-w-0">
                            <div data-reveal>
                                <h2 id="results-heading" className={`font-serif ${TYPE.head} text-fg break-words`}>
                                    {result.total === 0
                                        ? 'No schemes found'
                                        : `${n(result.total)} ${result.total === 1 ? 'scheme' : 'schemes'}`}
                                    {filters.q && <> for &ldquo;<span className="break-anywhere">{filters.q}</span>&rdquo;</>}
                                </h2>
                                <p className={`mt-3 ${TYPE.small} text-muted tabular-nums`}>
                                    {result.total > 0
                                        ? <>Showing {n(first)} to {n(last)}{summary && <>, filtered by {summary}</>}. Matched on state, area and who a scheme is for.</>
                                        : 'Matched on state, area and who a scheme is for.'}
                                </p>
                            </div>

                            {result.total === 0 ? (
                                <div className="mt-10 max-w-[60ch]" data-reveal>
                                    {result.queryTooGeneral ? (
                                        <p className={`${TYPE.body} text-fg`}>
                                            &ldquo;<span className="break-anywhere">{filters.q}</span>&rdquo; is too general to
                                            search on. Words like &ldquo;the&rdquo;, &ldquo;for&rdquo; or &ldquo;schemes&rdquo; and
                                            single letters are ignored. Try a specific word such as a scheme name, a group
                                            (farmers, students) or a need (scholarship, pension), or ask InBridge.
                                        </p>
                                    ) : (
                                        <p className={`${TYPE.body} text-fg`}>
                                            Nothing in the dataset matches these filters. Try fewer filters or a shorter
                                            search, or ask InBridge, which can also search live government portals.
                                        </p>
                                    )}
                                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                                        {filters.q && (
                                            <Link href={askHref(filters.q)} className={BUTTON}>
                                                Ask InBridge instead
                                            </Link>
                                        )}
                                        <Link
                                            href="/services"
                                            className="inline-flex items-center min-h-11 text-sm font-medium text-fg underline decoration-muted underline-offset-[5px] transition-colors duration-200 hover:text-accent hover:decoration-accent"
                                        >
                                            Clear filters
                                        </Link>
                                    </div>
                                </div>
                            ) : (
                                <ul className="mt-12 space-y-14 sm:space-y-16" aria-label="Schemes">
                                    {result.items.map((scheme, i) => (
                                        <li
                                            key={scheme.slug}
                                            className="min-w-0"
                                            // Only the first entries rise in; the rest of a long list is simply there.
                                            data-reveal={i < REVEALED_ENTRIES ? '' : undefined}
                                            style={{ '--reveal-i': i % 3 } as CSSProperties}
                                        >
                                            <SchemeCard scheme={scheme} filters={filters} headingLevel="h3" />
                                        </li>
                                    ))}
                                </ul>
                            )}

                            <Pagination filters={filters} page={result.page} totalPages={result.totalPages} />

                            <p className={`mt-16 ${TYPE.small} text-muted max-w-[62ch]`}>
                                Information from the {DATASET_LABEL}. Schemes change and close; confirm details,
                                eligibility and deadlines on the official page before you apply.
                            </p>
                        </section>
                    </div>

                    <div className={`${AXIS} mt-20`}>
                        <div className="lg:col-start-2">
                            <PhotoCredits photos={PHOTOS} />
                        </div>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
