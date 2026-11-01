/**
 * The landing page's footnotes. Every factual claim on "/" carries a
 * superscript marker that links to one of these, listed in order under
 * "Sources" near the foot of the page. Numbers are fixed here so the
 * markers and the list can never disagree.
 */
import { REPO_URL } from '@/components/site/SiteFooter';
import { DATASET_LABEL, getScheme } from '@/lib/schemes';

export interface Source {
    n: number;
    /** What the source is, as a reader would name it. */
    title: string;
    url: string;
    /** What on the landing page it supports. */
    note: string;
    external: boolean;
}

const PM_KISAN_URL = getScheme('pm-kisan')?.source ?? 'https://www.myscheme.gov.in/schemes/pm-kisan';

export const SOURCES = {
    myscheme: {
        n: 1,
        title: 'myScheme, the national platform for government schemes',
        url: 'https://www.myscheme.gov.in/',
        note: `InBridge holds a copy of this public listing (${DATASET_LABEL}). Every scheme count on this page is computed from that copy.`,
        external: true,
    },
    search: {
        n: 2,
        title: 'How InBridge works',
        url: '/about',
        note: 'Live search is limited to .gov.in and .nic.in websites, and each result is checked again on the server before the AI model reads it. The same page states that InBridge is not affiliated with, endorsed by or run on behalf of any government body, and that it answers in English, Hindi and Hinglish.',
        external: false,
    },
    pmkisan: {
        n: 3,
        title: 'Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) on myScheme',
        url: PM_KISAN_URL,
        note: 'The record behind the source card shown under “From question to source”.',
        external: true,
    },
    cpgrams: {
        n: 4,
        title: 'CPGRAMS, the public grievance portal of the Government of India',
        url: 'https://pgportal.gov.in/',
        note: 'Where InBridge sends you to submit a complaint it has helped you draft.',
        external: true,
    },
    privacy: {
        n: 5,
        title: 'Your data on InBridge (privacy notice)',
        url: '/privacy',
        note: 'What is kept, where, and for how long, including chat history held only in your browser and identity numbers blocked before they reach the AI model.',
        external: false,
    },
    code: {
        n: 6,
        title: 'InBridge source code on GitHub',
        url: REPO_URL,
        note: 'The languages InBridge answers in and the rules it gives the AI model are in the open code.',
        external: true,
    },
} satisfies Record<string, Source>;

export type SourceKey = keyof typeof SOURCES;

export const SOURCE_LIST: Source[] = Object.values(SOURCES).sort((a, b) => a.n - b.n);

export function sourceAnchor(n: number): string {
    return `source-${n}`;
}
