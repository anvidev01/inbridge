/**
 * app/services/page.tsx — Scheme finder / directory
 * Server-rendered from the myScheme snapshot (lib/schemes.ts). Search,
 * filters and pagination all live in the query string, so the page works
 * without JavaScript and the dataset never reaches the browser.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { SchemeCard } from '@/components/scheme/SchemeCard';
import { SchemeFilters } from '@/components/scheme/SchemeFilters';
import { Pagination } from '@/components/scheme/Pagination';
import {
    DATASET_LABEL,
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
    const { filters, page } = parseSchemeFilters(await searchParams, options);
    const result = getSchemes(filters, page);
    const stats = getStats();

    const summary = describeFilters(filters);
    const first = (result.page - 1) * result.pageSize + 1;
    const last = first + result.items.length - 1;

    return (
        <>
            <SiteHeader current="services" />
            <main id="main-content" className="mx-auto max-w-6xl px-4 sm:px-6 pt-12 sm:pt-16">
                <header className="max-w-3xl">
                    <p className="text-sm text-muted">Scheme directory · {DATASET_LABEL}</p>
                    <h1 className="mt-3 font-serif text-3xl sm:text-5xl leading-tight tracking-tight text-fg">
                        Schemes that may be relevant — check eligibility on the official page
                    </h1>
                    <p className="mt-4 text-base sm:text-lg text-muted leading-relaxed">
                        Search {stats.total.toLocaleString('en-IN')} Central and State schemes listed on myScheme.
                        This list matches on state, area and who a scheme is for. It cannot tell you whether you
                        qualify — every scheme sets its own rules on its official page.
                    </p>
                </header>

                <div className="mt-10">
                    <SchemeFilters options={options} filters={filters} />
                </div>

                <section aria-labelledby="results-heading" className="mt-10">
                    <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1 border-b border-line pb-4">
                        <h2 id="results-heading" className="text-base font-medium text-fg">
                            {result.total === 0
                                ? 'No schemes found'
                                : `${result.total.toLocaleString('en-IN')} ${result.total === 1 ? 'scheme' : 'schemes'}`}
                            {filters.q && <> for “<span className="break-words">{filters.q}</span>”</>}
                        </h2>
                        {result.total > 0 && (
                            <p className="text-sm text-muted tabular-nums">
                                Showing {first.toLocaleString('en-IN')}–{last.toLocaleString('en-IN')}
                                {summary && <> · {summary}</>}
                            </p>
                        )}
                    </div>

                    {result.total === 0 ? (
                        <div className="py-12 max-w-xl">
                            <p className="text-fg">
                                Nothing in the dataset matches these filters. Try fewer filters or a shorter search,
                                or ask InBridge — it can also search live government portals.
                            </p>
                            <div className="mt-5 flex flex-wrap gap-3">
                                <Link href="/services" className="inline-flex items-center min-h-11 rounded-lg border border-line px-4 text-sm text-fg hover:bg-surface-2">
                                    Clear filters
                                </Link>
                                {filters.q && (
                                    <Link href={askHref(filters.q)} className="inline-flex items-center min-h-11 rounded-lg bg-accent px-4 text-sm font-medium text-accent-fg">
                                        Ask InBridge instead
                                    </Link>
                                )}
                            </div>
                        </div>
                    ) : (
                        <ul className="mt-6 grid gap-4 lg:grid-cols-2">
                            {result.items.map((scheme) => (
                                <li key={scheme.slug} className="min-w-0">
                                    <SchemeCard scheme={scheme} filters={filters} headingLevel="h3" />
                                </li>
                            ))}
                        </ul>
                    )}

                    <Pagination filters={filters} page={result.page} totalPages={result.totalPages} />

                    <p className="mt-10 text-sm text-muted max-w-3xl">
                        Information from the {DATASET_LABEL}. Schemes change and close; confirm details, eligibility
                        and deadlines on the official page before you apply.
                    </p>
                </section>
            </main>
            <SiteFooter />
        </>
    );
}
