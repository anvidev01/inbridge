'use client';

import React, { useCallback, useSyncExternalStore } from 'react';
import type { Language } from '@/lib/chat/protocol';

const STORAGE_KEY = 'inbridge_onboarding_v1';
const CHANGE_EVENT = 'inbridge:onboarding';

const COPY: Record<Language, { heading: string; lines: [string, string, string]; ok: string }> = {
    en: {
        heading: 'Before you start',
        lines: [
            'InBridge answers questions about Indian government schemes and services, using a scheme dataset and official .gov.in / .nic.in pages.',
            'Answers can be wrong or out of date. Check the linked official page before you act.',
            'Never share your Aadhaar, OTP, PAN or bank details here. InBridge is independent, not a government service.',
        ],
        ok: 'Got it',
    },
    hi: {
        heading: 'शुरू करने से पहले',
        lines: [
            'InBridge भारत सरकार की योजनाओं और सेवाओं से जुड़े सवालों के जवाब देता है — एक योजना डेटासेट और आधिकारिक .gov.in / .nic.in पेजों की मदद से।',
            'जवाब गलत या पुराने हो सकते हैं। कोई भी कदम उठाने से पहले दिए गए आधिकारिक पेज पर जाँच लें।',
            'यहाँ अपना आधार, OTP, PAN या बैंक विवरण कभी साझा न करें। InBridge स्वतंत्र है, कोई सरकारी सेवा नहीं।',
        ],
        ok: 'ठीक है',
    },
    hinglish: {
        heading: 'Shuru karne se pehle',
        lines: [
            'InBridge Indian government schemes aur services ke sawaalon ke jawab deta hai — ek scheme dataset aur official .gov.in / .nic.in pages ki madad se.',
            'Jawab galat ya purane ho sakte hain. Koi bhi step lene se pehle linked official page par check karein.',
            'Yahan apna Aadhaar, OTP, PAN ya bank details kabhi share na karein. InBridge independent hai, government service nahi.',
        ],
        ok: 'Theek hai',
    },
};

// Fallback when localStorage is unavailable, so "Got it" still works for this visit.
let dismissedThisVisit = false;

function readDismissed(): boolean {
    if (dismissedThisVisit) return true;
    try {
        return localStorage.getItem(STORAGE_KEY) === '1';
    } catch {
        return false;
    }
}

function subscribe(onChange: () => void) {
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => window.removeEventListener(CHANGE_EVENT, onChange);
}

/** First-use card (F12). Hidden on the server and after "Got it". */
export function Onboarding({ language }: { language: Language }) {
    // Server snapshot = dismissed, so the card never flashes for returning users.
    const dismissed = useSyncExternalStore(subscribe, readDismissed, () => true);
    const dismiss = useCallback(() => {
        dismissedThisVisit = true;
        try { localStorage.setItem(STORAGE_KEY, '1'); } catch { /* private mode: in-memory flag covers this visit */ }
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);

    if (dismissed) return null;
    const copy = COPY[language];

    return (
        <section aria-labelledby="onboarding-heading" className="w-full rounded-lg bg-surface-2 px-4 py-3 text-left">
            <h2 id="onboarding-heading" className="text-xs font-semibold text-fg mb-1.5">{copy.heading}</h2>
            <ul className="space-y-1 text-xs text-muted leading-relaxed list-disc pl-4">
                {copy.lines.map((line) => <li key={line}>{line}</li>)}
            </ul>
            <div className="mt-1 flex justify-end">
                <button
                    type="button"
                    onClick={dismiss}
                    className="min-h-11 px-4 -mr-2 rounded-full text-xs font-medium text-fg hover:bg-surface transition-colors"
                >
                    {copy.ok}
                </button>
            </div>
        </section>
    );
}
