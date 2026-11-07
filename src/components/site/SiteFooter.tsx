/**
 * Footer for the marketing / info pages. The name opens it at full size,
 * then the links, the independence disclaimer from lib/site.ts in English
 * and Hindi, and (when a page shows photographs) the credit line for
 * exactly the photographs that page uses.
 */
import Link from 'next/link';
import { DISCLAIMER } from '@/lib/site';
import { PHOTOS, type PhotoKey } from '@/lib/photos';

/** Public contact for now: GitHub issues on the repo (no email address has been supplied). */
export const CONTACT_URL = 'https://github.com/anvidev01/inbridge/issues';
export const REPO_URL = 'https://github.com/anvidev01/inbridge';

const MAIN_LINKS = [
    { href: '/chat', label: 'Chat' },
    { href: '/services', label: 'Browse schemes' },
    { href: '/forms', label: 'Fill a form' },
    { href: '/about', label: 'About' },
];

const SMALL_LINKS = [
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
];

const EXTERNAL_LINKS = [
    { href: REPO_URL, label: 'GitHub' },
    { href: CONTACT_URL, label: 'Report a problem' },
];

interface SiteFooterProps {
    /** Photographs shown on the page; each gets a credit line. Order is kept. */
    credits?: PhotoKey[];
    /** Full-width footer on the page margins (the landing page). */
    wide?: boolean;
}

const LINK =
    'inline-flex min-h-11 items-center text-fg underline decoration-transparent decoration-[0.07em] underline-offset-[0.22em] transition-[text-decoration-color] duration-200 hover:decoration-current';

export function SiteFooter({ credits = [], wide = false }: SiteFooterProps) {
    // Same outer margins as the page content (PAGE_X in InfoPage.tsx / the landing
    // page's own), so header, content and footer share one pair of edges.
    const frame = wide ? 'px-5 md:px-8' : 'px-5 sm:px-8 lg:px-12';
    const photos = [...new Set(credits)].map((key) => PHOTOS[key]);

    return (
        <footer className={`bg-surface ${wide ? '' : 'mt-24'}`}>
            <div className={`${frame} pt-16 md:pt-24 pb-10`}>
                <p className="font-serif font-medium text-[clamp(5rem,15vw,15rem)] leading-[0.82] tracking-[-0.05em] text-fg" aria-hidden="true">
                    InBridge
                </p>

                <div className="mt-14 md:mt-20 grid gap-12 md:grid-cols-12">
                    <nav aria-label="Footer" className="md:col-span-5">
                        <ul>
                            {MAIN_LINKS.map((l) => (
                                <li key={l.href}>
                                    <Link href={l.href} className={`${LINK} font-serif font-medium text-[clamp(1.5rem,2.3vw,2.125rem)] leading-[1.12] tracking-[-0.02em]`}>
                                        {l.label}
                                    </Link>
                                </li>
                            ))}
                        </ul>
                        <ul className="mt-6 flex flex-wrap gap-x-6">
                            {SMALL_LINKS.map((l) => (
                                <li key={l.href}>
                                    <Link href={l.href} className={`${LINK} text-[1.0625rem]`}>{l.label}</Link>
                                </li>
                            ))}
                            {EXTERNAL_LINKS.map((l) => (
                                <li key={l.href}>
                                    <a href={l.href} target="_blank" rel="noopener noreferrer" className={`${LINK} text-[1.0625rem]`}>
                                        {l.label}
                                        <span className="sr-only"> (opens in a new tab)</span>
                                    </a>
                                </li>
                            ))}
                        </ul>
                    </nav>

                    <div className="md:col-span-6 md:col-start-7 max-w-[62ch] space-y-4 text-[1.0625rem] leading-[1.55] text-fg">
                        <p>{DISCLAIMER.en}</p>
                        <p lang="hi">{DISCLAIMER.hi}</p>
                    </div>
                </div>

                {photos.length > 0 && (
                    <p className="mt-14 max-w-[110ch] text-[0.875rem] leading-[1.6] text-muted">
                        Photographs, all from Wikimedia Commons, shown in black and white:{' '}
                        {photos.map((p, i) => (
                            <span key={p.src}>
                                <a href={p.page} target="_blank" rel="noopener noreferrer" className="text-fg underline underline-offset-2 hover:text-accent">
                                    {p.title}
                                </a>{' '}
                                by {p.creator},{' '}
                                <a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-2 hover:text-fg">
                                    {p.license}
                                </a>
                                {i < photos.length - 1 ? '; ' : '.'}
                            </span>
                        ))}
                    </p>
                )}

                <p className="mt-10 flex flex-wrap items-center justify-between gap-4 text-[0.875rem] text-muted">
                    <span>InBridge is independent and open source.</span>
                    <a href="#main-content" className="inline-flex min-h-11 items-center underline-offset-2 hover:text-fg hover:underline">
                        Back to top
                    </a>
                </p>
            </div>
        </footer>
    );
}
