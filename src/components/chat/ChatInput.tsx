'use client';

import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import Link from 'next/link';
import { ArrowUp, ChevronDown, ListFilter, MessageSquareWarning, Mic, ShieldAlert, Square, X } from 'lucide-react';
import { FOCUS_CATEGORIES, LANGUAGES, isFocus, type ChatMode, type Focus, type Language } from '@/lib/chat/protocol';
import { DISCLAIMER } from '@/lib/site';
import { findPii, maskPii, type PiiKind } from '@/lib/pii-client';

/** Short, friendly labels for the myScheme categories the server filters on. */
const FOCUS_LABELS: Record<(typeof FOCUS_CATEGORIES)[number], string> = {
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
        complaintHint: 'InBridge helps you write the complaint. It does not file it — you submit it yourself on pgportal.gov.in.',
        exitComplaint: 'Leave complaint mode',
        pii: { aadhaar: 'an Aadhaar number', pan: 'a PAN', phone: 'a phone number' },
        piiWarning: (what) => `This looks like ${what}. Don’t share personal ID numbers — InBridge doesn’t need them.`,
        mask: 'Mask it',
        voiceErrors: {
            denied: 'Microphone access was blocked. Allow it in your browser settings to use voice input.',
            'no-speech': 'Didn’t catch that. Tap the mic and try again.',
            'no-mic': 'No microphone was found.',
            network: 'Voice input needs an internet connection.',
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
        complaintHint: 'InBridge शिकायत लिखने में मदद करता है। यह शिकायत दर्ज नहीं करता — उसे आप खुद pgportal.gov.in पर जमा करें।',
        exitComplaint: 'शिकायत मोड बंद करें',
        pii: { aadhaar: 'आधार नंबर', pan: 'PAN', phone: 'फ़ोन नंबर' },
        piiWarning: (what) => `यह ${what} जैसा लगता है। अपनी निजी पहचान संख्या साझा न करें — InBridge को इनकी ज़रूरत नहीं है।`,
        mask: 'छिपाएँ',
        voiceErrors: {
            denied: 'माइक्रोफ़ोन की अनुमति नहीं मिली। बोलकर लिखने के लिए ब्राउज़र सेटिंग में अनुमति दें।',
            'no-speech': 'आवाज़ सुनाई नहीं दी। माइक दबाकर फिर कोशिश करें।',
            'no-mic': 'कोई माइक्रोफ़ोन नहीं मिला।',
            network: 'बोलकर लिखने के लिए इंटरनेट कनेक्शन चाहिए।',
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
        complaintHint: 'InBridge complaint likhne mein madad karta hai. Yeh complaint file nahi karta — use aap khud pgportal.gov.in par submit karein.',
        exitComplaint: 'Complaint mode band karein',
        pii: { aadhaar: 'Aadhaar number', pan: 'PAN', phone: 'phone number' },
        piiWarning: (what) => `Yeh ${what} jaisa lag raha hai. Apne personal ID numbers share na karein — InBridge ko inki zaroorat nahi hai.`,
        mask: 'Mask karein',
        voiceErrors: {
            denied: 'Microphone ki permission nahi mili. Voice input ke liye browser settings mein allow karein.',
            'no-speech': 'Awaaz sunai nahi di. Mic dabakar phir try karein.',
            'no-mic': 'Koi microphone nahi mila.',
            network: 'Voice input ke liye internet connection chahiye.',
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

function joinText(base: string, addition: string): string {
    if (!addition) return base;
    if (!base) return addition;
    return /\s$/.test(base) ? base + addition : `${base} ${addition}`;
}

const MAX_TEXTAREA_PX = 168; // about 6 lines at 16px / 1.6

interface ChatInputProps {
    value: string;
    onChange: (value: string) => void;
    onSend: (text: string) => void;
    onStop: () => void;
    /** Request in flight (submitted or streaming): Send becomes Stop. */
    busy: boolean;
    language: Language;
    focus: Focus;
    onFocusChange: (focus: Focus) => void;
    mode: ChatMode;
    onModeChange: (mode: ChatMode) => void;
    textareaRef: React.RefObject<HTMLTextAreaElement>;
}

export function ChatInput({ value, onChange, onSend, onStop, busy, language, focus, onFocusChange, mode, onModeChange, textareaRef }: ChatInputProps) {
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

    // Stop the mic if the composer unmounts mid-dictation.
    useEffect(() => () => recognitionRef.current?.abort(), []);

    const pii = useMemo(() => findPii(value), [value]);
    const piiKinds = [...new Set(pii.map((m) => m.kind))];

    /* ── Voice ── */
    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
    }, []);

    const startListening = useCallback(() => {
        const SpeechAPI = getSpeechAPI();
        if (!SpeechAPI) return;
        setVoiceError(null);
        const base = value; // dictation is appended to whatever is already typed
        const recognition = new SpeechAPI();
        recognition.lang = LANGUAGES.find((l) => l.code === language)?.speechLang ?? 'en-IN';
        recognition.interimResults = true; // show words as they are recognised
        recognition.continuous = false;
        recognition.onresult = (event) => {
            let transcript = '';
            for (let i = 0; i < event.results.length; i++) transcript += event.results[i][0].transcript;
            onChange(joinText(base, transcript.trim()));
        };
        recognition.onerror = (event) => setVoiceError(voiceErrorKind(event.error));
        recognition.onend = () => {
            setIsListening(false);
            recognitionRef.current = null;
        };
        recognitionRef.current = recognition;
        try {
            recognition.start();
            setIsListening(true);
        } catch {
            setVoiceError('other');
        }
    }, [value, language, onChange]);

    /* ── Send / stop ── */
    const send = () => {
        if (busy || !value.trim()) return;
        if (isListening) stopListening();
        onSend(value);
    };

    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        // isComposing: don't send while an IME (e.g. Hindi transliteration) is mid-word.
        if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
            e.preventDefault();
            send();
        }
    };

    const focusLabel = focus === 'all' ? copy.topic : FOCUS_LABELS[focus];

    return (
        <div className="w-full flex flex-col gap-2">
            {mode === 'grievance' && (
                <p className="px-1 text-sm text-muted">{copy.complaintHint}</p>
            )}

            {/* The textarea's own outline is replaced by a ring on the whole composer box. */}
            <div className="w-full rounded-xl border border-line bg-surface has-[textarea:focus-visible]:outline-2 has-[textarea:focus-visible]:outline-offset-2 has-[textarea:focus-visible]:outline-accent">
                <label htmlFor="chat-composer" className="sr-only">{copy.placeholder}</label>
                <textarea
                    id="chat-composer"
                    ref={textareaRef}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    placeholder={isListening ? copy.listening : mode === 'grievance' ? copy.placeholderGrievance : copy.placeholder}
                    rows={1}
                    lang={LANGUAGES.find((l) => l.code === language)?.htmlLang}
                    aria-describedby={pii.length > 0 ? 'composer-pii' : undefined}
                    className="block w-full resize-none bg-transparent px-4 pt-3 pb-1 text-base text-fg placeholder:text-muted leading-relaxed outline-none focus-visible:outline-none min-h-[52px]"
                    style={{ maxHeight: MAX_TEXTAREA_PX }}
                />

                <div className="flex items-center gap-1.5 px-2 pb-2 pt-1">
                    {/* Topic filter: a native select styled as a chip */}
                    <div className={`relative inline-flex items-center gap-1.5 h-11 pl-3 pr-2 rounded-full border text-sm transition-colors min-w-0
                        has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-accent
                        ${focus === 'all' ? 'border-line text-muted hover:text-fg hover:bg-surface-2' : 'border-accent text-accent'}`}>
                        <ListFilter className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <span className="min-w-0 truncate max-w-[9rem]" aria-hidden="true">{focusLabel}</span>
                        <ChevronDown className="w-4 h-4 shrink-0" aria-hidden="true" />
                        <select
                            value={focus}
                            onChange={(e) => { if (isFocus(e.target.value)) onFocusChange(e.target.value); }}
                            aria-label={copy.topic}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base bg-surface text-fg"
                        >
                            <option value="all">{copy.allTopics}</option>
                            {FOCUS_CATEGORIES.map((c) => <option key={c} value={c}>{FOCUS_LABELS[c]}</option>)}
                        </select>
                    </div>
                    {focus !== 'all' && (
                        <button type="button" onClick={() => onFocusChange('all')} aria-label={copy.clearTopic} className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-fg hover:bg-surface-2">
                            <X className="w-4 h-4" aria-hidden="true" />
                        </button>
                    )}

                    {mode === 'grievance' ? (
                        <span className="inline-flex items-center h-11 pl-3 rounded-full border border-accent text-accent text-sm min-w-0">
                            <MessageSquareWarning className="w-4 h-4 shrink-0 mr-1.5" aria-hidden="true" />
                            <span className="truncate">{copy.complaintMode}</span>
                            <button type="button" onClick={() => onModeChange('default')} aria-label={copy.exitComplaint} className="shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-full hover:bg-surface-2">
                                <X className="w-4 h-4" aria-hidden="true" />
                            </button>
                        </span>
                    ) : (
                        <button
                            type="button"
                            onClick={() => { onModeChange('grievance'); textareaRef.current?.focus(); }}
                            className="inline-flex items-center gap-1.5 h-11 px-3 rounded-full border border-line text-sm text-muted hover:text-fg hover:bg-surface-2 min-w-0"
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
                                className={`inline-flex items-center justify-center w-11 h-11 rounded-full transition-colors ${isListening ? 'bg-danger/15 text-danger' : 'text-muted hover:text-fg hover:bg-surface-2'}`}
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
                                className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-fg text-bg hover:opacity-90 transition-opacity"
                            >
                                <Square className="w-4 h-4" fill="currentColor" aria-hidden="true" />
                            </button>
                        ) : (
                            <button
                                type="button"
                                onClick={send}
                                disabled={!value.trim()}
                                aria-label={copy.send}
                                className="inline-flex items-center justify-center w-11 h-11 rounded-full bg-fg text-bg hover:opacity-90 disabled:bg-surface-2 disabled:text-muted disabled:cursor-not-allowed transition-colors"
                            >
                                <ArrowUp className="w-5 h-5" aria-hidden="true" />
                            </button>
                        )}
                    </div>
                </div>
            </div>

            {pii.length > 0 && (
                <div id="composer-pii" role="status" className="flex flex-wrap items-center gap-x-3 gap-y-1 px-1 text-sm text-danger">
                    <ShieldAlert className="w-4 h-4 shrink-0" aria-hidden="true" />
                    <span className="flex-1 min-w-[12rem]">{copy.piiWarning(piiKinds.map((k) => copy.pii[k]).join(' / '))}</span>
                    <button
                        type="button"
                        onClick={() => { onChange(maskPii(value)); textareaRef.current?.focus(); }}
                        className="min-h-11 px-4 rounded-full border border-danger/40 font-medium hover:bg-surface-2"
                    >
                        {copy.mask}
                    </button>
                </div>
            )}

            {voiceError && (
                <p role="status" className="px-1 text-sm text-muted">{copy.voiceErrors[voiceError]}</p>
            )}

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
