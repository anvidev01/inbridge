'use client';

import React, { useCallback, useSyncExternalStore } from 'react';
import { ChevronDown, Languages } from 'lucide-react';
import { LANGUAGES, isLanguage, type Language } from '@/lib/chat/protocol';

const STORAGE_KEY = 'inbridge_language';
const CHANGE_EVENT = 'inbridge:language';

// Latest choice made in this tab; also covers browsers where localStorage throws.
let chosen: Language | null = null;

function readLanguage(): Language {
    if (chosen) return chosen;
    try {
        const stored = localStorage.getItem(STORAGE_KEY);
        return isLanguage(stored) ? stored : 'en';
    } catch {
        return 'en';
    }
}

function subscribe(onChange: () => void) {
    const onStorage = (e: StorageEvent) => {
        if (e.key !== STORAGE_KEY) return;
        chosen = isLanguage(e.newValue) ? e.newValue : null; // another tab changed it
        onChange();
    };
    window.addEventListener('storage', onStorage);
    window.addEventListener(CHANGE_EVENT, onChange);
    return () => {
        window.removeEventListener('storage', onStorage);
        window.removeEventListener(CHANGE_EVENT, onChange);
    };
}

/** The answer language, remembered on this device. Renders 'en' on the server. */
export function useLanguagePreference(): [Language, (lang: Language) => void] {
    const language = useSyncExternalStore(subscribe, readLanguage, () => 'en' as Language);
    const setLanguage = useCallback((lang: Language) => {
        chosen = lang;
        try { localStorage.setItem(STORAGE_KEY, lang); } catch { /* private mode: still update this tab */ }
        window.dispatchEvent(new Event(CHANGE_EVENT));
    }, []);
    return [language, setLanguage];
}

interface LanguageSelectProps {
    value: Language;
    onChange: (lang: Language) => void;
}

/**
 * Answer-language picker. A native <select> sits transparently over a chip so
 * keyboard, screen-reader and mobile pickers all work, while the chip shows the
 * language in its own script.
 */
export function LanguageSelect({ value, onChange }: LanguageSelectProps) {
    const current = LANGUAGES.find((l) => l.code === value) ?? LANGUAGES[0];

    return (
        <div className="relative inline-flex items-center gap-1.5 h-11 pl-3 pr-2 rounded-full border border-line text-sm text-fg hover:bg-surface-2 transition-colors has-[select:focus-visible]:outline-2 has-[select:focus-visible]:outline-offset-2 has-[select:focus-visible]:outline-accent">
            <Languages className="hidden sm:block w-4 h-4 text-muted" aria-hidden="true" />
            <span lang={current.htmlLang} aria-hidden="true">{current.native}</span>
            <ChevronDown className="w-4 h-4 text-muted" aria-hidden="true" />
            <select
                value={value}
                onChange={(e) => { if (isLanguage(e.target.value)) onChange(e.target.value); }}
                aria-label="Answer language"
                title="Answer language"
                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer text-base bg-surface text-fg"
            >
                {LANGUAGES.map((l) => (
                    <option key={l.code} value={l.code} lang={l.htmlLang}>
                        {l.native === l.label ? l.label : `${l.native} (${l.label})`}
                    </option>
                ))}
            </select>
        </div>
    );
}
