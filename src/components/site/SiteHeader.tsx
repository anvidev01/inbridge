/**
 * Header for the marketing / info pages (/, /services, /about, /privacy, /terms).
 * The chat has its own header inside ChatShell.
 */
import Link from 'next/link';
import { ThemeToggle } from '@/components/ui/ThemeToggle';

type NavKey = 'chat' | 'services' | 'about';

const NAV: { key: NavKey; href: string; label: string; short: string }[] = [
    { key: 'chat', href: '/chat', label: 'Chat', short: 'Chat' },
    { key: 'services', href: '/services', label: 'Browse schemes', short: 'Schemes' },
    { key: 'about', href: '/about', label: 'About', short: 'About' },
];

export function SiteHeader({ current }: { current?: NavKey }) {
    return (
        <header className="border-b border-line">
            <div className="mx-auto flex max-w-6xl items-center justify-between gap-2 px-4 sm:px-6 h-16">
                <Link
                    href="/"
                    className="font-serif text-xl sm:text-2xl tracking-tight text-fg min-h-11 inline-flex items-center"
                    aria-label="InBridge home"
                >
                    InBridge
                </Link>
                <nav aria-label="Main" className="flex items-center">
                    <ul className="flex items-center">
                        {NAV.map((item) => (
                            // Below 360px "About" moves to the footer only, so the bar never scrolls sideways.
                            <li key={item.key} className={item.key === 'about' ? 'hidden min-[360px]:block' : undefined}>
                                <Link
                                    href={item.href}
                                    aria-current={current === item.key ? 'page' : undefined}
                                    className={`inline-flex items-center min-h-11 px-1.5 sm:px-3 text-sm transition-colors ${current === item.key ? 'text-fg' : 'text-muted hover:text-fg'}`}
                                >
                                    <span className="sm:hidden">{item.short}</span>
                                    <span className="hidden sm:inline">{item.label}</span>
                                </Link>
                            </li>
                        ))}
                    </ul>
                    <ThemeToggle className="ml-1" />
                </nav>
            </div>
        </header>
    );
}
