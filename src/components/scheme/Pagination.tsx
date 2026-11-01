/** Previous and next pages for /services. Plain links, so it works without JS. */
import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import { servicesHref, type SchemeFilters } from '@/lib/schemes';

const LINK =
    'group inline-flex items-center gap-2 min-h-12 bg-surface px-5 text-sm font-medium text-fg transition-colors duration-200 hover:bg-surface-2 hover:text-accent';
const DISABLED = 'inline-flex items-center gap-2 min-h-12 px-5 text-sm text-muted';
const ARROW = 'transition-transform duration-200';

export function Pagination({ filters, page, totalPages }: { filters: SchemeFilters; page: number; totalPages: number }) {
    if (totalPages <= 1) return null;

    return (
        <nav aria-label="Pagination" className="mt-16 flex flex-wrap items-center justify-between gap-3">
            {page > 1 ? (
                <Link href={servicesHref(filters, page - 1)} rel="prev" className={LINK}>
                    <ArrowLeft size={16} aria-hidden="true" className={`${ARROW} group-hover:-translate-x-0.5`} /> Previous page
                </Link>
            ) : (
                <span className={DISABLED} aria-hidden="true"><ArrowLeft size={16} /> Previous page</span>
            )}

            <p className="text-sm text-muted tabular-nums text-center">
                Page {page.toLocaleString('en-IN')} of {totalPages.toLocaleString('en-IN')}
            </p>

            {page < totalPages ? (
                <Link href={servicesHref(filters, page + 1)} rel="next" className={LINK}>
                    Next page <ArrowRight size={16} aria-hidden="true" className={`${ARROW} group-hover:translate-x-0.5`} />
                </Link>
            ) : (
                <span className={DISABLED} aria-hidden="true">Next page <ArrowRight size={16} /></span>
            )}
        </nav>
    );
}
