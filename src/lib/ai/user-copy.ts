/**
 * User-facing error copy for /api/chat and /api/feedback, in the three
 * languages the UI offers. Raw provider errors never reach the client; the
 * route logs them and returns one of these instead.
 */

import type { ChatErrorBody, ChatErrorCode, Language } from '../chat/protocol';
import type { GuardrailKind } from '../guardrails';

type Copy = Record<Language, string>;

const ERROR_COPY: Record<Exclude<ChatErrorCode, 'guardrail'>, Copy> = {
    rate_limited: {
        en: "You're sending messages too quickly. Please wait a minute and try again.",
        hi: 'आप बहुत जल्दी-जल्दी संदेश भेज रहे हैं। कृपया एक मिनट रुककर फिर से कोशिश करें।',
        hinglish: 'Aap bahut jaldi messages bhej rahe hain. Ek minute ruk kar dobara try karein.',
    },
    bad_request: {
        en: 'Something was wrong with that request. Please refresh the page and try again.',
        hi: 'इस अनुरोध में कुछ गड़बड़ थी। कृपया पेज रीफ़्रेश करके फिर से कोशिश करें।',
        hinglish: 'Is request mein kuch gadbad thi. Page refresh karke dobara try karein.',
    },
    provider_unavailable: {
        en: "InBridge can't reach its AI service right now. Please try again in a few minutes.",
        hi: 'InBridge अभी अपनी AI सेवा से नहीं जुड़ पा रहा है। कृपया कुछ मिनट बाद फिर से कोशिश करें।',
        hinglish: 'InBridge abhi apni AI service se connect nahi ho pa raha. Kuch minute baad dobara try karein.',
    },
    server_error: {
        en: 'Something went wrong on our side. Please try again.',
        hi: 'हमारी ओर से कुछ गड़बड़ हो गई। कृपया फिर से कोशिश करें।',
        hinglish: 'Hamari taraf se kuch gadbad ho gayi. Please dobara try karein.',
    },
};

const GUARDRAIL_COPY: Record<'pii' | 'injection', Copy> = {
    pii: {
        en: "For your safety, please don't share Aadhaar, PAN or phone numbers here. Remove the number and ask again.",
        hi: 'आपकी सुरक्षा के लिए यहाँ आधार, पैन या फ़ोन नंबर साझा न करें। नंबर हटाकर फिर से पूछें।',
        hinglish: 'Aapki safety ke liye yahan Aadhaar, PAN ya phone number share na karein. Number hata kar dobara poochein.',
    },
    injection: {
        en: 'This message looks like an attempt to change how InBridge works, so it was not sent. Please rephrase your question about a scheme or service.',
        hi: 'यह संदेश InBridge के काम करने का तरीका बदलने की कोशिश जैसा लगता है, इसलिए इसे नहीं भेजा गया। कृपया किसी योजना या सेवा के बारे में अपना सवाल दोबारा लिखें।',
        hinglish: 'Yeh message InBridge ke kaam karne ka tareeka badalne ki koshish jaisa lagta hai, isliye bheja nahi gaya. Kisi scheme ya service ke baare mein apna sawaal dobara likhein.',
    },
};

export function chatError(code: ChatErrorCode, language: Language, guardrail?: GuardrailKind): ChatErrorBody {
    if (code === 'guardrail') {
        const variant = guardrail === 'injection' ? 'injection' : 'pii';
        return { code, message: GUARDRAIL_COPY[variant][language] };
    }
    return { code, message: ERROR_COPY[code][language] };
}
