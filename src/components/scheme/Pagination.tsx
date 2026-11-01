/** Previous / next pagination for /services. Plain links, so it works without JS. */
import Link from 'next/link';
import { ChevronLeft, ChevronRight } from 'lucide-react';
import { servicesHref, type SchemeFilters } from '@/lib/schemes';

const LINK = 'inline-flex items-center gap-1 min-h-11 rounded-lg border border-line px-3 sm:px-4 text-sm text-fg hover:bg-surface-2';
const DISABLED = 'inline-flex items-center gap-1 min-h-11 rounded-lg border border-line px-3 sm:px-4 text-sm text-muted opacity-60';

export function Pagination({ filters, page, totalPages }: { filters: SchemeFilters; page: number; totalPages: number }) {
    if (totalPages <= 1) return null;

    return (
        <nav aria-label="Pagination" className="mt-10 flex items-center justify-between gap-3">
            {page > 1 ? (
                <Link href={servicesHref(filters, page - 1)} rel="prev" className={LINK}>
                    <ChevronLeft size={16} aria-hidden="true" /> Previous
                </Link>
            ) : (
                <span className={DISABLED} aria-hidden="true"><ChevronLeft size={16} /> Previous</span>
            )}

            <p className="text-sm text-muted tabular-nums text-center">
                <span className="hidden sm:inline">Page </span>{page.toLocaleString('en-IN')} of {totalPages.toLocaleString('en-IN')}
            </p>

            {page < totalPages ? (
                <Link href={servicesHref(filters, page + 1)} rel="next" className={LINK}>
                    Next <ChevronRight size={16} aria-hidden="true" />
                </Link>
            ) : (
                <span className={DISABLED} aria-hidden="true">Next <ChevronRight size={16} /></span>
            )}
        </nav>
    );
}
