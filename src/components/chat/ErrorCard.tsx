'use client';

import React from 'react';
import { CircleAlert, RotateCcw, X } from 'lucide-react';
import type { ChatErrorBody, ChatErrorCode, Language } from '@/lib/chat/protocol';

const CODES: readonly ChatErrorCode[] = ['rate_limited', 'guardrail', 'bad_request', 'provider_unavailable', 'server_error'];

/** What the card shows: a server error code, or 'network' when the request never got a response. */
export type ErrorKind = ChatErrorCode | 'network';

/**
 * The AI SDK transport throws `new Error(await response.text())` on non-200,
 * so a ChatErrorBody arrives as JSON in error.message. Anything else (plain
 * text, stream errors) is treated as a server error; fetch TypeErrors as network.
 */
export function parseChatError(error: Error | undefined): { kind: ErrorKind; body: ChatErrorBody | null } {
    if (!error) return { kind: 'server_error', body: null };
    try {
        const data = JSON.parse(error.message) as Partial<ChatErrorBody>;
        if (data && CODES.includes(data.code as ChatErrorCode)) {
            return { kind: data.code as ChatErrorCode, body: { code: data.code as ChatErrorCode, message: String(data.message ?? '') } };
        }
    } catch { /* not JSON */ }
    if (error.name === 'TypeError' && /fetch|network|load failed/i.test(error.message)) return { kind: 'network', body: null };
    return { kind: 'server_error', body: null };
}

/** Errors where sending the same message again cannot help; the user must edit it. */
export function needsEdit(kind: ErrorKind): boolean {
    return kind === 'guardrail' || kind === 'bad_request';
}

type Copy = { title: string; body: string };

const COPY: Record<Language, Record<ErrorKind, Copy> & { retry: string; dismiss: string; edited: string }> = {
    en: {
        rate_limited: { title: 'Too many questions at once', body: 'Please wait a minute, then try again.' },
        guardrail: { title: 'This message can’t be sent', body: 'It may contain an ID number such as Aadhaar or PAN, or an instruction InBridge can’t follow. Remove it and send again.' },
        bad_request: { title: 'This message can’t be sent', body: 'Something in the request wasn’t valid. Try rephrasing your question.' },
        provider_unavailable: { title: 'The answer service is busy', body: 'The AI service InBridge uses isn’t responding right now. Please try again in a moment.' },
        server_error: { title: 'Something went wrong', body: 'InBridge couldn’t finish this answer. Please try again.' },
        network: { title: 'Couldn’t connect', body: 'Check your internet connection and try again.' },
        retry: 'Try again',
        dismiss: 'Dismiss',
        edited: 'Your message is back in the box below so you can edit it.',
    },
    hi: {
        rate_limited: { title: 'एक साथ बहुत सारे सवाल', body: 'कृपया एक मिनट रुकें, फिर दोबारा कोशिश करें।' },
        guardrail: { title: 'यह संदेश नहीं भेजा जा सकता', body: 'इसमें आधार या PAN जैसी कोई पहचान संख्या, या ऐसा निर्देश हो सकता है जिसे InBridge नहीं मान सकता। उसे हटाकर फिर भेजें।' },
        bad_request: { title: 'यह संदेश नहीं भेजा जा सकता', body: 'अनुरोध में कुछ सही नहीं था। अपना सवाल दूसरे शब्दों में पूछें।' },
        provider_unavailable: { title: 'उत्तर सेवा अभी व्यस्त है', body: 'InBridge जिस AI सेवा का उपयोग करता है, वह अभी जवाब नहीं दे रही। थोड़ी देर में फिर कोशिश करें।' },
        server_error: { title: 'कुछ गड़बड़ हो गई', body: 'InBridge यह उत्तर पूरा नहीं कर सका। कृपया फिर कोशिश करें।' },
        network: { title: 'कनेक्ट नहीं हो सका', body: 'अपना इंटरनेट कनेक्शन जाँचें और फिर कोशिश करें।' },
        retry: 'फिर कोशिश करें',
        dismiss: 'बंद करें',
        edited: 'आपका संदेश नीचे बॉक्स में वापस है, ताकि आप उसे बदल सकें।',
    },
    hinglish: {
        rate_limited: { title: 'Ek saath bahut saare sawaal', body: 'Please ek minute rukein, phir dobara try karein.' },
        guardrail: { title: 'Yeh message nahi bheja ja sakta', body: 'Ismein Aadhaar ya PAN jaisa koi ID number, ya aisa instruction ho sakta hai jo InBridge follow nahi kar sakta. Use hata kar phir bhejein.' },
        bad_request: { title: 'Yeh message nahi bheja ja sakta', body: 'Request mein kuch sahi nahi tha. Apna sawaal doosre shabdon mein poochhein.' },
        provider_unavailable: { title: 'Answer service abhi busy hai', body: 'InBridge jo AI service use karta hai, woh abhi respond nahi kar rahi. Thodi der mein phir try karein.' },
        server_error: { title: 'Kuch gadbad ho gayi', body: 'InBridge yeh answer poora nahi kar saka. Please phir try karein.' },
        network: { title: 'Connect nahi ho saka', body: 'Apna internet connection check karein aur phir try karein.' },
        retry: 'Phir try karein',
        dismiss: 'Band karein',
        edited: 'Aapka message neeche box mein wapas hai, taaki aap use edit kar sakein.',
    },
};

interface ErrorCardProps {
    error: Error;
    language: Language;
    /** Re-run the failed request (regenerate). Not offered when the message itself must change. */
    onRetry: () => void;
    onDismiss: () => void;
}

export function ErrorCard({ error, language, onRetry, onDismiss }: ErrorCardProps) {
    const { kind, body } = parseChatError(error);
    const copy = COPY[language];
    const text = copy[kind];
    // The server's message is written for users; prefer it in English, where it is most specific.
    const detail = language === 'en' && needsEdit(kind) && body?.message ? body.message : text.body;

    return (
        <div role="alert" className="w-full rounded-lg border border-danger/40 bg-surface p-4 flex gap-3 items-start">
            <CircleAlert className="w-5 h-5 shrink-0 mt-0.5 text-danger" aria-hidden="true" />
            <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold text-fg">{text.title}</p>
                <p className="mt-1 text-sm text-muted break-words">{detail}</p>
                {needsEdit(kind) && <p className="mt-1 text-sm text-muted">{copy.edited}</p>}
                {!needsEdit(kind) && (
                    <button
                        type="button"
                        onClick={onRetry}
                        className="mt-3 inline-flex items-center gap-2 min-h-11 px-4 rounded-full bg-fg text-bg text-sm font-medium hover:opacity-90 transition-opacity"
                    >
                        <RotateCcw className="w-4 h-4" aria-hidden="true" />
                        {copy.retry}
                    </button>
                )}
            </div>
            <button
                type="button"
                onClick={onDismiss}
                aria-label={copy.dismiss}
                className="shrink-0 -mt-2 -mr-2 inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-fg hover:bg-surface-2 transition-colors"
            >
                <X className="w-4 h-4" aria-hidden="true" />
            </button>
        </div>
    );
}
