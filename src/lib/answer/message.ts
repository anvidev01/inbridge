/** Per-message facts for answer rendering. */
import type { ChatMode, InBridgeUIMessage, Language } from '../chat/protocol';
import { dataPart } from '../chat/protocol';

/**
 * Mode and language the answer was generated in. The server stamps them in
 * message metadata; the current UI values are only a fallback (older messages,
 * or a server that does not send them yet), so switching the UI toggle does
 * not relabel or re-gate earlier answers.
 */
export function answerContext(
    message: Pick<InBridgeUIMessage, 'metadata'>,
    fallback: { mode: ChatMode; language: Language }
): { mode: ChatMode; language: Language } {
    return {
        mode: message.metadata?.mode ?? fallback.mode,
        language: message.metadata?.language ?? fallback.language,
    };
}

/**
 * True when the last answer ended without its data-followups part. The server
 * writes data-followups (model-provided, or a fixed fallback set) on every
 * completed answer, so its absence means the stream ended early (Stop pressed,
 * or an error mid-answer). Requires metadata.createdAt (set on the 'start'
 * chunk) so messages saved before that protocol never get the mark.
 */
export function isStoppedAnswer(
    message: InBridgeUIMessage,
    opts: { isLast: boolean; isStreaming: boolean; hasText: boolean }
): boolean {
    if (!opts.isLast || opts.isStreaming || !opts.hasText) return false;
    if (message.role !== 'assistant' || message.metadata?.createdAt === undefined) return false;
    return dataPart(message, 'followups') === undefined;
}
