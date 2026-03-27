/**
 * FormField.tsx — Accessible form input with inline validation + tooltip
 * WCAG 1.3.1 — label associated via htmlFor/id
 * WCAG 3.3.1 — error messages in text, not just colour
 * WCAG 3.3.2 — instructions before input
 */
"use client";

import { useState, useId } from "react";

interface FormFieldProps {
    label: string;
    name: string;
    type?: "text" | "email" | "tel" | "number" | "date" | "textarea" | "select";
    value: string;
    onChange: (value: string) => void;
    placeholder?: string;
    required?: boolean;
    error?: string;
    helpText?: string;       /* shown below input always          */
    tooltip?: string;        /* shown in ? popover on label       */
    options?: { value: string; label: string }[]; /* for select  */
    maxLength?: number;
    pattern?: string;
    autoComplete?: string;
}

export default function FormField({
    label,
    name,
    type = "text",
    value,
    onChange,
    placeholder,
    required = false,
    error,
    helpText,
    tooltip,
    options = [],
    maxLength,
    pattern,
    autoComplete,
}: FormFieldProps) {
    const uid = useId();
    const inputId = `${name}-${uid}`;
    const errorId = `${name}-error-${uid}`;
    const helpId = `${name}-help-${uid}`;
    const [tipOpen, setTipOpen] = useState(false);

    const baseInputClass = `
    w-full rounded-lg border-2 px-4 py-3 text-base
    text-[#111111] bg-white
    placeholder:text-[#616161]/60
    transition-all duration-150
    focus:outline-none focus:ring-2
    ${error
            ? "border-[#C62828] focus:border-[#C62828] focus:ring-[#C62828]/20"
            : "border-gray-200 focus:border-[#1A237E] focus:ring-[#1A237E]/15 hover:border-[#1A237E]/40"
        }
    disabled:opacity-50 disabled:cursor-not-allowed
  `;

    return (
        <div className="flex flex-col gap-1.5">
            {/* Label row */}
            <div className="flex items-center gap-1.5">
                <label
                    htmlFor={inputId}
                    className="text-sm font-semibold text-[#111111]"
                >
                    {label}
                    {required && (
                        <span aria-hidden="true" className="text-[#C62828] ml-0.5">*</span>
                    )}
                    {required && <span className="sr-only"> (required)</span>}
                </label>

                {/* Tooltip trigger — ? icon */}
                {tooltip && (
                    <div className="relative">
                        <button
                            type="button"
                            aria-label={`Help for ${label}: ${tooltip}`}
                            aria-expanded={tipOpen}
                            onClick={() => setTipOpen((o) => !o)}
                            onBlur={() => setTipOpen(false)}
                            className="
                w-5 h-5 rounded-full bg-[#1A237E]/10 text-[#1A237E]
                text-[11px] font-bold flex items-center justify-center
                hover:bg-[#1A237E]/20 transition-colors
              "
                        >
                            ?
                        </button>
                        {tipOpen && (
                            <div
                                role="tooltip"
                                className="
                  absolute left-1/2 -translate-x-1/2 bottom-full mb-2 z-20
                  w-56 bg-[#1A237E] text-white text-xs rounded-lg px-3 py-2
                  shadow-xl animate-fadeIn
                "
                            >
                                {tooltip}
                                <div aria-hidden="true" className="absolute left-1/2 -translate-x-1/2 top-full w-2 h-2 bg-[#1A237E] rotate-45 -mt-1" />
                            </div>
                        )}
                    </div>
                )}
            </div>

            {/* Help text (above input for scan-ability) */}
            {helpText && (
                <p id={helpId} className="text-xs text-[#616161]">
                    {helpText}
                </p>
            )}

            {/* Input / Textarea / Select */}
            {type === "textarea" ? (
                <textarea
                    id={inputId}
                    name={name}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    maxLength={maxLength}
                    rows={4}
                    aria-required={required}
                    aria-invalid={!!error}
                    aria-describedby={[error ? errorId : "", helpText ? helpId : ""].filter(Boolean).join(" ") || undefined}
                    autoComplete={autoComplete}
                    className={`${baseInputClass} resize-y`}
                />
            ) : type === "select" ? (
                <select
                    id={inputId}
                    name={name}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    required={required}
                    aria-required={required}
                    aria-invalid={!!error}
                    aria-describedby={[error ? errorId : "", helpText ? helpId : ""].filter(Boolean).join(" ") || undefined}
                    className={baseInputClass}
                >
                    <option value="">— Select —</option>
                    {options.map((opt) => (
                        <option key={opt.value} value={opt.value}>{opt.label}</option>
                    ))}
                </select>
            ) : (
                <input
                    id={inputId}
                    type={type}
                    name={name}
                    value={value}
                    onChange={(e) => onChange(e.target.value)}
                    placeholder={placeholder}
                    required={required}
                    maxLength={maxLength}
                    pattern={pattern}
                    aria-required={required}
                    aria-invalid={!!error}
                    aria-describedby={[error ? errorId : "", helpText ? helpId : ""].filter(Boolean).join(" ") || undefined}
                    autoComplete={autoComplete}
                    className={baseInputClass}
                />
            )}

            {/* Character count */}
            {maxLength && (
                <p aria-live="polite" className="text-[11px] text-[#616161] text-right">
                    {value.length}/{maxLength}
                </p>
            )}

            {/* Error message — WCAG 3.3.1: identify & describe error in text */}
            {error && (
                <p
                    id={errorId}
                    role="alert"
                    aria-live="assertive"
                    className="text-xs font-semibold text-[#C62828] flex items-center gap-1 mt-0.5"
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
