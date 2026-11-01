/**
 * The footnotes: the numbered list every [n] marker on the page links to,
 * set like the references at the end of a printed report.
 */
import Link from 'next/link';
import { SOURCE_LIST, sourceAnchor } from './sources';
import { MARGIN, T } from './type';

export function SourcesList() {
    return (
        <section aria-labelledby="sources-heading" className={`${MARGIN} py-28 md:py-36 lg:grid lg:grid-cols-[42%_1fr]`}>
            <h2 id="sources-heading" className={`${T.h} text-fg lg:pr-12`} data-reveal>
                Sources
            </h2>
            <ol className="mt-10 lg:mt-1 max-w-[68ch] space-y-7" data-reveal style={{ ['--reveal-i' as string]: 1 }}>
                {SOURCE_LIST.map((s) => {
                    const display = s.url.startsWith('/') ? `inbridge.in${s.url}` : s.url.replace(/^https:\/\/(www\.)?/, '').replace(/\/$/, '');
                    const linkClass =
                        'font-medium text-fg underline decoration-[0.07em] underline-offset-[0.22em] transition-colors hover:text-accent';
                    return (
                        <li
                            key={s.n}
                            id={sourceAnchor(s.n)}
                            className={`${T.b} grid grid-cols-[3rem_1fr] scroll-mt-24 target:[&>span:first-child]:bg-accent target:[&>span:first-child]:text-accent-fg`}
                        >
                            <span className="self-start justify-self-start rounded-full px-1.5 font-medium text-accent tabular-nums transition-colors">
                                [{s.n}]
                            </span>
                            <span>
                                {s.external ? (
                                    <a href={s.url} target="_blank" rel="noopener noreferrer" className={linkClass}>
                                        {s.title}
                                        <span className="sr-only"> (opens in a new tab)</span>
                                    </a>
                                ) : (
                                    <Link href={s.url} className={linkClass}>
                                        {s.title}
                                    </Link>
                                )}
                                <span className="block text-muted break-anywhere">{display}</span>
                                <span className="mt-1 block text-fg">{s.note}</span>
                            </span>
                        </li>
                    );
                })}
            </ol>
        </section>
    );
}
