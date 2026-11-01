/**
 * Read-aloud helpers: turn an answer into speakable text and pick a voice.
 */
import { stripCitations } from './citations';
import { stripMarkdown } from './text';

/** Answer markdown to speakable text: no markdown, citation markers or URLs. */
export function toSpeechText(md: string): string {
    const withoutCode = md.replace(/```[\s\S]*?```/g, ' ');
    return stripMarkdown(stripCitations(withoutCode), { dropUrls: true })
        .replace(/\n+/g, '. ')
        .replace(/([.!?।])\s*\.\s/g, '$1 ')
        .replace(/\s{2,}/g, ' ')
        .trim();
}

/**
 * Split speech text into chunks of at most `max` characters, on sentence
 * boundaries where possible. Chrome stops long single utterances after ~15 s,
 * so the answer is queued as several short utterances.
 */
export function speechChunks(text: string, max = 220): string[] {
    const sentences = text.match(/[^.!?।]+[.!?।]*\s*/g) ?? [];
    const chunks: string[] = [];
    let current = '';

    const push = (s: string) => {
        const t = s.trim();
        if (t) chunks.push(t);
    };

    for (const sentence of sentences) {
        if ((current + sentence).length <= max) {
            current += sentence;
            continue;
        }
        push(current);
        current = '';
        if (sentence.length <= max) {
            current = sentence;
            continue;
        }
        // One very long sentence: split on spaces.
        let piece = '';
        for (const word of sentence.split(/\s+/)) {
            if ((piece + ' ' + word).trim().length > max) {
                push(piece);
                piece = word;
            } else {
                piece = `${piece} ${word}`;
            }
        }
        current = piece;
    }
    push(current);
    return chunks;
}

/** The fields of SpeechSynthesisVoice we use (so tests need no DOM). */
export interface VoiceLike {
    lang: string;
    name: string;
    voiceURI: string;
}

/**
 * Best voice for a BCP-47 tag such as "hi-IN" or "en-IN": exact match, then
 * the same language with any region. Returns undefined when the device has no
 * voice for the language (an English voice reading Hindi is worse than none).
 */
export function pickVoice<V extends VoiceLike>(voices: readonly V[], lang: string): V | undefined {
    const norm = (l: string) => l.toLowerCase().replace('_', '-');
    const want = norm(lang);
    const primary = want.split('-')[0];
    return (
        voices.find((v) => norm(v.lang) === want) ??
        voices.find((v) => norm(v.lang).split('-')[0] === primary)
    );
}
