/**
 * LanguageToggle.tsx
 * Supports Hindi / English + 9 regional languages via Bhashini API.
 * WCAG 3.1.2 — language of parts declared; GIGW requirement.
 */
"use client";

import { useState } from "react";

const LANGUAGES = [
    { code: "en", label: "EN", native: "English", lang: "en" },
    { code: "hi", label: "हि", native: "हिन्दी", lang: "hi" },
    { code: "bn", label: "বা", native: "বাংলা", lang: "bn" },
    { code: "te", label: "తె", native: "తెలుగు", lang: "te" },
    { code: "mr", label: "म", native: "मराठी", lang: "mr" },
    { code: "ta", label: "த", native: "தமிழ்", lang: "ta" },
    { code: "gu", label: "ગ", native: "ગુજરાતી", lang: "gu" },
    { code: "kn", label: "ಕ", native: "ಕನ್ನಡ", lang: "kn" },
    { code: "ml", label: "മ", native: "മലയാളം", lang: "ml" },
    { code: "pa", label: "ਪ", native: "ਪੰਜਾਬੀ", lang: "pa" },
    { code: "or", label: "ଓ", native: "ଓଡ଼ିଆ", lang: "or" },
] as const;

interface LanguageToggleProps {
    /** Callback receives the ISO-639-1 code */
    onChange?: (code: string) => void;
}

export default function LanguageToggle({ onChange }: LanguageToggleProps) {
    const [selected, setSelected] = useState<string>("en");
    const [open, setOpen] = useState(false);

    const current = LANGUAGES.find((l) => l.code === selected)!;

    function handleSelect(code: string) {
        setSelected(code);
        setOpen(false);
        // WCAG 3.1.1 — update <html lang> dynamically
        document.documentElement.lang = code;
        onChange?.(code);
    }

    return (
        <div className="relative" aria-label="Language selection">
            {/* Trigger */}
            <button
                type="button"
                onClick={() => setOpen((o) => !o)}
                aria-haspopup="listbox"
                aria-expanded={open}
                aria-label={`Current language: ${current.native}. Click to change`}
                className="
          touch-target flex items-center gap-1.5 rounded-md
          border border-white/30 bg-white/10 px-3 py-1.5
          text-white text-sm font-semibold
          hover:bg-white/20 transition-colors duration-150
          focus-visible:outline-2 focus-visible:outline-white
        "
            >
                <span aria-hidden="true">{current.label}</span>
                <span className="sr-only">{current.native}</span>
                {/* Chevron */}
                <svg
                    aria-hidden="true"
                    width="12" height="12"
                    viewBox="0 0 12 12"
                    fill="currentColor"
                    className={`transition-transform duration-150 ${open ? "rotate-180" : ""}`}
                >
                    <path d="M2 4l4 4 4-4" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round" />
                </svg>
            </button>

            {/* Dropdown */}
            {open && (
                <ul
                    role="listbox"
                    aria-label="Select language"
                    className="
            absolute right-0 top-full mt-1 z-50 w-44
            bg-white rounded-lg shadow-xl border border-gray-200
            py-1 animate-fadeIn
          "
                >
                    {LANGUAGES.map((lang) => (
                        <li key={lang.code} role="option" aria-selected={selected === lang.code}>
                            <button
                                type="button"
                                onClick={() => handleSelect(lang.code)}
                                lang={lang.lang}
                                className={`
                  w-full text-left px-4 py-2.5 text-sm
                  flex items-center gap-2
                  hover:bg-[#F5F5F5] transition-colors duration-100
                  ${selected === lang.code
                                        ? "font-bold text-[#1A237E]"
                                        : "text-[#616161]"}
                `}
                            >
                                <span aria-hidden="true" className="w-5 text-center font-medium">
                                    {lang.label}
                                </span>
                                <span>{lang.native}</span>
                                {selected === lang.code && (
                                    <svg aria-hidden="true" className="ml-auto w-4 h-4 text-[#2E7D32]" fill="none" viewBox="0 0 16 16">
                                        <path d="M3 8l3.5 3.5 6.5-7" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                )}
                            </button>
                        </li>
                    ))}
                </ul>
            )}
        </div>
    );
}
