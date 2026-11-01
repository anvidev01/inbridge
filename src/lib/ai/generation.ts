/**
 * What every provider adapter receives, and the shared generation settings.
 *
 * Adapters return an AsyncIterable of plain text deltas and *throw* on any
 * failure, including errors that only surface mid-stream. The router relies
 * on that to fail over (see router.ts).
 */

import type { ChatTurn } from './chat-request';

export interface ProviderInput {
    turns: ChatTurn[];
    system: string;
    signal?: AbortSignal;
}

export type ProviderStream = (input: ProviderInput) => AsyncIterable<string>;

/** Low temperature: answers should stick to the retrieved context. */
export const TEMPERATURE = 0.2;

/** Enough for a structured answer plus the follow-up JSON; override with CHAT_MAX_TOKENS. */
export function maxOutputTokens(): number {
    const parsed = parseInt(process.env.CHAT_MAX_TOKENS || '', 10);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : 1500;
}

export function abortError(): Error {
    const err = new Error('The operation was aborted.');
    err.name = 'AbortError';
    return err;
}

export function isAbortError(error: unknown, signal?: AbortSignal): boolean {
    if (signal?.aborted) return true;
    return error instanceof Error && (error.name === 'AbortError' || error.name === 'APIUserAbortError');
}
