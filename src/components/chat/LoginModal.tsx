'use client';

import React, { useEffect, useId, useRef, useState } from 'react';
import Image from 'next/image';
import Link from 'next/link';
import { LoaderCircle, X } from 'lucide-react';

/**
 * Login / sign-up against the Go backend. Only rendered when
 * NEXT_PUBLIC_AUTH_ENABLED === 'true' (see ChatShell): the backend's data
 * stores are not reliably up, and logging in has no benefit yet.
 */
interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (name: string) => void;
}

const input = 'w-full h-11 px-3 rounded-lg border border-line bg-bg text-base text-fg placeholder:text-muted';

export function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
    const dialogRef = useRef<HTMLDialogElement>(null);
    const ids = useId();
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [agreed, setAgreed] = useState(false);
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
        setLoading(true);
        setError(null);

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const endpoint = isSignUp ? `${baseUrl}/api/v1/auth/register` : `${baseUrl}/api/v1/auth/login`;

        try {
            // Only what the user actually typed. No invented DOB, gender, state or ID.
            const body = isSignUp ? { full_name: name, email, password } : { email, password };

            // The backend runs on a free-tier host that hibernates when idle: the
            // first request after a spin-down can take ~50s, and its edge can
            // return a transient 404/502/503 before the instance is routable.
            // Retry those so a healthy backend isn't reported as "Load failed".
            const postWithRetry = async (): Promise<Response> => {
                const RETRYABLE = new Set([404, 502, 503, 504]);
                let lastErr: unknown = null;
                for (let attempt = 0; attempt < 4; attempt++) {
                    try {
                        const res = await fetch(endpoint, {
                            method: 'POST',
                            headers: { 'Content-Type': 'application/json' },
                            body: JSON.stringify(body),
                        });
                        // A real auth response (200, 400, 401, 409) is final.
                        // Only infra-level statuses are worth retrying.
                        if (!RETRYABLE.has(res.status)) return res;
                        lastErr = new Error(`transient ${res.status}`);
                    } catch (err) {
                        lastErr = err; // network error (offline, cold-start abort)
                    }
                    // brief backoff to let the instance finish waking
                    await new Promise(r => setTimeout(r, 1500 * (attempt + 1)));
                }
                throw lastErr ?? new Error('The server is waking up. Please try again in a moment.');
            };

            const response = await postWithRetry();

            let data: { error?: string; token?: string; citizen?: { full_name?: string } } = {};
            const text = await response.text();
            try {
                data = JSON.parse(text);
            } catch {
                // Not JSON, use raw text if available
            }

            if (!response.ok) {
                throw new Error(data.error || text || (isSignUp ? 'Registration failed' : 'Invalid email or password'));
            }

            const displayName = data.citizen?.full_name || name || email.split('@')[0];
            if (data.token) {
                localStorage.setItem('inbridge_token', data.token);
                localStorage.setItem('inbridge_user', JSON.stringify({ name: displayName, email }));
            }

            onLogin(displayName);
            onClose();
        } catch (err) {
            const msg = String((err as Error)?.message || '');
            setError(/load failed|failed to fetch|networkerror|transient/i.test(msg)
                ? 'Could not reach the server (it may be waking up). Please try again in a few seconds.'
                : msg);
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
                <p className="text-sm text-muted mb-6">{isSignUp ? 'Sign up to continue to InBridge.' : 'Log in to continue to InBridge.'}</p>

                {error && (
                    <p role="alert" className="mb-4 p-3 rounded-lg border border-danger/40 text-danger text-sm">{error}</p>
                )}

                <form onSubmit={handleSubmit} className="flex flex-col gap-4">
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
                        <input
                            id={`${ids}-password`}
                            type="password"
                            autoComplete={isSignUp ? 'new-password' : 'current-password'}
                            value={password}
                            onChange={(e) => setPassword(e.target.value)}
                            className={input}
                            required
                        />
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
