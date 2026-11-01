/**
 * Footer for the marketing / info pages. Carries the independence disclaimer
 * from lib/site.ts in English and Hindi.
 */
import Link from 'next/link';
import { DISCLAIMER } from '@/lib/site';

/** Public contact for now: GitHub issues on the repo (no email address has been supplied). */
export const CONTACT_URL = 'https://github.com/anvidev01/inbridge/issues';
export const REPO_URL = 'https://github.com/anvidev01/inbridge';

const LINKS = [
    { href: '/about', label: 'About' },
    { href: '/services', label: 'Browse schemes' },
    { href: '/privacy', label: 'Privacy' },
    { href: '/terms', label: 'Terms' },
];

export function SiteFooter() {
    return (
        <footer className="border-t border-line mt-24">
            <div className="mx-auto max-w-6xl px-4 sm:px-6 py-12 grid gap-10 md:grid-cols-[1fr_auto]">
                <div className="max-w-xl space-y-3">
                    <p className="font-serif text-xl text-fg">InBridge</p>
                    <p className="text-sm text-muted">{DISCLAIMER.en}</p>
                    <p lang="hi" className="text-sm text-muted">{DISCLAIMER.hi}</p>
                </div>
                <nav aria-label="Footer">
                    <ul className="flex flex-wrap gap-x-2 gap-y-1 md:flex-col md:items-end">
                        {LINKS.map((l) => (
                            <li key={l.href}>
                                <Link href={l.href} className="inline-flex items-center min-h-11 px-2 text-sm text-muted hover:text-fg">
                                    {l.label}
                                </Link>
                            </li>
                        ))}
                        <li>
                            <a
                                href={REPO_URL}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center min-h-11 px-2 text-sm text-muted hover:text-fg"
                            >
                                Contact (GitHub)
                                <span className="sr-only"> (opens in a new tab)</span>
                            </a>
                        </li>
                    </ul>
                </nav>
            </div>
        </footer>
    );
}
