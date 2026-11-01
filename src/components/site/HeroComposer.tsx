'use client';

/**
 * Landing-page composer. A plain GET form to /chat?q=<text>, so it works
 * without JavaScript; JS only adds auto-grow, Enter-to-submit and an empty
 * check. The chat pre-fills its composer from ?q= and does not auto-send.
 */
import React, { useRef, useState } from 'react';
import { ArrowUp } from 'lucide-react';

const MAX_LENGTH = 2000;

export function HeroComposer() {
    const [value, setValue] = useState('');
    const formRef = useRef<HTMLFormElement>(null);
    const empty = value.trim().length === 0;

    return (
        <form
            ref={formRef}
            action="/chat"
            method="get"
            role="search"
            aria-label="Ask InBridge"
            onSubmit={(e) => { if (empty) e.preventDefault(); }}
            className="flex items-end gap-2 rounded-xl border border-line bg-surface p-2 pl-4 focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-accent"
        >
            <label htmlFor="hero-q" className="sr-only">Your question</label>
            <textarea
                id="hero-q"
                name="q"
                rows={1}
                maxLength={MAX_LENGTH}
                value={value}
                onChange={(e) => {
                    setValue(e.target.value);
                    const el = e.target;
                    el.style.height = 'auto';
                    el.style.height = `${Math.min(el.scrollHeight, 160)}px`;
                }}
                onKeyDown={(e) => {
                    if (e.key === 'Enter' && !e.shiftKey && !e.nativeEvent.isComposing) {
                        e.preventDefault();
                        if (!empty) formRef.current?.requestSubmit();
                    }
                }}
                placeholder="e.g. Which scholarships can a girl student in Bihar apply for?"
                enterKeyHint="send"
                className="flex-1 min-w-0 resize-none bg-transparent py-2.5 text-base text-fg placeholder:text-muted outline-none focus-visible:outline-none leading-6"
            />
            <button
                type="submit"
                aria-label="Continue in chat"
                aria-disabled={empty}
                className={`shrink-0 inline-flex items-center justify-center w-11 h-11 rounded-lg transition-colors ${empty ? 'bg-surface-2 text-muted' : 'bg-accent text-accent-fg'}`}
            >
                <ArrowUp size={20} aria-hidden="true" />
            </button>
        </form>
    );
}
