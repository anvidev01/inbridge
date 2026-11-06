'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowUp, MessageSquareWarning, Mic, ShieldAlert, Square, X } from 'lucide-react';
import { FOCUS_CATEGORIES, LANGUAGES, type ChatMode, type Language } from '@/lib/chat/protocol';
import { DISCLAIMER } from '@/lib/site';
import { findPii, maskPii, type PiiKind } from '@/lib/pii-client';

type FocusCategory = (typeof FOCUS_CATEGORIES)[number];

/** Short, friendly labels for the myScheme categories the server filters on. */
export const FOCUS_LABELS: Record<Language, Record<FocusCategory, string>> = {
    en: {
        'Social welfare & Empowerment': 'Social welfare',
        'Education & Learning': 'Education',
        'Agriculture,Rural & Environment': 'Farming & rural',
        'Business & Entrepreneurship': 'Business',
        'Women and Child': 'Women & children',
        'Skills & Employment': 'Jobs & skills',
        'Banking,Financial Services and Insurance': 'Banking & insurance',
        'Health & Wellness': 'Health',
        'Sports & Culture': 'Sports & culture',
        'Housing & Shelter': 'Housing',
        'Science, IT & Communications': 'Science & IT',
        'Transport & Infrastructure': 'Transport',
        'Travel & Tourism': 'Travel & tourism',
        'Utility & Sanitation': 'Utilities & sanitation',
        'Public Safety,Law & Justice': 'Law & justice',
    },
    hi: {
        'Social welfare & Empowerment': 'समाज कल्याण',
        'Education & Learning': 'शिक्षा',
        'Agriculture,Rural & Environment': 'खेती और गाँव',
        'Business & Entrepreneurship': 'व्यापार',
        'Women and Child': 'महिला और बच्चे',
        'Skills & Employment': 'नौकरी और हुनर',
        'Banking,Financial Services and Insurance': 'बैंक और बीमा',
        'Health & Wellness': 'स्वास्थ्य',
        'Sports & Culture': 'खेल और संस्कृति',
        'Housing & Shelter': 'घर',
        'Science, IT & Communications': 'विज्ञान और IT',
        'Transport & Infrastructure': 'परिवहन',
        'Travel & Tourism': 'यात्रा और पर्यटन',
        'Utility & Sanitation': 'बिजली, पानी और सफ़ाई',
        'Public Safety,Law & Justice': 'कानून और न्याय',
    },
    hinglish: {
        'Social welfare & Empowerment': 'Social welfare',
        'Education & Learning': 'Padhai',
        'Agriculture,Rural & Environment': 'Kheti aur gaon',
        'Business & Entrepreneurship': 'Business',
        'Women and Child': 'Mahila aur bachche',
        'Skills & Employment': 'Naukri aur skills',
        'Banking,Financial Services and Insurance': 'Bank aur insurance',
        'Health & Wellness': 'Health',
        'Sports & Culture': 'Sports aur culture',
        'Housing & Shelter': 'Ghar',
        'Science, IT & Communications': 'Science aur IT',
        'Transport & Infrastructure': 'Transport',
        'Travel & Tourism': 'Travel aur tourism',
        'Utility & Sanitation': 'Bijli, paani aur safai',
        'Public Safety,Law & Justice': 'Kanoon aur nyay',
    },
};

type VoiceError = 'denied' | 'no-speech' | 'no-mic' | 'network' | 'other';

const COPY: Record<Language, {
    placeholder: string;
    placeholderGrievance: string;
    listening: string;
    send: string;
    stop: string;
    voice: string;
    topic: string;
    allTopics: string;
    clearTopic: string;
    complaint: string;
    complaintMode: string;
    complaintHint: string;
    exitComplaint: string;
    pii: Record<PiiKind, string>;
    piiWarning: (what: string) => string;
    mask: string;
    voiceErrors: Record<VoiceError, string>;
    links: { privacy: string; terms: string; about: string };
}> = {
    en: {
        placeholder: 'Ask about a scheme or service…',
        placeholderGrievance: 'Which scheme or department, what happened, and when?',
        listening: 'Listening…',
        send: 'Send',
        stop: 'Stop generating',
        voice: 'Voice input',
        topic: 'Topic',
        allTopics: 'All topics',
        clearTopic: 'Clear topic',
        complaint: 'Draft a complaint',
        complaintMode: 'Complaint draft',
        complaintHint: 'InBridge helps you write the complaint. It does not file it: you submit it yourself on pgportal.gov.in.',
        exitComplaint: 'Leave complaint mode',
        pii: { aadhaar: 'an Aadhaar number', pan: 'a PAN', phone: 'a phone number' },
        piiWarning: (what) => `This looks like ${what}. Don’t share personal ID numbers. InBridge doesn’t need them.`,
        mask: 'Mask it',
        voiceErrors: {
            denied: 'Microphone access was blocked. Allow it in your browser settings to use voice input.',
            'no-speech': 'Didn’t catch that. Tap the mic and try again.',
            'no-mic': 'No microphone was found.',
            network: 'Voice input couldn’t reach the speech service. Some browsers, such as Brave, block it. Try Chrome, Edge or Safari, or type your question.',
            other: 'Voice input stopped. Please try again.',
        },
        links: { privacy: 'Privacy', terms: 'Terms', about: 'About' },
    },
    hi: {
        placeholder: 'किसी योजना या सेवा के बारे में पूछें…',
        placeholderGrievance: 'कौन-सी योजना या विभाग, क्या हुआ, और कब?',
        listening: 'सुन रहे हैं…',
        send: 'भेजें',
        stop: 'उत्तर रोकें',
        voice: 'बोलकर लिखें',
        topic: 'विषय',
        allTopics: 'सभी विषय',
        clearTopic: 'विषय हटाएँ',
        complaint: 'शिकायत लिखें',
        complaintMode: 'शिकायत ड्राफ़्ट',
        complaintHint: 'InBridge शिकायत लिखने में मदद करता है। यह शिकायत दर्ज नहीं करता। उसे आप खुद pgportal.gov.in पर जमा करें।',
        exitComplaint: 'शिकायत मोड बंद करें',
        pii: { aadhaar: 'आधार नंबर', pan: 'PAN', phone: 'फ़ोन नंबर' },
        piiWarning: (what) => `यह ${what} जैसा लगता है। अपनी निजी पहचान संख्या साझा न करें। InBridge को इनकी ज़रूरत नहीं है।`,
        mask: 'छिपाएँ',
        voiceErrors: {
            denied: 'माइक्रोफ़ोन की अनुमति नहीं मिली। बोलकर लिखने के लिए ब्राउज़र सेटिंग में अनुमति दें।',
            'no-speech': 'आवाज़ सुनाई नहीं दी। माइक दबाकर फिर कोशिश करें।',
            'no-mic': 'कोई माइक्रोफ़ोन नहीं मिला।',
            network: 'बोलकर लिखने के लिए स्पीच सेवा नहीं मिली। कुछ ब्राउज़र (जैसे Brave) इसे रोकते हैं। Chrome, Edge या Safari आज़माएँ, या सवाल टाइप करें।',
            other: 'बोलकर लिखना रुक गया। कृपया फिर कोशिश करें।',
        },
        links: { privacy: 'गोपनीयता', terms: 'शर्तें', about: 'परिचय' },
    },
    hinglish: {
        placeholder: 'Kisi scheme ya service ke baare mein poochhein…',
        placeholderGrievance: 'Kaunsi scheme ya department, kya hua, aur kab?',
        listening: 'Sun rahe hain…',
        send: 'Bhejein',
        stop: 'Answer rokein',
        voice: 'Bolkar likhein',
        topic: 'Topic',
        allTopics: 'Sabhi topics',
        clearTopic: 'Topic hatayein',
        complaint: 'Complaint likhein',
        complaintMode: 'Complaint draft',
        complaintHint: 'InBridge complaint likhne mein madad karta hai. Yeh complaint file nahi karta. Use aap khud pgportal.gov.in par submit karein.',
        exitComplaint: 'Complaint mode band karein',
        pii: { aadhaar: 'Aadhaar number', pan: 'PAN', phone: 'phone number' },
        piiWarning: (what) => `Yeh ${what} jaisa lag raha hai. Apne personal ID numbers share na karein. InBridge ko inki zaroorat nahi hai.`,
        mask: 'Mask karein',
        voiceErrors: {
            denied: 'Microphone ki permission nahi mili. Voice input ke liye browser settings mein allow karein.',
            'no-speech': 'Awaaz sunai nahi di. Mic dabakar phir try karein.',
            'no-mic': 'Koi microphone nahi mila.',
            network: 'Voice input ke liye speech service nahi mili. Kuch browser (jaise Brave) ise rok dete hain. Chrome, Edge ya Safari try karein, ya sawaal type karein.',
            other: 'Voice input ruk gaya. Please phir try karein.',
        },
        links: { privacy: 'Privacy', terms: 'Terms', about: 'About' },
    },
};

// ── Web Speech API (not in lib.dom for every TS version, so typed minimally) ──

interface SpeechResultList { length: number;[i: number]: { 0: { transcript: string } } }
interface SpeechRecognitionLike {
    lang: string;
    interimResults: boolean;
    continuous: boolean;
    onresult: ((e: { results: SpeechResultList }) => void) | null;
    onerror: ((e: { error: string }) => void) | null;
    onend: (() => void) | null;
    start(): void;
    stop(): void;
    abort(): void;
}
type SpeechCtor = new () => SpeechRecognitionLike;

function getSpeechAPI(): SpeechCtor | null {
    if (typeof window === 'undefined') return null;
    const w = window as unknown as { SpeechRecognition?: SpeechCtor; webkitSpeechRecognition?: SpeechCtor };
    return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => { };

function voiceErrorKind(code: string): VoiceError | null {
    if (code === 'aborted') return null; // we stopped it ourselves
    if (code === 'not-allowed' || code === 'service-not-allowed') return 'denied';
    if (code === 'no-speech') return 'no-speech';
    if (code === 'audio-capture') return 'no-mic';
    if (code === 'network') return 'network';
    return 'other';
}

export function joinText(base: string, addition: string): string {
    if (!addition) return base;
    if (!base) return addition;
    return /\s$/.test(base) ? base + addition : `${base} ${addition}`;
}

/** Composer text for a dictation result: what was in the box when the utterance began, plus the words so far. */
export function dictationText(base: string, results: SpeechResultList): string {
    let transcript = '';
    for (let i = 0; i < results.length; i++) transcript += results[i][0].transcript;
    return joinText(base, transcript.trim());
}

/**
 * Press feedback shared by the composer's round controls. The rounded-full!
 * keeps a round focus ring: globals.css sets border-radius: 4px on every
 * :focus-visible element, unlayered, so it beats the utility otherwise.
 */
const press = 'transition duration-150 ease-out motion-safe:active:scale-[0.94] focus-visible:rounded-full!';

const MAX_TEXTAREA_PX = 168; // about 6 lines at 16px / 1.6

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: (text: string) => void;
    onStop: () => void;
    /** Request in flight (submitted or streaming): Send becomes Stop. */
    busy: boolean;
    language: Language;
    mode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function ChatInput({ value, onChange, onSend, onStop, busy, language, mode, onModeChange, textareaRef }: ChatInputProps) {
    const copy = COPY[language];
    const recognitionRef = useRef<SpeechRecognitionLike | null>(null);
    const [isListening, setIsListening] = useState(false);
    const [voiceError, setVoiceError] = useState<VoiceError | null>(null);
    const speechSupported = useSyncExternalStore(noopSubscribe, () => getSpeechAPI() !== null, () => false);

    // Auto-grow up to ~6 lines.
    useLayoutEffect(() => {
        const el = textareaRef.current;
        if (!el) return;
        el.style.height = 'auto';
        el.style.height = `${Math.min(el.scrollHeight, MAX_TEXTAREA_PX)}px`;
    }, [value, textareaRef]);

    // Current composer text for the dictation callbacks, which outlive a render.
    const valueRef = useRef(value);
    useLayoutEffect(() => { valueRef.current = value; }, [value]);

    /**
     * Drop the recogniser without letting it write again. stop() still delivers
     * a final `result` event, which would put already-sent text back in the box,
     * so the handlers are detached and the session aborted.
     */
    const cancelDictation = useCallback(() => {
        const recognition = recognitionRef.current;
        if (!recognition) return;
        recognitionRef.current = null;
        recognition.onresult = null;
        recognition.onerror = null;
        recognition.onend = null;
        recognition.abort();
        setIsListening(false);
    }, []);

    // Stop the mic if the composer unmounts mid-dictation.
    useEffect(() => cancelDictation, [cancelDictation]);

    const pii = useMemo(() => findPii(value), [value]);
    const piiKinds = [...new Set(pii.map((m) => m.kind))];

    /* ── Voice ── */
    /** The user's own mic-off toggle: stop() so the words already spoken are kept. */
    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const startListening = useCallback(() => {
        const SpeechAPI = getSpeechAPI();
        if (!SpeechAPI) return;
        setVoiceError(null);
        // Dictation is appended to what is in the box when the first words arrive.
        let base: string | null = null;
        const recognition = new SpeechAPI();
        recognition.lang = LANGUAGES.find((l) => l.code === language)?.speechLang ?? 'en-IN';
        recognition.interimResults = true; // show words as they are recognised
        recognition.continuous = false;
        recognition.onresult = (event) => {
            if (base === null) base = valueRef.current;
            const next = dictationText(base, event.results);
            valueRef.current = next;
            onChange(next);
        };
        recognition.onerror = (event) => setVoiceError(voiceErrorKind(event.error));
        recognition.onend = () => {
            if (recognitionRef.current === recognition) recognitionRef.current = null;
            setIsListening(false);
        };
        recognitionRef.current = recognition;
        try {
            recognition.start();
            setIsListening(true);
        } catch {
            recognitionRef.current = null;
            setVoiceError('other');
        }
    }, [language, onChange]);

    /** Typing while the mic is on ends dictation, so the next result can't overwrite the edit. */
    const handleTyped = (text: string) => {
        if (recognitionRef.current) cancelDictation();
        onChange(text);
    };

    /* ── Send / stop ── */
    const send = () => {
        if (busy || !value.trim()) return;
        cancelDictation();
        onSend(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // isComposing: don't send while an IME (e.g. Hindi transliteration) is mid-word.
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
        }
    };


    return (
        <div className="w-full flex flex-col gap-2">
            {mode === 'grievance' && (
                <p className="px-1 text-sm text-muted">{copy.complaintHint}</p>
            )}

            {/*
              One focus ring, on the composer box, following its radius. The
              textarea's own outline is switched off with !important because the
              global :focus-visible rule in globals.css is unlayered and would
              otherwise beat Tailwind's outline-none, drawing a second ring.
            */}
            <div className="w-full rounded-xl border border-line bg-surface transition-[border-color,outline-color] duration-150 outline-2 outline-offset-2 outline-transparent has-[textarea:focus]:outline-accent">
                <label htmlFor="chat-composer" className="sr-only">{copy.placeholder}</label>
                <textarea
                    id="chat-composer"
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => handleTyped(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? copy.listening : mode === 'grievance' ? copy.placeholderGrievance : copy.placeholder}
                    rows={1}
                    lang={LANGUAGES.find((l) => l.code === language)?.htmlLang}
                    aria-describedby={pii.length > 0 ? 'composer-pii' : undefined}
                    className="block w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base text-fg placeholder:text-muted leading-relaxed outline-none! min-h-[52px]"
                    style={{ maxHeight: MAX_TEXTAREA_PX }}
                />

                <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
                    {mode === 'grievance' ? (
                        <span className="inline-flex items-center h-11 pl-3 rounded-full bg-surface-2 text-fg text-sm min-w-0">
                            <MessageSquareWarning className="w-4 h-4 shrink-0 mr-1.5 text-accent" aria-hidden="true" />
                            <span className="truncate">{copy.complaintMode}</span>
                            <button type="button" onClick={() => onModeChange('default')} aria-label={copy.exitComplaint} title={copy.exitComplaint} className={`${press} shrink-0 inline-flex items-center justify-center w-10 h-11 rounded-full text-muted hover:text-fg hover:bg-surface`}>
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { onModeChange('grievance'); textareaRef.current?.focus(); }}
                            className={`${press} inline-flex items-center gap-1.5 h-11 px-3 rounded-full border border-line text-sm text-muted hover:text-fg hover:bg-surface-2 min-w-0`}
                        >
                            <MessageSquareWarning className="w-4 h-4 shrink-0" aria-hidden="true" />
                            <span className="hidden sm:inline truncate">{copy.complaint}</span>
                            <span className="sr-only sm:hidden">{copy.complaint}</span>
                        </button>
                    )}

                    <div className="ml-auto flex items-center gap-1 shrink-0">
                        {speechSupported && (
                            <button
                                type="button"
                                onClick={isListening ? stopListening : startListening}
                                aria-pressed={isListening}
                                aria-label={copy.voice}
                                title={copy.voice}
                                className={`${press} inline-flex items-center justify-center w-11 h-11 rounded-full ${isListening ? 'bg-danger/15 text-danger' : 'text-muted hover:text-fg hover:bg-surface-2'}`}
                            >
                                <Mic className={`w-5 h-5 ${isListening ? 'animate-pulse' : ''}`} aria-hidden="true" />
                            </button>
                        )}

                        {busy ? (
                            <button
                                type="button"
                                onClick={onStop}
                                aria-label={copy.stop}
                                title={`${copy.stop} (Esc)`}
                                className={`${press} inline-flex items-center justify-center w-11 h-11 rounded-full bg-fg text-bg hover:opacity-90`}
                            >
                                <Square className="w-4 h-4" fill="currentColor" aria-hidden="true" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={send}
                                disabled={!value.trim()}
                                aria-label={copy.send}
                                className={`${press} inline-flex items-center justify-center w-11 h-11 rounded-full bg-fg text-bg hover:opacity-90 disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed disabled:scale-100`}
                            >
                                <ArrowUp className="w-5 h-5" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {/* Live regions stay mounted (empty when idle) so screen readers announce text added to them. */}
            <div id="composer-pii" role="status" aria-live="polite" className="empty:-mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-danger">
                {pii.length > 0 && (
                    <>
                        <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="flex-1 min-w-[12rem]">{copy.piiWarning(piiKinds.map((k) => copy.pii[k]).join(' / '))}</span>
                        <button
                            type="button"
                            onClick={() => { cancelDictation(); onChange(maskPii(value)); textareaRef.current?.focus(); }}
                            className={`${press} min-h-11 px-4 rounded-full border border-danger/40 font-medium hover:bg-surface-2`}
                        >
                            {copy.mask}
                        </button>
                    </>
                )}
            </div>

            <p role="status" aria-live="polite" className="empty:-mt-2 px-1 text-sm text-muted">
                {voiceError ? copy.voiceErrors[voiceError] : null}
            </p>

            <p className="px-1 text-[13px] leading-relaxed text-muted text-center">
                {DISCLAIMER[language]}{' '}
                <span className="whitespace-nowrap">
                    <Link href="/privacy" className="underline underline-offset-2 hover:text-fg">{copy.links.privacy}</Link>
                    {' · '}
                    <Link href="/terms" className="underline underline-offset-2 hover:text-fg">{copy.links.terms}</Link>
                    {' · '}
                    <Link href="/about" className="underline underline-offset-2 hover:text-fg">{copy.links.about}</Link>
                </span>
            </p>
        </div>
    );
}
