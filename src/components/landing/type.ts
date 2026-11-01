/**
 * The landing page's type steps, as Tailwind class strings so the shared
 * header and footer can use them without a stylesheet. Six steps in all:
 * one figure size (the 4,739 and the footer wordmark), the display title,
 * the heading, the lead, the body and the small step for footnote markers
 * and credits. Nothing on the page is set outside these.
 */
export const T = {
    /** Figure: the headline number and the footer wordmark. */
    xl: 'font-serif font-medium text-[clamp(5rem,15vw,15rem)] leading-[0.82] tracking-[-0.05em]',
    /** Display: the page title and the split showcase heading. */
    d: 'font-serif font-medium text-[clamp(2.75rem,8vw,8rem)] leading-[0.92] tracking-[-0.045em]',
    /** Heading: section headings, FAQ questions, the stats claim. */
    h: 'font-serif font-medium text-[clamp(1.5rem,2.3vw,2.125rem)] leading-[1.12] tracking-[-0.02em]',
    /** Lead: the standfirst, the order sentences, names in the proof columns. */
    l: 'text-[1.125rem] md:text-[1.25rem] leading-[1.5]',
    /** Body: running text, links, buttons. */
    b: 'text-[1.0625rem] leading-[1.55]',
    /** Small: footnote markers, credits, legal line. Never below 14px. */
    s: 'text-[0.875rem] leading-[1.45]',
} as const;

/** The page margins, one pair at every width (20px phone, 32px from tablet up). */
export const MARGIN = 'px-5 md:px-8';

/** The one button shape on the site: filled, full-round, 48px tall. */
export const BUTTON =
    'inline-flex items-center justify-center min-h-12 rounded-full bg-accent px-6 font-medium text-accent-fg ' +
    'transition-[transform,opacity] duration-150 ease-out hover:opacity-90 active:scale-[0.97]';

/** A plain text link: underline appears on hover and focus. */
export const TEXT_LINK =
    'underline decoration-transparent decoration-[0.07em] underline-offset-[0.22em] transition-[text-decoration-color] duration-200 hover:decoration-current focus-visible:decoration-current';
