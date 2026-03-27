/**
 * AadhaarInput.tsx — Masked Aadhaar input: XXXX-XXXX-XXXX-XXXX
 * WCAG 1.3.5 — autocomplete="off" (sensitive field)
 * WCAG 1.3.1 — label associated via htmlFor/id
 * Numeric-only input, auto-inserts hyphens, limits to 12 digits.
 */
"use client";

import { useId, useRef } from "react";

interface AadhaarInputProps {
    value: string;          /* raw 12-digit string, no hyphens */
    onChange: (raw: string) => void;
    error?: string;
    required?: boolean;
    label?: string;
}

/** Format 12-digit string → XXXX-XXXX-XXXX */
function formatAadhaar(raw: string): string {
    const digits = raw.replace(/\D/g, "").slice(0, 12);
    return digits.replace(/(\d{4})(?=\d)/g, "$1-");
}

/** Strip formatting, return only digits */
function stripAadhaar(formatted: string): string {
    return formatted.replace(/\D/g, "").slice(0, 12);
}

export default function AadhaarInput({
    value,
    onChange,
    error,
    required = true,
    label = "Aadhaar Number",
}: AadhaarInputProps) {
    const uid = useId();
    const inputId = `aadhaar-${uid}`;
    const errorId = `aadhaar-error-${uid}`;
    const helpId = `aadhaar-help-${uid}`;
    const inputRef = useRef<HTMLInputElement>(null);

    function handleChange(e: React.ChangeEvent<HTMLInputElement>) {
        const raw = stripAadhaar(e.target.value);
        onChange(raw);
    }

    function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
        /* Allow: backspace, tab, arrow keys, delete */
        const allowedKeys = ["Backspace", "Tab", "ArrowLeft", "ArrowRight", "Delete", "Enter"];
        if (!allowedKeys.includes(e.key) && !/^\d$/.test(e.key)) {
            e.preventDefault();
        }
    }

    const displayValue = formatAadhaar(value);
    const isComplete = value.replace(/\D/g, "").length === 12;

    return (
        <div className="flex flex-col gap-1.5">
            {/* Label */}
            <label htmlFor={inputId} className="text-sm font-semibold text-[#111111]">
                {label}
                {required && <span aria-hidden="true" className="text-[#C62828] ml-0.5">*</span>}
                {required && <span className="sr-only"> (required)</span>}
            </label>

            {/* Help */}
            <p id={helpId} className="text-xs text-[#616161]">
                Enter your 12-digit Aadhaar number. It will be masked for security.
            </p>

            {/* Input wrapper */}
            <div className="relative">
                {/* Lock icon */}
                <span
                    aria-hidden="true"
                    className="absolute left-4 top-1/2 -translate-y-1/2 text-[#616161]"
                >
                    <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                        <rect x="4" y="8" width="10" height="8" rx="2" stroke="currentColor" strokeWidth="1.6" />
                        <path d="M6 8V6a3 3 0 0 1 6 0v2" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                    </svg>
                </span>

                <input
                    ref={inputRef}
                    id={inputId}
                    type="text"
                    inputMode="numeric"           /* numeric keyboard on mobile       */
                    autoComplete="off"            /* WCAG 1.3.5 — sensitive field     */
                    value={displayValue}
                    onChange={handleChange}
                    onKeyDown={handleKeyDown}
                    placeholder="XXXX-XXXX-XXXX"
                    required={required}
                    maxLength={14}                /* 12 digits + 2 hyphens            */
                    aria-required={required}
                    aria-invalid={!!error}
                    aria-describedby={`${helpId}${error ? ` ${errorId}` : ""}`}
                    aria-label="Aadhaar number, format: four digits, hyphen, four digits, hyphen, four digits"
                    className={`
            w-full h-12 pl-11 pr-12 rounded-lg border-2
            font-mono text-base tracking-widest text-[#111111] bg-white
            placeholder:text-[#616161]/50 placeholder:tracking-widest
            transition-all duration-150 focus:outline-none focus:ring-2
            ${error
                            ? "border-[#C62828] focus:ring-[#C62828]/20"
                            : "border-gray-200 focus:border-[#1A237E] focus:ring-[#1A237E]/15 hover:border-[#1A237E]/40"
                        }
          `}
                />

                {/* Completion check */}
                {isComplete && !error && (
                    <span
                        aria-hidden="true"
                        className="absolute right-4 top-1/2 -translate-y-1/2"
                    >
                        <svg width="18" height="18" viewBox="0 0 18 18" fill="none">
                            <circle cx="9" cy="9" r="8" fill="#2E7D32" />
                            <path d="M5.5 9l2.5 2.5 5-5.5" stroke="white" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
                        </svg>
                    </span>
                )}
            </div>

            {/* Character progress bar */}
            <div className="flex gap-1.5 mt-0.5" aria-hidden="true">
                {[0, 1, 2].map((group) => {
                    const start = group * 4;
                    const filled = Math.min(Math.max(value.length - start, 0), 4);
                    return (
                        <div key={group} className="flex gap-0.5 flex-1">
                            {[0, 1, 2, 3].map((dot) => (
                                <div
                                    key={dot}
                                    className={`h-1 flex-1 rounded-full transition-all duration-200 ${dot < filled ? "bg-[#1A237E]" : "bg-gray-200"
                                        }`}
                                />
                            ))}
                        </div>
                    );
                })}
            </div>
            <p aria-live="polite" className="sr-only">
                {value.length} of 12 digits entered
            </p>

            {/* Error */}
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    className="text-xs font-semibold text-[#C62828] flex items-center gap-1"
                >
                    <svg aria-hidden="true" width="14" height="14" viewBox="0 0 14 14" fill="none">
                        <circle cx="7" cy="7" r="6" fill="#C62828" />
                        <path d="M7 4v3M7 9v.5" stroke="white" strokeWidth="1.5" strokeLinecap="round" />
                    </svg>
                    {error}
                </p>
            )}
        </div>
    );
}
