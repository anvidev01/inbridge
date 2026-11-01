/**
 * Search and filter form for /services. A plain GET form (no JS needed); the
 * page re-renders on the server from the query string. Option lists and
 * counts come from the dataset via getFilterOptions(). Set as one filled
 * panel a tone off the ground, fields one tone further, no outlines.
 */
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { FilterOption, SchemeFilterOptions, SchemeFilters as Filters } from '@/lib/schemes';

const FIELD =
    'w-full min-h-12 bg-bg px-4 text-lg text-fg transition-colors duration-200 hover:bg-surface-2 focus-visible:bg-surface-2';
const LABEL = 'block text-sm font-medium text-fg mb-2';

function Select({
    id, name, label, anyLabel, options, value,
}: {
    id: string; name: string; label: string; anyLabel: string; options: FilterOption[]; value?: string;
}) {
    return (
        <div className="min-w-0">
            <label htmlFor={id} className={LABEL}>{label}</label>
            <select id={id} name={name} defaultValue={value ?? ''} className={FIELD}>
                <option value="">{anyLabel}</option>
                {options.map((o) => (
                    <option key={o.value} value={o.value}>
                        {o.label} ({o.count.toLocaleString('en-IN')})
                    </option>
                ))}
            </select>
        </div>
    );
}

export function SchemeFilters({
    options,
    filters,
    headingId = 'filters-heading',
}: {
    options: SchemeFilterOptions;
    filters: Filters;
    /** id of the visible heading inside the panel, for aria-labelledby. */
    headingId?: string;
}) {
    const active = Boolean(filters.q || filters.state || filters.category || filters.level || filters.audience);

    return (
        <form action="/services" method="get" role="search" aria-labelledby={headingId} className="bg-surface p-6 sm:p-8">
            <h2 id={headingId} className="font-serif text-[length:clamp(1.25rem,1.1rem_+_0.6vw,1.5rem)] leading-[1.3] text-fg">
                Search and filter
            </h2>

            <label htmlFor="scheme-q" className={`${LABEL} mt-6`}>Name, keyword or department</label>
            <div className="relative">
                <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-4 top-1/2 -translate-y-1/2 text-muted" />
                <input
                    id="scheme-q"
                    name="q"
                    type="search"
                    defaultValue={filters.q ?? ''}
                    maxLength={120}
                    placeholder="scholarship, pension, PM-KISAN"
                    className={`${FIELD} pl-11 placeholder:text-muted`}
                />
            </div>

            <div className="mt-5 grid gap-5 sm:grid-cols-2">
                <Select id="f-state" name="state" label="State or UT" anyLabel="Any state" options={options.states} value={filters.state} />
                <Select id="f-category" name="category" label="Area" anyLabel="Any area" options={options.categories} value={filters.category} />
                <Select id="f-level" name="level" label="Central or State" anyLabel="Both" options={options.levels} value={filters.level} />
                <Select id="f-for" name="for" label="Who it's for" anyLabel="Anyone" options={options.audiences} value={filters.audience} />
            </div>

            <p className="mt-5 text-sm leading-relaxed text-muted">
                Numbers in brackets count the schemes listed under each option in the whole dataset. Choosing a state
                also adds all-India Central schemes.
            </p>

            <div className="mt-6 flex flex-wrap items-center gap-x-6 gap-y-3">
                <button
                    type="submit"
                    className="inline-flex items-center justify-center min-h-12 bg-accent px-6 text-lg font-medium text-accent-fg transition-[filter,transform] duration-200 hover:brightness-110 active:translate-y-px"
                >
                    Show schemes
                </button>
                {active && (
                    <Link
                        href="/services"
                        className="inline-flex items-center min-h-11 text-sm font-medium text-fg underline decoration-muted underline-offset-[5px] transition-colors duration-200 hover:text-accent hover:decoration-accent"
                    >
                        Clear filters
                    </Link>
                )}
            </div>
        </form>
    );
}
