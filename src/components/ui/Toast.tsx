/**
 * Toast.tsx
 * Auto-save / success / error notification.
 * WCAG 4.1.3 — Status Messages via aria-live="polite".
 * Usage: <Toast message="Progress saved" type="success" />
 */
"use client";

import { useEffect, useState } from "react";

interface ToastProps {
    message: string;
    type?: "success" | "error" | "info";
    duration?: number; /* ms — default 4000 */
    onDismiss?: () => void;
}

const ICONS = {
    success: (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" fill="#2E7D32" />
            <path d="M6 10l2.5 2.5L14 7" stroke="#fff" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
    ),
    error: (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" fill="#C62828" />
            <path d="M10 6v5M10 13.5v.5" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
    info: (
        <svg aria-hidden="true" width="20" height="20" viewBox="0 0 20 20" fill="none">
            <circle cx="10" cy="10" r="9" fill="#1A237E" />
            <path d="M10 9v5M10 7v.01" stroke="#fff" strokeWidth="2" strokeLinecap="round" />
        </svg>
    ),
};

export default function Toast({
    message,
    type = "success",
    duration = 4000,
    onDismiss,
}: ToastProps) {
    const [visible, setVisible] = useState(true);

    useEffect(() => {
        const timer = setTimeout(() => {
            setVisible(false);
            onDismiss?.();
        }, duration);
        return () => clearTimeout(timer);
    }, [duration, onDismiss]);

    if (!visible) return null;

    const borderColor =
        type === "success" ? "#2E7D32" :
            type === "error" ? "#C62828" : "#1A237E";

    return (
        /* aria-live="polite" announces to screen readers without interrupting current speech */
        <div
            role="status"
            aria-live="polite"
            aria-atomic="true"
            className="
        fixed bottom-6 right-4 z-50 max-w-sm
        flex items-center gap-3
        bg-white rounded-xl shadow-2xl
        px-4 py-3 animate-slideUp
        border-l-4
      "
            style={{ borderLeftColor: borderColor }}
        >
            {/* Icon */}
            <span aria-hidden="true">{ICONS[type]}</span>

            {/* Message */}
            <p className="text-sm font-medium text-[#111111] flex-1">{message}</p>

            {/* Dismiss button */}
            <button
                type="button"
                onClick={() => { setVisible(false); onDismiss?.(); }}
                aria-label="Dismiss notification"
                className="
          touch-target ml-1 text-[#616161] hover:text-[#111111]
          rounded transition-colors duration-150
        "
            >
                <svg aria-hidden="true" width="16" height="16" viewBox="0 0 16 16" fill="currentColor">
                    <path d="M4.5 4.5l7 7M11.5 4.5l-7 7" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                </svg>
            </button>
        </div>
    );
}
