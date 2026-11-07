/**
 * Header for the marketing / info pages (/, /services, /about, /privacy, /terms).
 * A plain bar: the logo, three links, the theme switch and one action. No
 * border: the page below separates itself by space or by its own ground.
 * The chat has its own header inside ChatShell.
 */
import Link from 'next/link';
import { Logo } from '@/components/site/Logo';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

type NavKey = 'chat' | 'services' | 'forms' | 'about';

const NAV: { key: NavKey; href: string; label: string; short: string }[] = [
    { key: 'chat', href: '/chat', label: 'Chat', short: 'Chat' },
    { key: 'services', href: '/services', label: 'Browse schemes', short: 'Schemes' },
    { key: 'forms', href: '/forms', label: 'Fill a form', short: 'Forms' },
    { key: 'about', href: '/about', label: 'About', short: 'About' },
];

interface SiteHeaderProps {
    current?: NavKey;
    /**
     * The landing page's margins (its hero already carries the filled
     * "Ask InBridge" button, so here the action is a text link). By default
     * the bar uses the info pages' margins and a filled action.
     */
    wide?: boolean;
}

export function SiteHeader({ current, wide = false }: SiteHeaderProps) {
    // Same outer margins as the page content (PAGE_X in InfoPage.tsx / the landing
    // page's own), so header, content and footer share one pair of edges.
    const frame = wide ? 'px-5 md:px-8' : 'px-5 sm:px-8 lg:px-12';
    return (
        <header>
            <div className={`${frame} flex h-16 md:h-[4.5rem] items-center justify-between gap-2`}>
                <Link
                    href="/"
                    className="inline-flex min-h-11 items-center text-fg transition-opacity hover:opacity-80"
                    aria-label="InBridge home"
                >
                    <Logo />
                </Link>
                <nav aria-label="Main" className="flex items-center">
                    <ul className="flex items-center">
                        {NAV.map((item) => (
                            // Below 420px "About" lives in the footer only, so the bar stays one row.
                            <li key={item.key} className={item.key === 'about' ? 'hidden min-[420px]:block' : undefined}>
                                <Link
                                    href={item.href}
                                    aria-current={current === item.key ? 'page' : undefined}
                                    className={`inline-flex min-h-11 items-center px-2 sm:px-3 text-[1.0625rem] underline-offset-[0.3em] decoration-[0.07em] transition-colors hover:text-fg hover:underline ${current === item.key ? 'text-fg underline' : 'text-muted'}`}
                                >
                                    <span className="sm:hidden">{item.short}</span>
                                    <span className="hidden sm:inline">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <ThemeToggle className="ml-1" />
                    <Link
                        href="/chat"
                        className={wide
                            ? 'ml-2 hidden md:inline-flex min-h-11 items-center px-3 text-[1.0625rem] font-medium text-accent underline-offset-[0.3em] decoration-[0.07em] hover:underline'
                            : 'ml-3 hidden md:inline-flex min-h-11 items-center rounded-full bg-accent px-5 text-[1.0625rem] font-medium text-accent-fg transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.97]'}
                    >
                        Ask InBridge
                    </Link>
                </nav>
            </div>
        </header>
    );
}
