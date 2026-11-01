/**
 * One scheme in the /services directory (and the landing-page sample).
 * Server component. Shows only fields that exist in the myScheme dataset;
 * no eligibility claims, amounts or deadlines.
 */
import type { ReactNode } from 'react';
import Link from 'next/link';
import { ArrowUpRight, MessageSquare } from 'lucide-react';
import { askHref, categoryLabel, type Scheme, type SchemeFilters } from '@/lib/schemes';

export function LevelBadge({ level }: { level: Scheme['level'] }) {
    return (
        <span
            className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${level === 'Central' ? 'border-accent text-accent' : 'border-line text-muted'}`}
        >
            {level === 'Central' ? 'Central' : 'State'}
        </span>
    );
}

function Chip({ children }: { children: ReactNode }) {
    return (
        <span className="inline-flex items-center rounded-full bg-surface-2 px-2.5 py-1 text-xs text-fg">
            {children}
        </span>
    );
}

/** Which of the user's filters this scheme matches, phrased as facts from the listing. */
function matchChips(scheme: Scheme, filters: SchemeFilters): string[] {
    const chips: string[] = [];
    if (filters.state) {
        chips.push(scheme.states.includes(filters.state) ? `Listed for ${filters.state}` : 'All-India scheme');
    }
    if (filters.category) chips.push(categoryLabel(filters.category));
    return chips;
}

export function SchemeCard({
    scheme,
    filters = {},
    headingLevel = 'h2',
}: {
    scheme: Scheme;
    filters?: SchemeFilters;
    headingLevel?: 'h2' | 'h3';
}) {
    const Heading = headingLevel;
    const chips = matchChips(scheme, filters);
    const otherCategories = scheme.categories.filter((c) => c !== filters.category);

    return (
        <article className="rounded-lg border border-line bg-surface p-5 sm:p-6">
            <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted">
                <LevelBadge level={scheme.level} />
                <span className="break-words min-w-0">{scheme.issuer}</span>
            </div>

            <Heading className="mt-3 font-serif text-xl leading-snug text-fg break-words">
                <Link href={`/services/${scheme.slug}`} className="hover:text-accent">
                    {scheme.name}
                </Link>
            </Heading>

            <p className="mt-2 text-[15px] leading-relaxed text-muted break-words">{scheme.brief}</p>

            {(chips.length > 0 || otherCategories.length > 0) && (
                <div className="mt-4 flex flex-wrap gap-2">
                    {chips.length > 0 && <span className="sr-only">Matches your filters:</span>}
                    {chips.map((c) => <Chip key={c}>{c}</Chip>)}
                    {otherCategories.map((c) => (
                        <span key={c} className="inline-flex items-center rounded-full border border-line px-2.5 py-1 text-xs text-muted">
                            {categoryLabel(c)}
                        </span>
                    ))}
                </div>
            )}

            <div className="mt-5 flex flex-wrap gap-x-2 gap-y-1 -ml-2">
                <Link
                    href={askHref(`Tell me about ${scheme.name}`)}
                    className="inline-flex items-center gap-1.5 min-h-11 px-2 text-sm font-medium text-accent hover:underline underline-offset-4"
                >
                    <MessageSquare size={16} aria-hidden="true" />
                    Ask InBridge
                </Link>
                {scheme.source && (
                    <a
                        href={scheme.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="inline-flex items-center gap-1.5 min-h-11 px-2 text-sm text-fg hover:underline underline-offset-4"
                    >
                        View on myScheme
                        <ArrowUpRight size={16} aria-hidden="true" />
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                )}
            </div>
        </article>
    );
}
