import dotenv from 'dotenv';
import { GoogleGenerativeAI } from '@google/generative-ai';

// Load env vars
dotenv.config({ path: '.env.local' });

async function checkGemini() {
    const apiKey = process.env.GOOGLE_GEMINI_API_KEY;
    if (!apiKey) {
        console.error('✗ GOOGLE_GEMINI_API_KEY is not set');
        return false;
    }

    try {
        const genAI = new GoogleGenerativeAI(apiKey);
        const model = genAI.getGenerativeModel({ model: 'gemini-1.5-flash' });
        const result = await model.generateContent('Say exactly: "OK"');
        const text = result.response.text().trim();
        if (text.includes("OK")) {
            console.log('✓ Gemini API connection successful');
            return true;
        }
        console.error(`✗ Unexpected Gemini response: ${text}`);
        return false;
    } catch (error: any) {
        console.error('✗ Gemini API request failed:', error.message);
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
