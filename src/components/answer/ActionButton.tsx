'use client';

import React, { useEffect, useRef, useState } from 'react';
import { Check, Copy } from 'lucide-react';

import { copyToClipboard } from '@/lib/answer/clipboard';

interface ActionButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
    icon: React.ReactNode;
    label: string;
    /** Show the label next to the icon on narrow screens too (default: icon only below sm). */
    alwaysShowLabel?: boolean;
}

/**
 * 44px action-row button. The label is real text (visually hidden on narrow
 * screens unless alwaysShowLabel), so the accessible name always matches what
 * sighted users see on larger screens.
 */
export function ActionButton({ icon, label, alwaysShowLabel = false, className = '', ...props }: ActionButtonProps) {
    return (
        <button
            type="button"
            title={label}
            {...props}
            className={`inline-flex min-h-11 min-w-11 items-center justify-center gap-1.5 rounded-full px-2.5 text-sm text-muted transition-colors hover:bg-surface-2 hover:text-fg disabled:opacity-50 aria-pressed:text-fg ${className}`}
        >
            <span aria-hidden="true" className="inline-flex">{icon}</span>
            <span className={alwaysShowLabel ? '' : 'max-sm:sr-only'}>{label}</span>
        </button>
    );
}

interface CopyButtonProps {
    /** Called at click time so the copied text is always current. */
    getText: () => string;
    label: string;
    copiedLabel: string;
    failedLabel: string;
    alwaysShowLabel?: boolean;
    className?: string;
}

/** Copy action with a short-lived "Copied" state announced politely. */
export function CopyButton({ getText, label, copiedLabel, failedLabel, alwaysShowLabel, className }: CopyButtonProps) {
    const [status, setStatus] = useState<'idle' | 'copied' | 'failed'>('idle');
    const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => () => {
        if (timer.current) clearTimeout(timer.current);
    }, []);

    const onClick = async () => {
        const ok = await copyToClipboard(getText());
        setStatus(ok ? 'copied' : 'failed');
        if (timer.current) clearTimeout(timer.current);
        timer.current = setTimeout(() => setStatus('idle'), 2000);
    };

    const shown = status === 'copied' ? copiedLabel : status === 'failed' ? failedLabel : label;

    return (
        <>
            <ActionButton
                icon={status === 'copied' ? <Check size={16} /> : <Copy size={16} />}
                label={shown}
                onClick={onClick}
                alwaysShowLabel={alwaysShowLabel}
                className={`${status === 'copied' ? 'text-official hover:text-official' : ''} ${status === 'failed' ? 'text-danger hover:text-danger' : ''} ${className ?? ''}`}
            />
            <span className="sr-only" role="status" aria-live="polite">
                {status === 'idle' ? '' : shown}
            </span>
        </>
    );
}
