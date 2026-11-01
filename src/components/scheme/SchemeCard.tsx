/**
 * One scheme in the /services directory (and the landing-page sample), set as
 * an entry in an editorial list rather than a boxed card: the name large in
 * the serif, one plain line of facts, the brief, two text links.
 * Server component. Shows only fields that exist in the myScheme dataset;
 * no eligibility claims, amounts or deadlines.
 */
import Link from 'next/link';
import { ArrowUpRight } from 'lucide-react';
import { askHref, categoryLabel, type Scheme, type SchemeFilters } from '@/lib/schemes';

/** "Central scheme" in green ink, "State scheme" in the soft ink. Plain text, no pill. */
export function LevelBadge({ level }: { level: Scheme['level'] }) {
    return (
        <span className={`font-medium ${level === 'Central' ? 'text-accent' : 'text-fg'}`}>
            {level === 'Central' ? 'Central scheme' : 'State scheme'}
        </span>
    );
}

/** Which of the user's filters this scheme matches, phrased as facts from the listing. */
function matchNotes(scheme: Scheme, filters: SchemeFilters): string[] {
    const notes: string[] = [];
    if (filters.state) {
        notes.push(scheme.states.includes(filters.state) ? `Listed for ${filters.state}` : 'All-India scheme');
    }
    if (filters.category) notes.push(categoryLabel(filters.category));
    return notes;
}

const LINK =
    'inline-flex items-center gap-1.5 min-h-11 text-sm font-medium underline decoration-1 underline-offset-[5px] transition-[text-decoration-thickness,color] duration-200 hover:decoration-[3px]';

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
    const notes = matchNotes(scheme, filters);
    const otherCategories = scheme.categories.filter((c) => c !== filters.category).map(categoryLabel);
    const facts = [scheme.issuer, ...otherCategories].filter(Boolean);

    return (
        <article className="min-w-0">
            <Heading className="font-serif text-[length:clamp(1.25rem,1.1rem_+_0.6vw,1.5rem)] leading-[1.3] text-fg break-words text-pretty">
                <Link
                    href={`/services/${scheme.slug}`}
                    className="decoration-accent decoration-2 underline-offset-[6px] transition-colors duration-200 hover:underline hover:text-accent"
                >
                    {scheme.name}
                </Link>
            </Heading>

            <p className="mt-2 text-sm leading-relaxed text-muted break-words">
                <LevelBadge level={scheme.level} />
                {notes.length > 0 && (
                    <>
                        <span className="sr-only">. Matches your filters:</span>
                        {notes.map((n) => (
                            <span key={n}> · <span className="text-fg">{n}</span></span>
                        ))}
                    </>
                )}
                {facts.map((f, i) => (
                    <span key={i}> · {f}</span>
                ))}
            </p>

            {scheme.brief && (
                <p className="mt-3 max-w-[62ch] text-lg leading-[1.65] text-fg break-words">{scheme.brief}</p>
            )}

            <div className="mt-2 flex flex-wrap gap-x-7">
                <Link href={askHref(`Tell me about ${scheme.name}`)} className={`${LINK} text-fg decoration-accent hover:text-accent`}>
                    Ask InBridge about it
                </Link>
                {scheme.source && (
                    <a
                        href={scheme.source}
                        target="_blank"
                        rel="noopener noreferrer"
                        className={`${LINK} text-fg decoration-muted hover:text-accent hover:decoration-accent`}
                    >
                        Official page on myScheme
                        <ArrowUpRight size={16} aria-hidden="true" />
                        <span className="sr-only"> (opens in a new tab)</span>
                    </a>
                )}
            </div>
        </article>
    );
}
