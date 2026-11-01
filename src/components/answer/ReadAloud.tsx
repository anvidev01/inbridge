'use client';

import React, { useEffect, useRef, useState, useSyncExternalStore } from 'react';
import { Square, Volume2 } from 'lucide-react';

import type { AnswerStrings } from '@/lib/answer/strings';
import { pickVoice, speechChunks, toSpeechText } from '@/lib/answer/speech';
import { ActionButton } from './ActionButton';

const RATE = 0.9;

function hasSpeech(): boolean {
    return typeof window !== 'undefined' && 'speechSynthesis' in window && typeof SpeechSynthesisUtterance !== 'undefined';
}

/** Re-render when the browser finishes loading its voice list (async in Chrome). */
function subscribeVoices(onChange: () => void) {
    if (!hasSpeech()) return () => {};
    window.speechSynthesis.addEventListener('voiceschanged', onChange);
    return () => window.speechSynthesis.removeEventListener('voiceschanged', onChange);
}

interface ReadAloudProps {
    /** Answer markdown; cleaned of markdown, [n] markers and URLs before speaking. */
    text: string;
    /** BCP-47 tag, e.g. "hi-IN" (LANGUAGES[x].speechLang). */
    speechLang: string;
    strings: AnswerStrings;
}

/**
 * Listen / Stop toggle using the browser's speechSynthesis. Hidden when the
 * browser has no speech support or no voice for the answer's language
 * (an English voice reading Hindi is worse than no button).
 */
export function ReadAloud({ text, speechLang, strings }: ReadAloudProps) {
    // voiceURI of the chosen voice, '' when none. A string snapshot is stable
    // across calls, unlike getVoices(), which returns a fresh array each time.
    const voiceURI = useSyncExternalStore(
        subscribeVoices,
        () => (hasSpeech() ? pickVoice(window.speechSynthesis.getVoices(), speechLang)?.voiceURI ?? '' : ''),
        () => ''
    );
    const [speaking, setSpeaking] = useState(false);
    const speakingRef = useRef(false);

    // Stop our own speech if the bubble unmounts (new thread, regenerate).
    useEffect(() => () => {
        if (speakingRef.current && hasSpeech()) window.speechSynthesis.cancel();
    }, []);

    if (!voiceURI) return null;

    const stop = () => {
        speakingRef.current = false;
        setSpeaking(false);
        window.speechSynthesis.cancel();
    };

    const start = () => {
        const synth = window.speechSynthesis;
        const voice = synth.getVoices().find((v) => v.voiceURI === voiceURI);
        const chunks = speechChunks(toSpeechText(text));
        if (!voice || chunks.length === 0) return;

        // Only one answer speaks at a time; cancelling ends any other bubble's queue.
        synth.cancel();
        chunks.forEach((chunk, i) => {
            const u = new SpeechSynthesisUtterance(chunk);
            u.voice = voice;
            u.lang = voice.lang;
            u.rate = RATE;
            if (i === chunks.length - 1) {
                u.onend = () => { speakingRef.current = false; setSpeaking(false); };
            }
            // 'interrupted'/'canceled' when another answer starts or Stop is pressed.
            u.onerror = () => { speakingRef.current = false; setSpeaking(false); };
            synth.speak(u);
        });
        speakingRef.current = true;
        setSpeaking(true);
    };

    return (
        <ActionButton
            icon={speaking ? <Square size={14} className="fill-current" /> : <Volume2 size={16} />}
            label={speaking ? strings.stopListening : strings.listen}
            onClick={speaking ? stop : start}
        />
    );
}
