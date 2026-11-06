'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { Eye, EyeOff, LoaderCircle, X } from 'lucide-react';
import { apiBase, fetchWithRetry, saveSession } from '@/lib/account';

/**
 * Login / sign-up against the Go backend. Signing in saves the user's
 * conversations to their account (see src/lib/thread-sync.ts), so they can be
 * continued on any device. Not rendered when NEXT_PUBLIC_AUTH_ENABLED=false.
 */
interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (name: string) => void;
    /** Why the dialog opened unprompted, e.g. an expired session. */
    notice?: string | null;
}

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MIN_PASSWORD = 8;

/** Turn a raw API/network failure into something a person can act on. */
function friendlyError(message: string, isSignUp: boolean): string {
    if (/load failed|failed to fetch|networkerror|transient|abort|waking/i.test(message)) {
        return 'Could not reach the server (it may be waking up). Please try again in a few seconds.';
    }
    if (/rate limit/i.test(message)) return 'Too many attempts. Please wait a minute and try again.';
    if (/internal server error/i.test(message)) return 'Something went wrong on our side. Please try again.';
    return message || (isSignUp ? 'Registration failed' : 'Invalid email or password');
}

const input = 'w-full h-11 px-3 rounded-lg border border-line bg-bg text-base text-fg placeholder:text-muted';

export function LoginModal({ isOpen, onClose, onLogin, notice = null }: LoginModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const ids = useId();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [agreed, setAgreed] = useState(false);
    const [showPassword, setShowPassword] = useState(false);
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Native modal dialog: focus trap, Escape (fires 'close') and top layer come for free.
    useEffect(() => {
        const dialog = dialogRef.current;
        if (!dialog) return;
        if (isOpen && !dialog.open) dialog.showModal();
        if (!isOpen && dialog.open) dialog.close();
    }, [isOpen]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (loading) return;
        setError(null);

        const cleanEmail = email.trim().toLowerCase();
        const cleanName = name.trim().replace(/\s+/g, ' ');
        if (!EMAIL_PATTERN.test(cleanEmail)) {
            setError('Please enter a valid email address.');
            return;
        }
        if (isSignUp && password.length < MIN_PASSWORD) {
            setError(`Choose a password of at least ${MIN_PASSWORD} characters.`);
            return;
        }
        if (isSignUp && !cleanName) {
            setError('Please enter your name.');
            return;
        }
        if (isSignUp && !agreed) {
            setError('Please accept the Terms and Privacy policy to create an account.');
            return;
        }

        setLoading(true);
        const endpoint = `${apiBase()}/api/v1/auth/${isSignUp ? 'register' : 'login'}`;
        try {
            // Only what the user actually typed. No invented DOB, gender, state or ID.
            const body = isSignUp ? { full_name: cleanName, email: cleanEmail, password } : { email: cleanEmail, password };

            // The backend runs on a free-tier host that hibernates when idle; retry the
            // transient statuses it returns while waking so it isn't reported as "Load failed".
            const response = await fetchWithRetry(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            let data: { error?: string; token?: string; citizen?: { full_name?: string } } = {};
            const text = await response.text();
            try {
                data = JSON.parse(text);
            } catch {
                // The API answers errors in plain text.
            }

            if (!response.ok) {
                throw new Error(data.error || text.trim() || (isSignUp ? 'Registration failed' : 'Invalid email or password'));
            }
            if (!data.token) throw new Error('The server did not return a session. Please try again.');

            const displayName = data.citizen?.full_name || cleanName || cleanEmail.split('@')[0];
            saveSession(data.token, { name: displayName, email: cleanEmail });

            setPassword('');
            setShowPassword(false);
            onLogin(displayName);
            onClose();
        } catch (err) {
            setError(friendlyError(String((err as Error)?.message || ''), isSignUp));
        } finally {
            setLoading(false);
        }
    };

    return (
        <dialog
            ref={dialogRef}
            onClose={onClose}
            aria-labelledby={`${ids}-title`}
            className="m-auto w-[calc(100%-2rem)] max-w-sm rounded-lg border border-line bg-surface text-fg p-0 backdrop:bg-black/60"
        >
            <div className="p-6">
                <div className="flex justify-between items-center mb-6">
                    <div className="flex items-center gap-2">
                        <Image src="/logo.png" alt="" width={24} height={24} className="w-6 h-6 rounded" />
                        <span className="text-lg font-bold font-serif tracking-tight">InBridge</span>
                    </div>
                    <button
                        type="button"
                        onClick={onClose}
                        aria-label="Close"
                        className="-mr-2 inline-flex items-center justify-center w-11 h-11 rounded-full text-muted hover:text-fg hover:bg-surface-2"
                    >
                        <X className="w-5 h-5" aria-hidden="true" />
                    </button>
                </div>

                <h2 id={`${ids}-title`} className="text-2xl font-bold mb-1">{isSignUp ? 'Create an account' : 'Welcome back'}</h2>
                <p className="text-sm text-muted mb-6">
                    {isSignUp
                        ? 'Create an account to keep your conversations and continue them on any device.'
                        : 'Log in to pick up your conversations where you left off.'}
                </p>

                {notice && !error && (
                    <p role="status" className="mb-4 p-3 rounded-lg border border-line bg-surface-2 text-sm">{notice}</p>
                )}

                {error && (
                    <p role="alert" className="mb-4 p-3 rounded-lg border border-danger/40 text-danger text-sm">{error}</p>
                )}

                <form onSubmit={handleSubmit} noValidate className="flex flex-col gap-4">
                    {isSignUp && (
                        <div>
                            <label htmlFor={`${ids}-name`} className="block text-sm font-medium mb-1.5">Full name</label>
                            <input id={`${ids}-name`} type="text" autoComplete="name" value={name} onChange={(e) => setName(e.target.value)} className={input} required />
                        </div>
                    )}
                    <div>
                        <label htmlFor={`${ids}-email`} className="block text-sm font-medium mb-1.5">Email address</label>
                        <input id={`${ids}-email`} type="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} className={input} required />
                    </div>
                    <div>
                        <label htmlFor={`${ids}-password`} className="block text-sm font-medium mb-1.5">Password</label>
                        <div className="relative">
                            <input
                                id={`${ids}-password`}
                                type={showPassword ? 'text' : 'password'}
                                autoComplete={isSignUp ? 'new-password' : 'current-password'}
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                aria-describedby={isSignUp ? `${ids}-pw-hint` : undefined}
                                className={`${input} pr-11`}
                                required
                            />
                            <button
                                type="button"
                                onClick={() => setShowPassword((v) => !v)}
                                aria-label={showPassword ? 'Hide password' : 'Show password'}
                                aria-pressed={showPassword}
                                className="absolute right-0 top-0 inline-flex items-center justify-center w-11 h-11 text-muted hover:text-fg"
                            >
                                {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
                            </button>
                        </div>
                        {isSignUp && <p id={`${ids}-pw-hint`} className="mt-1.5 text-[13px] text-muted">At least {MIN_PASSWORD} characters.</p>}
                    </div>

                    {isSignUp && (
                        <label className="flex items-start gap-3 text-sm text-muted">
                            <input type="checkbox" checked={agreed} onChange={(e) => setAgreed(e.target.checked)} required className="mt-0.5 w-5 h-5 shrink-0 accent-[var(--accent)]" />
                            <span>
                                I agree to the <Link href="/terms" className="text-accent underline">Terms</Link> and <Link href="/privacy" className="text-accent underline">Privacy policy</Link>.
                            </span>
                        </label>
                    )}

                    <button
                        type="submit"
                        disabled={loading}
                        className="w-full min-h-11 mt-2 rounded-lg bg-fg text-bg text-sm font-medium hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed transition-opacity flex items-center justify-center gap-2"
                    >
                        {loading && <LoaderCircle className="w-4 h-4 animate-spin" aria-hidden="true" />}
                        {isSignUp ? (loading ? 'Signing up…' : 'Sign up') : (loading ? 'Logging in…' : 'Log in')}
                    </button>
                </form>

                <div className="mt-6 text-center text-sm text-muted border-t border-line pt-6">
                    {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                    <button type="button" onClick={() => { setIsSignUp(!isSignUp); setError(null); }} className="min-h-11 px-1 font-semibold text-fg underline-offset-2 hover:underline">
                        {isSignUp ? 'Log in' : 'Sign up'}
                    </button>
                </div>
            </div>
        </dialog>
    );
}
