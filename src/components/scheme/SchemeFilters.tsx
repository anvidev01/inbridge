/**
 * Search + filter form for /services. A plain GET form (no JS needed); the
 * page re-renders on the server from the query string. Option lists and
 * counts come from the dataset via getFilterOptions().
 */
import Link from 'next/link';
import { Search } from 'lucide-react';
import type { FilterOption, SchemeFilterOptions, SchemeFilters as Filters } from '@/lib/schemes';

const FIELD = 'w-full min-h-11 rounded-lg border border-line bg-surface px-3 text-base text-fg';
const LABEL = 'block text-sm font-medium text-fg mb-1.5';

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

export function SchemeFilters({ options, filters }: { options: SchemeFilterOptions; filters: Filters }) {
    const active = Boolean(filters.q || filters.state || filters.category || filters.level || filters.audience);

    return (
        <form action="/services" method="get" role="search" aria-label="Find schemes" className="rounded-lg border border-line bg-surface p-4 sm:p-6">
            <label htmlFor="scheme-q" className={LABEL}>Search by name, keyword or department</label>
            <div className="relative">
                <Search size={18} aria-hidden="true" className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
                <input
                    id="scheme-q"
                    name="q"
                    type="search"
                    defaultValue={filters.q ?? ''}
                    maxLength={120}
                    placeholder="e.g. scholarship, pension, PM-KISAN"
                    className={`${FIELD} pl-10`}
                />
            </div>

            <div className="mt-4 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                <Select id="f-state" name="state" label="State / UT" anyLabel="Any state" options={options.states} value={filters.state} />
                <Select id="f-category" name="category" label="Area" anyLabel="Any area" options={options.categories} value={filters.category} />
                <Select id="f-level" name="level" label="Central or State" anyLabel="Both" options={options.levels} value={filters.level} />
                <Select id="f-for" name="for" label="Who it's for" anyLabel="Anyone" options={options.audiences} value={filters.audience} />
            </div>

            <p className="mt-3 text-xs text-muted">
                Numbers in brackets count schemes listed under each option in the whole dataset. Choosing a state also adds all-India Central schemes.
            </p>

            <div className="mt-5 flex flex-wrap items-center gap-3">
                <button type="submit" className="inline-flex items-center justify-center min-h-11 rounded-lg bg-accent px-5 text-sm font-medium text-accent-fg">
                    Show schemes
                </button>
                {active && (
                    <Link href="/services" className="inline-flex items-center min-h-11 px-2 text-sm text-muted hover:text-fg underline-offset-4 hover:underline">
                        Clear filters
                    </Link>
                )}
            </div>
        </form>
    );
}
