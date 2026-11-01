/**
 * Shared contract between /api/chat (server) and the chat UI (client).
 *
 * Everything that is not answer prose travels as an AI SDK v6 data part rather
 * than being spliced into the text stream (the old ---SOURCES--- block leaked
 * into Copy, into the LLM history and into screen readers).
 *
 *  - Persistent parts (stay in message.parts):  data-sources, data-provenance, data-followups
 *  - Transient parts (delivered via useChat onData only): data-phase
 *  - Message metadata (message.metadata):         createdAt
 *
 * Both sides import from here; do not redefine these shapes elsewhere.
 */
import type { UIMessage } from 'ai';

// ── Request ───────────────────────────────────────────────────────────────

export const LANGUAGES = [
    { code: 'en', label: 'English', native: 'English', htmlLang: 'en-IN', speechLang: 'en-IN' },
    { code: 'hi', label: 'Hindi', native: 'हिन्दी', htmlLang: 'hi', speechLang: 'hi-IN' },
    { code: 'hinglish', label: 'Hinglish', native: 'Hinglish', htmlLang: 'hi-Latn', speechLang: 'en-IN' },
] as const;

export type Language = (typeof LANGUAGES)[number]['code'];

export function isLanguage(value: unknown): value is Language {
    return LANGUAGES.some((l) => l.code === value);
}

/** Chat modes. 'grievance' = guided complaint drafter that hands off to pgportal.gov.in. */
export const CHAT_MODES = ['default', 'grievance'] as const;
export type ChatMode = (typeof CHAT_MODES)[number];

export function isChatMode(value: unknown): value is ChatMode {
    return (CHAT_MODES as readonly unknown[]).includes(value);
}

/**
 * Focus = optional retrieval filter. Values are the exact myScheme category
 * strings present in vector_store metadata / myscheme_schemes.json (15 total).
 * 'all' means no filter.
 */
export const FOCUS_CATEGORIES = [
    'Social welfare & Empowerment',
    'Education & Learning',
    'Agriculture,Rural & Environment',
    'Business & Entrepreneurship',
    'Women and Child',
    'Skills & Employment',
    'Banking,Financial Services and Insurance',
    'Health & Wellness',
    'Sports & Culture',
    'Housing & Shelter',
    'Science, IT & Communications',
    'Transport & Infrastructure',
    'Travel & Tourism',
    'Utility & Sanitation',
    'Public Safety,Law & Justice',
] as const;

export type Focus = 'all' | (typeof FOCUS_CATEGORIES)[number];

export function isFocus(value: unknown): value is Focus {
    return value === 'all' || (FOCUS_CATEGORIES as readonly unknown[]).includes(value);
}

/** Body the client POSTs to /api/chat (in addition to `messages`, added by the transport). */
export interface ChatRequestExtras {
    language: Language;
    mode?: ChatMode;
    focus?: Focus;
}

// ── Response data parts ───────────────────────────────────────────────────

/** One retrieved source. `n` is the 1-based number the answer cites as [n]. */
export interface Citation {
    n: number;
    title: string;
    url: string;
    /** Hostname without "www.", e.g. "pmkisan.gov.in". */
    host: string;
    /** True only when host passes isGovUrl (.gov.in / .nic.in). */
    official: boolean;
}

/** Where the context came from. Mirrors RAGSource in observability/telemetry.ts. */
export type RetrievalSource = 'vector_store' | 'tavily_search' | 'llm_direct' | 'cache';

export interface Provenance {
    source: RetrievalSource;
    /** ISO timestamp of when this answer's context was retrieved (server clock). */
    retrievedAt: string;
    /** Human label for the dataset, e.g. "myScheme snapshot (Aug 2026)"; only set for vector_store. */
    datasetLabel?: string;
}

/** Real pipeline phases, emitted only when each phase actually happens. */
export type Phase = 'searching-dataset' | 'searching-gov' | 'reading' | 'writing';

export interface PhaseData {
    phase: Phase;
    /** For 'reading': number of sources being read. */
    count?: number;
}

export type InBridgeDataParts = {
    sources: Citation[];
    provenance: Provenance;
    followups: string[];
    phase: PhaseData;
};

export interface InBridgeMetadata {
    /** Epoch ms, set by the server on the 'start' chunk. */
    createdAt?: number;
}

export type InBridgeUIMessage = UIMessage<InBridgeMetadata, InBridgeDataParts>;

// ── Errors ────────────────────────────────────────────────────────────────

export type ChatErrorCode = 'rate_limited' | 'guardrail' | 'bad_request' | 'provider_unavailable' | 'server_error';

/** JSON body of every non-200 /api/chat response. `message` is safe to show users. */
export interface ChatErrorBody {
    code: ChatErrorCode;
    message: string;
}

// ── Helpers usable on both sides ──────────────────────────────────────────

/** Concatenated text parts of a message (no data parts). */
export function messageText(message: Pick<UIMessage, 'parts'>): string {
    return (message.parts ?? [])
        .filter((p): p is { type: 'text'; text: string } => p.type === 'text')
        .map((p) => p.text)
        .join('');
}

/** First data part of the given name, typed. */
export function dataPart<K extends keyof InBridgeDataParts>(
    message: InBridgeUIMessage,
    name: K
): InBridgeDataParts[K] | undefined {
    const part = (message.parts ?? []).find((p) => p.type === `data-${name}`) as
        | { data: InBridgeDataParts[K] }
        | undefined;
    return part?.data;
}
