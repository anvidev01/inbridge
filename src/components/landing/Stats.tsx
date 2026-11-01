/**
 * "Bars standing on the edge": one bar per myScheme category, heights from
 * the real per-category counts (computed on the server from the dataset),
 * the largest in green ink. Each bar links to that category in the
 * directory; hover or focus shows its name and count.
 */
import type { CSSProperties } from 'react';
import Link from 'next/link';
import type { FilterOption } from '@/lib/schemes';
import { servicesHref } from '@/lib/schemes';
import { Ref } from './Ref';
import { MARGIN, T } from './type';

const n = (v: number) => v.toLocaleString('en-IN');

/** "Agriculture, Rural & Environment" -> "Agriculture": the words before the first comma or "&". */
function shortLabel(label: string): string {
    return label.split(/,| & | and /)[0].trim();
}

export function Stats({ total, categories }: { total: number; categories: FilterOption[] }) {
    const ascending = [...categories].sort((a, b) => a.count - b.count);
    const max = Math.max(...categories.map((c) => c.count), 1);
    const top = new Set([...categories].sort((a, b) => b.count - a.count).slice(0, 3).map((c) => c.value));
    const largest = ascending[ascending.length - 1]?.value;
    const descending = [...ascending].reverse();

    return (
        <section aria-labelledby="stats-heading" className="bg-surface-2 pt-20 md:pt-24 overflow-hidden lg:min-h-[90svh] lg:flex lg:flex-col">
            <div className={`${MARGIN} lg:grid lg:grid-cols-[42%_1fr] lg:items-end`}>
                <h2 id="stats-heading" className="text-fg" data-reveal>
                    <span className={`${T.xl} block tabular-nums`}>{n(total)}</span>
                    <span className={`${T.h} mt-4 block`}>schemes across {categories.length} areas</span>
                </h2>
                <p className={`${T.b} mt-6 lg:mt-0 max-w-[48ch] text-fg`} data-reveal style={{ ['--reveal-i' as string]: 1 }}>
                    Counted from InBridge’s copy of the myScheme listing
                    <Ref to="myscheme" />, Central and State schemes together. A scheme can belong to more than one
                    area, so the bars add up to more than {n(total)}. Each bar opens that area in the directory.
                </p>
            </div>

            {/* Wide screens: bars standing on the bottom edge, edge to edge. */}
            <div data-ui className="mt-auto hidden lg:block pt-16">
                <ol
                    className="lp-bars"
                    data-reveal
                    aria-label="Schemes per area"
                    style={{ ['--bars' as string]: ascending.length } as CSSProperties}
                >
                    {ascending.map((c, i) => {
                        const accent = c.value === largest;
                        const style = { ['--v' as string]: c.count / max, ['--bar-i' as string]: i } as CSSProperties;
                        return (
                            <li key={c.value} className="h-full">
                                <Link
                                    href={servicesHref({ category: c.value })}
                                    className="lp-bar"
                                    data-side={i < ascending.length / 2 ? 'left' : 'right'}
                                    data-last={i === ascending.length - 1 ? '' : undefined}
                                    style={style}
                                    aria-label={`${c.label}: ${n(c.count)} schemes`}
                                >
                                    <span className={`lp-bar-fill ${accent ? 'bg-accent' : 'bg-muted/30'}`} />
                                    {top.has(c.value) ? (
                                        <span className="lp-bar-value px-1 text-fg transition-opacity" aria-hidden="true">
                                            <span className="block text-[20px] font-medium tabular-nums leading-tight">{n(c.count)}</span>
                                            <span className="block text-[14px] text-muted">{shortLabel(c.label)}</span>
                                        </span>
                                    ) : null}
                                    <span className="lp-bar-tip text-[14px] leading-snug" aria-hidden="true">
                                        <span className="block font-medium">{c.label}</span>
                                        <span className="block tabular-nums">{n(c.count)} schemes</span>
                                    </span>
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            </div>

            {/* Narrow screens: rows growing from the left edge, largest first. */}
            <div data-ui className="lg:hidden mt-12 pb-16">
                <ol className="lp-rows space-y-1.5" data-reveal aria-label="Schemes per area">
                    {descending.map((c, i) => {
                        const accent = c.value === largest;
                        const style = { ['--v' as string]: c.count / max, ['--bar-i' as string]: i } as CSSProperties;
                        return (
                            <li key={c.value}>
                                <Link
                                    href={servicesHref({ category: c.value })}
                                    className="group grid grid-cols-[1fr] gap-1 pr-5 md:pr-8 active:opacity-80"
                                    style={style}
                                >
                                    <span className="flex items-baseline justify-between gap-3 pl-5 md:pl-8 text-[14px] text-fg">
                                        <span className="group-hover:underline underline-offset-2">{c.label}</span>
                                        <span className="tabular-nums text-muted">{n(c.count)}</span>
                                    </span>
                                    <span className={`lp-row-fill block h-7 ${accent ? 'bg-accent' : 'bg-muted/30'}`} />
                                </Link>
                            </li>
                        );
                    })}
                </ol>
            </div>
        </section>
    );
}
