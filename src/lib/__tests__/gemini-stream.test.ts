import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { parseGeminiSse } from '../ai/gemini';

const enc = new TextEncoder();

function event(parts: Array<{ text?: string; thought?: boolean }>, extra: object = {}): string {
    return `data: ${JSON.stringify({ candidates: [{ content: { role: 'model', parts }, ...extra }] })}\r\n\r\n`;
}

async function* chunks(...parts: Uint8Array[]): AsyncGenerator<Uint8Array> {
    for (const p of parts) yield p;
}

async function collect(stream: AsyncIterable<string>): Promise<string> {
    let out = '';
    for await (const c of stream) out += c;
    return out;
}

/** Splits bytes at every position in `cuts`. */
function splitAt(bytes: Uint8Array, cuts: number[]): Uint8Array[] {
    const out: Uint8Array[] = [];
    let last = 0;
    for (const cut of [...cuts, bytes.length]) {
        out.push(bytes.slice(last, cut));
        last = cut;
    }
    return out.filter((p) => p.length > 0);
}

describe('parseGeminiSse', () => {
    test('joins the text of successive events', async () => {
        const body = event([{ text: 'Hello' }]) + event([{ text: ', world' }]);
        assert.equal(await collect(parseGeminiSse(chunks(enc.encode(body)))), 'Hello, world');
    });

    test('Hindi survives being split at EVERY byte boundary, including inside a character and an event', async () => {
        const text = 'विधवा पेंशन के लिए आवेदन कैसे करें। ₹500 प्रति माह।';
        const bytes = enc.encode(event([{ text: text.slice(0, 12) }]) + event([{ text: text.slice(12) }]));
        // One-byte chunks are the worst case: every multi-byte character is cut.
        const oneByteChunks = Array.from(bytes, (b) => Uint8Array.of(b));
        assert.equal(await collect(parseGeminiSse(chunks(...oneByteChunks))), text);
        for (let cut = 1; cut < bytes.length; cut += 7) {
            assert.equal(await collect(parseGeminiSse(chunks(...splitAt(bytes, [cut])))), text, `cut at ${cut}`);
        }
    });

    test('accepts LF-only separators as well as CRLF', async () => {
        const body = `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'a' }] } }] })}\n\n` +
            `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'b' }] } }] })}\n\n`;
        assert.equal(await collect(parseGeminiSse(chunks(enc.encode(body)))), 'ab');
    });

    test('a final event with no trailing blank line is still read', async () => {
        const body = event([{ text: 'one ' }]) + `data: ${JSON.stringify({ candidates: [{ content: { parts: [{ text: 'two' }] } }] })}`;
        assert.equal(await collect(parseGeminiSse(chunks(enc.encode(body)))), 'one two');
    });

    test("hidden 'thought' parts never reach the user", async () => {
        const body = event([{ text: 'secret reasoning', thought: true }, { text: 'Answer' }]);
        assert.equal(await collect(parseGeminiSse(chunks(enc.encode(body)))), 'Answer');
    });

    test('keep-alive comments and [DONE] are ignored', async () => {
        const body = `: keep-alive\n\n` + event([{ text: 'x' }]) + 'data: [DONE]\n\n';
        assert.equal(await collect(parseGeminiSse(chunks(enc.encode(body)))), 'x');
    });

    test('an error event mid-stream is thrown, so the router can fail over', async () => {
        const body = event([{ text: 'partial' }]) + `data: ${JSON.stringify({ error: { code: 503, status: 'UNAVAILABLE', message: 'overloaded' } })}\n\n`;
        await assert.rejects(collect(parseGeminiSse(chunks(enc.encode(body)))), /503 UNAVAILABLE: overloaded/);
    });

    test('a blocked prompt is thrown', async () => {
        const body = `data: ${JSON.stringify({ promptFeedback: { blockReason: 'SAFETY' } })}\n\n`;
        await assert.rejects(collect(parseGeminiSse(chunks(enc.encode(body)))), /blocked the request: SAFETY/);
    });

    test('stopping for SAFETY or RECITATION with no text is an error; after text it just ends', async () => {
        await assert.rejects(
            collect(parseGeminiSse(chunks(enc.encode(event([], { finishReason: 'RECITATION' }))))),
            /stopped without an answer: RECITATION/,
        );
        const body = event([{ text: 'Some answer' }]) + event([], { finishReason: 'RECITATION' });
        assert.equal(await collect(parseGeminiSse(chunks(enc.encode(body)))), 'Some answer');
    });

    test('a normal STOP and MAX_TOKENS finish are not errors', async () => {
        assert.equal(await collect(parseGeminiSse(chunks(enc.encode(event([{ text: 'ok' }], { finishReason: 'STOP' }))))), 'ok');
        assert.equal(await collect(parseGeminiSse(chunks(enc.encode(event([{ text: 'cut' }], { finishReason: 'MAX_TOKENS' }))))), 'cut');
    });

    test('garbage that is not JSON is an error rather than silent truncation', async () => {
        await assert.rejects(collect(parseGeminiSse(chunks(enc.encode('data: {not json\n\n')))), /not valid JSON/);
    });
});
