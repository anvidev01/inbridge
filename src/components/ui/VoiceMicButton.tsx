/**
 * VoiceMicButton.tsx
 * Pulsing mic using Web Speech API.
 * aria-label="Start Voice Input" (WCAG 4.1.2)
 * Designed for rural / low-literacy users.
 */
"use client";

import { useState, useEffect, useRef, useCallback } from "react";

/* ── Web Speech API type shim (not in standard TS lib) ─────── */
interface SpeechRecognitionAlternative {
    readonly transcript: string;
    readonly confidence: number;
}
interface SpeechRecognitionResultItem {
    readonly 0: SpeechRecognitionAlternative;
    readonly length: number;
}
interface SpeechRecognitionEvent extends Event {
    readonly results: { [index: number]: SpeechRecognitionResultItem; length: number };
}
interface ISpeechRecognition extends EventTarget {
    continuous: boolean;
    interimResults: boolean;
    lang: string;
    start(): void;
    stop(): void;
    onresult: ((event: SpeechRecognitionEvent) => void) | null;
    onerror: ((event: Event) => void) | null;
    onend: ((event: Event) => void) | null;
}

interface ISpeechRecognitionConstructor {
    new(): ISpeechRecognition;
}

declare global {
    interface Window {
        SpeechRecognition?: ISpeechRecognitionConstructor;
        webkitSpeechRecognition?: ISpeechRecognitionConstructor;
    }
}

interface VoiceMicButtonProps {
    onResult?: (transcript: string) => void;
    lang?: string; /* e.g. "hi-IN", "en-IN" */
}

export default function VoiceMicButton({
    onResult,
    lang = "en-IN",
}: VoiceMicButtonProps) {
    const [listening, setListening] = useState(false);
    const [supported, setSupported] = useState(false);
    const recognitionRef = useRef<ISpeechRecognition | null>(null);

    useEffect(() => {
        const SpeechRecognitionConstructor =
            window.SpeechRecognition ?? window.webkitSpeechRecognition;

        if (SpeechRecognitionConstructor) {
            setSupported(true);
            const recognition = new SpeechRecognitionConstructor();
            recognition.continuous = false;
            recognition.interimResults = false;
            recognition.lang = lang;

            recognition.onresult = (event: SpeechRecognitionEvent) => {
                const transcript = event.results[0][0].transcript;
                onResult?.(transcript);
                setListening(false);
            };

            recognition.onerror = () => setListening(false);
            recognition.onend = () => setListening(false);
            recognitionRef.current = recognition;
        }
    }, [lang, onResult]);

    const toggle = useCallback(() => {
        if (!recognitionRef.current) return;
        if (listening) {
            recognitionRef.current.stop();
            setListening(false);
        } else {
            recognitionRef.current.start();
            setListening(true);
        }
    }, [listening]);

    if (!supported) return null;

    return (
        <button
            type="button"
            onClick={toggle}
            aria-label={listening ? "Stop voice input" : "Start Voice Input"}
            aria-pressed={listening}
            title={listening ? "Listening… click to stop" : "Click to speak"}
            className={`
        touch-target rounded-full w-11 h-11
        flex items-center justify-center
        transition-all duration-200
        ${listening
                    ? "bg-[#C62828] text-white animate-pulse-mic"
                    : "bg-white/15 text-white hover:bg-white/25 border border-white/30"}
      `}
        >
            {/* Microphone icon */}
            <svg
                aria-hidden="true"
                width="20" height="20"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
            >
                <rect x="9" y="2" width="6" height="11" rx="3" />
                <path d="M5 10a7 7 0 0 0 14 0" />
                <line x1="12" y1="19" x2="12" y2="22" />
                <line x1="8" y1="22" x2="16" y2="22" />
            </svg>
            {/* Live region for screen readers */}
            <span className="sr-only" aria-live="polite">
                {listening ? "Listening for voice input" : ""}
            </span>
        </button>
    );
}
