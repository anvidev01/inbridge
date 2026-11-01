'use client';

import React, { useEffect, useState } from 'react';

/** Must match the key read by THEME_BOOTSTRAP in app/layout.tsx. */
export const THEME_STORAGE_KEY = 'inbridge_theme';
export type Theme = 'dark' | 'light';

function currentTheme(): Theme {
    if (typeof document === 'undefined') return 'dark';
    return document.documentElement.dataset.theme === 'light' ? 'light' : 'dark';
}

/** Icon button that flips <html data-theme> and remembers the choice. */
export function ThemeToggle({ className = '' }: { className?: string }) {
    const [theme, setTheme] = useState<Theme>('dark');

    // Read the theme the pre-paint bootstrap script applied.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    useEffect(() => setTheme(currentTheme()), []);

    const next: Theme = theme === 'dark' ? 'light' : 'dark';

    return (
        <button
            type="button"
            onClick={() => {
                document.documentElement.dataset.theme = next;
                try { localStorage.setItem(THEME_STORAGE_KEY, next); } catch { /* private mode */ }
                setTheme(next);
            }}
            aria-label={`Switch to ${next} theme`}
            title={`Switch to ${next} theme`}
            className={`inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-fg hover:bg-surface-2 transition-colors ${className}`}
        >
            {theme === 'dark' ? (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.93 4.93l1.41 1.41M17.66 17.66l1.41 1.41M2 12h2M20 12h2M6.34 17.66l-1.41 1.41M19.07 4.93l-1.41 1.41" /></svg>
            ) : (
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d="M12 3a6 6 0 0 0 9 9 9 9 0 1 1-9-9Z" /></svg>
            )}
        </button>
    );
}
