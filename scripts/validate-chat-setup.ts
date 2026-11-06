import dotenv from 'dotenv';
import { DEFAULT_GEMINI_MODEL } from '../src/lib/ai/gemini';

// Load env vars
dotenv.config({ path: '.env.local' });

async function checkGemini() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('✗ GOOGLE_GEMINI_API_KEY is not set');
        return false;
    }

    try {
        // Plain REST call, the same way the app talks to Gemini (src/lib/ai/gemini.ts).
        const model = process.env.GEMINI_MODEL || DEFAULT_GEMINI_MODEL;
        const res = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${encodeURIComponent(model)}:generateContent`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'x-goog-api-key': apiKey },
            body: JSON.stringify({ contents: [{ role: 'user', parts: [{ text: 'Say exactly: "OK"' }] }] }),
        });
        if (!res.ok) {
            console.error(`✗ Gemini API request failed (${model}): ${res.status} ${(await res.text()).replace(/\s+/g, ' ').slice(0, 200)}`);
            return false;
        }
        const data = (await res.json()) as { candidates?: Array<{ content?: { parts?: Array<{ text?: string }> } }> };
        const text = (data.candidates?.[0]?.content?.parts ?? []).map((p) => p.text ?? '').join('').trim();
        if (text.includes('OK')) {
            console.log(`✓ Gemini API connection successful (${model})`);
            return true;
        }
        console.error(`✗ Unexpected Gemini response: ${text}`);
        return false;
    } catch (error) {
        console.error('✗ Gemini API request failed:', error instanceof Error ? error.message : error);
        return false;
    }
}

async function checkSupabase() {
    const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!url || !key) {
        console.error('✗ Supabase credentials not fully set');
        return false;
    }
    console.log('✓ Supabase credentials present, assuming valid');
    return true;
}

async function run() {
    let success = true;
    console.log("=== Validating Chat Setup ===");

    if (process.env.ACTIVE_AI_PROVIDER === 'gemini' || process.env.ACTIVE_AI_PROVIDER === 'both') {
        const geminiOk = await checkGemini();
        if (!geminiOk) success = false;
    } else if (process.env.ACTIVE_AI_PROVIDER === 'anthropic') {
        console.log('⚠ Anthropic selected as provider, but no key provided. Defaulting back to Gemini handling in logic later or this will fail in prod.');
    }

    const dbOk = await checkSupabase();
    if (!dbOk) success = false;

    console.log("============================");
    if (success) {
        console.log("✓ Validation Passed. Ready to build chat.");
        process.exit(0);
    } else {
        console.error("✗ Validation Failed. Please fix configuration.");
        process.exit(1);
    }
}

run();
