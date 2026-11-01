/**
 * The editorial frame shared by the inner pages (/services, scheme pages,
 * /about, /privacy, /terms): a photographic masthead band, a text axis at 42%
 * of the width on desktop, five type steps and a credit line for every
 * photograph shown.
 *
 * Layout: on large screens each block is a two-column grid. The left column
 * (from the page margin to 42% of the viewport) holds standfirsts, section
 * titles and side notes; the right column, which starts exactly on the axis,
 * holds titles and running text. On phones the axis collapses to the margin.
 */
import type { CSSProperties, ReactNode } from 'react';
import Image from 'next/image';
import { SiteHeader } from './SiteHeader';
import { SiteFooter } from './SiteFooter';
import { Reveal } from './Reveal';
import { LogoMark } from './Logo';
import { PHOTOS, type PhotoKey } from '@/lib/photos';

/** One pair of page margins for every inner page. */
export const PAGE_X = 'px-5 sm:px-8 lg:px-12';

/** Two columns that meet on the axis (42vw). The left column absorbs the 3rem page margin. */
export const AXIS = 'lg:grid lg:grid-cols-[calc(42vw_-_3rem)_minmax(0,1fr)]';

/** The five type steps. Nothing on these pages is set at any other size. */
export const TYPE = {
    /** 14px: notes, meta lines, labels, credits */
    small: 'text-sm',
    /** 18px: running text */
    body: 'text-lg leading-[1.65]',
    /** 20 to 24px: standfirsts, scheme names in lists, sub-heads */
    lead: 'text-[length:clamp(1.25rem,1.1rem_+_0.6vw,1.5rem)] leading-[1.4]',
    /** 28 to 40px: section titles */
    head: 'text-[length:clamp(1.75rem,0.9rem_+_1.9vw,2.5rem)] leading-[1.1] tracking-[-0.02em]',
    /** 44 to 104px: page titles */
    display: 'text-[length:clamp(2.75rem,1rem_+_6.4vw,6.5rem)] leading-[0.95] tracking-[-0.035em]',
} as const;

/** Inline text link: full ink, green underline that thickens on hover. */
export const TEXT_LINK =
    'text-fg underline decoration-accent decoration-1 underline-offset-[5px] transition-[text-decoration-thickness,color] duration-200 hover:decoration-[3px] hover:text-accent';

/** The one filled button shape: full-round, as on the landing page and in the chat. */
export const BUTTON =
    'inline-flex items-center justify-center gap-2 min-h-12 rounded-full bg-accent px-6 text-lg font-medium text-accent-fg transition-[filter,transform] duration-200 hover:brightness-110 active:translate-y-px';

const revealStyle = (i: number) => ({ '--reveal-i': i }) as CSSProperties;

type Cell =
    | { kind: 'photo'; slot: 0 | 1 | 2 | 3; className: string }
    | { kind: 'tile'; tone: 'accent' | 'ink' | 'step'; mark?: boolean; className: string };

/**
 * "mosaic": six columns by two rows on tablet and up (four photographs, four
 * flat tiles); three by two on a phone (two photographs, two tiles).
 */
const MOSAIC: Cell[] = [
    { kind: 'photo', slot: 0, className: 'col-span-2 col-start-1 row-start-1' },
    { kind: 'tile', tone: 'accent', mark: true, className: 'col-start-3 row-span-2 row-start-1' },
    { kind: 'photo', slot: 1, className: 'col-start-2 row-start-2 sm:col-start-4 sm:row-start-1' },
    { kind: 'tile', tone: 'ink', className: 'col-start-1 row-start-2' },
    { kind: 'tile', tone: 'step', className: 'hidden sm:block sm:col-start-5 sm:row-start-1' },
    { kind: 'photo', slot: 2, className: 'hidden sm:block sm:col-start-6 sm:row-span-2 sm:row-start-1' },
    { kind: 'photo', slot: 3, className: 'hidden sm:block sm:col-start-2 sm:row-start-2' },
    { kind: 'tile', tone: 'step', className: 'hidden sm:block sm:col-span-2 sm:col-start-4 sm:row-start-2' },
];

/**
 * "lead": one photograph takes two thirds of a taller band, the other three
 * and one green tile fill the rest. Used where the title is long and set
 * smaller, so the picture carries the first screen.
 */
const LEAD: Cell[] = [
    { kind: 'photo', slot: 0, className: 'col-span-2 row-span-2 col-start-1 row-start-1 sm:col-span-4' },
    { kind: 'tile', tone: 'accent', mark: true, className: 'col-start-3 row-start-1 sm:col-start-6' },
    { kind: 'photo', slot: 1, className: 'col-start-3 row-start-2 sm:col-start-5 sm:row-start-1' },
    { kind: 'photo', slot: 2, className: 'hidden sm:block sm:col-start-5 sm:row-start-2' },
    { kind: 'photo', slot: 3, className: 'hidden sm:block sm:col-start-6 sm:row-start-2' },
];

const BAND_HEIGHT = {
    mosaic: 'h-[30svh] min-h-52 max-h-[440px] sm:h-[36svh] lg:h-[40svh]',
    lead: 'h-[34svh] min-h-56 max-h-[560px] sm:h-[48svh] lg:h-[50svh]',
} as const;

export type MastheadPhotos = readonly [PhotoKey, PhotoKey, PhotoKey, PhotoKey];

/**
 * A gutterless band of photographs and flat colour across the top of the page.
 * The photographs show public life in India; credit them with <PhotoCredits/>.
 */
export function Masthead({ photos, variant = 'mosaic', quiet = false }: { photos: MastheadPhotos; variant?: 'mosaic' | 'lead'; quiet?: boolean }) {
    const cells = variant === 'lead' ? LEAD : MOSAIC;
    // Flat tiles are solid print blocks: green ink carrying the mark, full ink,
    // and a tone step. "quiet" (legal pages) keeps the green for the one action.
    const tone = { accent: quiet ? 'bg-fg text-bg' : 'bg-accent text-accent-fg', ink: 'bg-fg', step: 'bg-surface-2' } as const;
    return (
        <div className={`grid grid-cols-3 grid-rows-2 sm:grid-cols-6 ${BAND_HEIGHT[variant]}`}>
            {cells.map((cell, i) => {
                if (cell.kind === 'tile') {
                    return (
                        <div key={i} aria-hidden="true" className={`${tone[cell.tone]} ${cell.className} flex items-end p-4 sm:p-5`}>
                            {cell.mark && <LogoMark size={40} className="[&_circle]:fill-current" />}
                        </div>
                    );
                }
                const photo = PHOTOS[photos[cell.slot]];
                return (
                    <div key={i} className={`relative overflow-hidden bg-surface ${cell.className}`}>
                        <Image
                            src={photo.src}
                            alt={photo.alt}
                            fill
                            priority={cell.slot === 0}
                            sizes={cell.slot === 0 ? (variant === 'lead' ? '(min-width: 640px) 67vw, 67vw' : '(min-width: 640px) 34vw, 67vw') : '(min-width: 640px) 17vw, 34vw'}
                            className="object-cover grayscale contrast-[1.05]"
                        />
                    </div>
                );
            })}
        </div>
    );
}

/**
 * Credit line for the photographs a page shows: author linked to the file page,
 * and the licence. Required wherever a photo appears.
 */
export function PhotoCredits({ photos }: { photos: readonly PhotoKey[] }) {
    const unique = [...new Set(photos)];
    return (
        <p className={`${TYPE.small} text-muted max-w-[72ch]`}>
            Photographs of public life in India, from Wikimedia Commons, by{' '}
            {unique.map((key, i) => {
                const p = PHOTOS[key];
                return (
                    <span key={key}>
                        <a href={p.page} target="_blank" rel="noopener noreferrer" title={p.title} className="underline underline-offset-4 transition-colors hover:text-fg">
                            {p.creator}
                        </a>{' '}
                        (<a href={p.licenseUrl} target="_blank" rel="noopener noreferrer" className="underline underline-offset-4 transition-colors hover:text-fg">{p.license}</a>)
                        {i < unique.length - 1 ? ', ' : '.'}
                    </span>
                );
            })}
        </p>
    );
}

/** Long-form text styles: real lists, serif sub-heads, a 65ch measure. */
export const PROSE = [
    `${TYPE.body} text-fg max-w-[65ch]`,
    '[&>*:first-child]:mt-0',
    `[&_h3]:mt-12 [&_h3]:font-serif [&_h3]:text-[length:clamp(1.25rem,1.1rem_+_0.6vw,1.5rem)] [&_h3]:leading-[1.3] [&_h3]:text-fg`,
    '[&_p]:mt-5 [&_ul]:mt-5 [&_ul]:space-y-3 [&_ul]:pl-6 [&_ul]:list-disc [&_ul]:marker:text-accent',
    '[&_li]:pl-1',
    '[&_a]:text-fg [&_a]:underline [&_a]:decoration-accent [&_a]:underline-offset-[5px] [&_a]:break-words [&_a]:transition-colors [&_a:hover]:text-accent',
    '[&_strong]:font-semibold',
    '[&_code]:bg-surface-2 [&_code]:px-1.5 [&_code]:py-0.5 [&_code]:break-words',
].join(' ');

/**
 * One section of a long-form page: its title in the left column, its text on
 * the axis. Give each a stable id so it can be linked to.
 */
export function InfoSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
    return (
        <section aria-labelledby={id} className={`${AXIS} mt-16 sm:mt-24 pt-3 scroll-mt-8`}>
            <h2 id={id} data-reveal className={`font-serif ${TYPE.head} text-fg lg:pr-16`}>
                {title}
            </h2>
            <div data-reveal style={revealStyle(1)} className={`${PROSE} mt-6 lg:mt-1.5`}>
                {children}
            </div>
        </section>
    );
}

/**
 * A full-bleed field one tone off the ground, holding a run of short
 * sections (the closing clauses of a legal page) so they read as one page of
 * colour rather than scattered lines on empty ground.
 */
export function InfoBand({ children }: { children: ReactNode }) {
    return (
        <div className="-mx-5 sm:-mx-8 lg:-mx-12 mt-20 sm:mt-28 bg-surface [[data-theme=light]_&]:bg-surface-2 px-5 sm:px-8 lg:px-12 pb-20 sm:pb-24 pt-1 [&_code]:bg-bg">
            {children}
        </div>
    );
}

export function InfoPage({
    title,
    intro,
    updated,
    current,
    photos,
    masthead = 'mosaic',
    quiet = false,
    children,
}: {
    title: string;
    /** The standfirst: one to three plain sentences. */
    intro?: ReactNode;
    /** e.g. "1 November 2026" */
    updated?: string;
    current?: 'about';
    /** Four photographs for the masthead, the first shown largest. */
    photos: MastheadPhotos;
    /** Masthead variant; legal pages use 'lead' with a quiet (no green) tile. */
    masthead?: 'mosaic' | 'lead';
    quiet?: boolean;
    /** <InfoSection/> blocks. */
    children: ReactNode;
}) {
    return (
        <>
            <SiteHeader current={current} />
            <Reveal />
            <main id="main-content">
                <Masthead photos={photos} variant={masthead} quiet={quiet} />
                <div className={PAGE_X}>
                    <header className={`${AXIS} pt-12 sm:pt-16 lg:pt-24`}>
                        <div className="lg:col-start-2 lg:row-start-1">
                            <h1 className={`font-serif ${TYPE.display} text-fg text-balance`}>
                                <span className="line-mask"><span>{title}</span></span>
                            </h1>
                            {updated && <p className={`mt-6 ${TYPE.small} text-muted`}>Last updated {updated}</p>}
                        </div>
                        {intro && (
                            <div className={`mt-8 lg:mt-2 lg:col-start-1 lg:row-start-1 lg:pr-16 max-w-[36ch] ${TYPE.lead} text-fg`}>
                                {intro}
                            </div>
                        )}
                    </header>

                    {children}

                    <div className={`${AXIS} mt-24 sm:mt-32`}>
                        <div className="lg:col-start-2">
                            <PhotoCredits photos={photos} />
                        </div>
                    </div>
                </div>
            </main>
            <SiteFooter />
        </>
    );
}
