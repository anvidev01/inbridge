/** Shapes shared by GET /api/schemes and the landing page's live search. Types only, safe for the client. */
import type { SchemeLevel } from '@/lib/schemes';

export interface ProbeItem {
    name: string;
    issuer: string;
    level: SchemeLevel;
    slug: string;
    /** myScheme page, or null when the record has none. */
    source: string | null;
}

export interface ProbeResponse {
    /** The search words actually used (a state named in the text is moved to `state`). */
    q: string;
    state: string | null;
    total: number;
    /** The text held no usable words (only "the", "schemes" and the like). */
    queryTooGeneral: boolean;
    items: ProbeItem[];
    /** /services link with the same search, for "see all". */
    href: string;
}
