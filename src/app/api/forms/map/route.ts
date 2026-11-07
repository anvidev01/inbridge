import { generateText } from 'ai';
import { createGroq } from '@ai-sdk/groq';
import { groqReasoningOptions } from '@/lib/ai/groq';
import { checkRateLimit, clientIp } from '@/lib/ai/ratelimit';
import { PROFILE_KEYS, type ProfileKey } from '@/lib/forms/profile';
import { log } from '@/lib/observability/logger';

export const runtime = 'nodejs';
export const maxDuration = 20;

/**
 * POST /api/forms/map  { labels: string[] }  ->  { mapping: { [label]: ProfileKey | null } }
 *
 * PRIVACY: the body is ONLY the field labels of a blank form ("Applicant Name",
 * "Date of birth"). The person's own details are never sent here: matching and
 * filling happen in their browser. Nothing from the request is stored or logged
 * (not even the labels). Only labels the browser's own rules could not place are sent.
 */
const MAX_LABELS = 60;
const MAX_LABEL_CHARS = 120;

const SYSTEM = `You match form field labels from Indian government forms to a fixed list of keys.
Keys: ${PROFILE_KEYS.join(', ')}.
Reply with ONLY a JSON object that maps each label to one key, or to null when no key fits
(signature, photograph, office use, declaration, date of application, etc). Labels may be English or Hindi.`;

function json(body: unknown, status = 200): Response {
    return new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-store' } });
}

/** Only keep labels that are short plain strings, de-duplicated. */
export function cleanLabels(input: unknown): string[] | null {
    if (!Array.isArray(input) || input.length === 0 || input.length > MAX_LABELS) return null;
    const out = new Set<string>();
    for (const item of input) {
        if (typeof item !== 'string') return null;
        const label = item.trim();
        if (label.length === 0 || label.length > MAX_LABEL_CHARS) return null;
        out.add(label);
    }
    return [...out];
}

/** Reads the model's JSON reply, accepting only known keys. */
export function parseMapping(raw: string, labels: string[]): Record<string, ProfileKey | null> {
    const text = raw.replace(/<think>[\s\S]*?<\/think>/gi, '');
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    const result: Record<string, ProfileKey | null> = Object.fromEntries(labels.map((l) => [l, null]));
    if (start < 0 || end <= start) return result;
    try {
        const parsed = JSON.parse(text.slice(start, end + 1)) as Record<string, unknown>;
        for (const label of labels) {
            const value = parsed[label];
            if (typeof value === 'string' && (PROFILE_KEYS as readonly string[]).includes(value)) result[label] = value as ProfileKey;
        }
    } catch {
        /* unparseable reply: nothing is mapped */
    }
    return result;
}

export async function POST(req: Request) {
    const limit = await checkRateLimit(`forms:${clientIp(req.headers)}`, 10);
    if (!limit.success) return json({ error: 'rate_limited' }, 429);

    const declared = Number(req.headers.get('content-length') || 0);
    if (declared > 16 * 1024) return json({ error: 'bad_request' }, 400);
    let labels: string[] | null;
    try {
        const body = JSON.parse(await req.text()) as { labels?: unknown };
        labels = cleanLabels(body.labels);
    } catch {
        labels = null;
    }
    if (!labels) return json({ error: 'bad_request' }, 400);

    const apiKey = process.env.GROQ_API_KEY;
    if (!apiKey) return json({ mapping: Object.fromEntries(labels.map((l) => [l, null])), ai: false });

    const modelName = process.env.GROQ_MODEL || 'qwen/qwen3.8-27b';
    const reasoning = groqReasoningOptions(modelName);
    try {
        const { text } = await generateText({
            model: createGroq({ apiKey })(modelName),
            ...(reasoning ? { providerOptions: { groq: reasoning } } : {}),
            system: SYSTEM,
            prompt: JSON.stringify(labels),
            temperature: 0,
            maxOutputTokens: 1200,
            abortSignal: AbortSignal.any([req.signal, AbortSignal.timeout(12_000)]),
        });
        return json({ mapping: parseMapping(text, labels), ai: true });
    } catch (error) {
        // The labels are deliberately not logged.
        log.warn('Form field mapping failed', { error });
        return json({ mapping: Object.fromEntries(labels.map((l) => [l, null])), ai: false });
    }
}
