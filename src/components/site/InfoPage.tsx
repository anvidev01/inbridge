/**
 * Shared shell for long-form info pages (/about, /privacy, /terms):
 * site header, a readable single column, consistent heading and list styles,
 * and the site footer.
 */
import type { ReactNode } from 'react';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';

export function InfoPage({
    eyebrow,
    title,
    intro,
    updated,
    current,
    children,
}: {
    eyebrow?: string;
    title: string;
    intro?: ReactNode;
    /** e.g. "1 November 2026" */
    updated?: string;
    current?: 'about';
    children: ReactNode;
}) {
    return (
        <>
            <SiteHeader current={current} />
            <main id="main-content" className="mx-auto max-w-3xl px-4 sm:px-6 pt-12 sm:pt-20">
                <header className="border-b border-line pb-10">
                    {eyebrow && <p className="text-sm text-muted">{eyebrow}</p>}
                    <h1 className="mt-3 font-serif text-4xl sm:text-5xl leading-tight tracking-tight text-fg">{title}</h1>
                    {intro && <div className="mt-5 text-lg leading-relaxed text-muted">{intro}</div>}
                    {updated && <p className="mt-6 text-sm text-muted">Last updated: {updated}</p>}
                </header>
                <div
                    className={[
                        'pt-4 text-base leading-[1.75] text-fg',
                        '[&_h2]:mt-12 [&_h2]:font-serif [&_h2]:text-2xl [&_h2]:leading-snug [&_h2]:text-fg',
                        '[&_h3]:mt-8 [&_h3]:text-base [&_h3]:font-semibold [&_h3]:text-fg',
                        '[&_p]:mt-4 [&_ul]:mt-4 [&_ul]:space-y-2 [&_ul]:pl-5 [&_ul]:list-disc [&_ul]:marker:text-muted',
                        '[&_a]:text-accent [&_a]:underline [&_a]:underline-offset-4 [&_a]:break-words',
                        '[&_strong]:font-semibold',
                    ].join(' ')}
                >
                    {children}
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
