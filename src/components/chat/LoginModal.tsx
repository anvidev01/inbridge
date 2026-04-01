import React, { useState } from 'react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (name: string) => void;
}

export function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [password, setPassword] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        const baseUrl = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8080';
        const endpoint = isSignUp ? `${baseUrl}/api/v1/auth/register` : `${baseUrl}/api/v1/auth/login`;
        
        try {
            const body = isSignUp 
                ? { full_name: name, email, password, vid: `VID-${Math.random().toString(36).slice(2, 9).toUpperCase()}`, date_of_birth: "1990-01-01", gender: "Other", state: "Delhi", district: "New Delhi" }
                : { email, password };

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });

            let data: any = {};
            const text = await response.text();
            try {
                data = JSON.parse(text);
            } catch (e) {
                // Not JSON, use raw text if available
            }

            if (!response.ok) {
                const errorMessage = data.error || text || (isSignUp ? 'Registration failed' : 'Invalid email or password');
                throw new Error(errorMessage);
            }

            // Store session
            if (data.token) {
                localStorage.setItem('inbridge_token', data.token);
                localStorage.setItem('inbridge_user', JSON.stringify({
                    name: data.citizen?.full_name || name || email.split('@')[0],
                    email: email
                }));
            }

            onLogin(data.citizen?.full_name || name || email.split('@')[0]);
            onClose();
        } catch (err: any) {
            setError(err.message);
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-white/40 backdrop-blur-sm animate-[fadeIn_0.2s_ease-out]">
            <div className="w-full max-w-sm bg-[#0a0a0a] rounded-2xl shadow-xl overflow-hidden animate-[slideUp_0.3s_ease-out]">
                <div className="p-6">
                    <div className="flex justify-between items-center mb-6">
                        <div className="flex items-center gap-2">
                            <div className="w-6 h-6 rounded bg-white flex items-center justify-center text-black">
                                <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 8V4H8" /><rect width="16" height="12" x="4" y="8" rx="2" /><path d="M2 14h2" /><path d="M20 14h2" /><path d="M15 13v2" /><path d="M9 13v2" /></svg>
                            </div>
                            <span className="text-lg font-bold font-serif tracking-tight text-neutral-100">InBridge</span>
                        </div>
                        <button onClick={onClose} className="text-[#737373] hover:text-neutral-400 transition-colors">
                            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18" /><path d="m6 6 12 12" /></svg>
                        </button>
                    </div>

                    <h2 className="text-2xl font-bold text-neutral-100 mb-1">{isSignUp ? 'Create an account' : 'Welcome back'}</h2>
                    <p className="text-sm text-neutral-500 mb-6">{isSignUp ? 'Sign up to continue to InBridge.' : 'Log in to continue to InBridge.'}</p>

                    {error && (
                        <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-400 text-xs flex items-center gap-2 animate-[shake_0.4s_ease-in-out]">
                            <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10"/><line x1="12" y1="8" x2="12" y2="12"/><line x1="12" y1="16" x2="12.01" y2="16"/></svg>
                            {error}
                        </div>
                    )}

                    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
                        {isSignUp && (
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Full Name</label>
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Jane Doe"
                                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-800 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-sm"
                                    required
                                />
                            </div>
                        )}
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Email address</label>
                            <input
                                type="email"
                                value={email}
                                onChange={(e) => setEmail(e.target.value)}
                                placeholder="jane@example.com"
                                className="w-full px-4 py-2.5 rounded-lg border border-neutral-800 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-sm"
                                required
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-neutral-300 mb-1.5">Password</label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="••••••••"
                                className="w-full px-4 py-2.5 rounded-lg border border-neutral-800 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-sm bg-neutral-900/50 text-white"
                                required
                            />
                        </div>

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full bg-white text-black font-medium py-2.5 rounded-lg hover:bg-gray-200 disabled:bg-neutral-800 disabled:text-neutral-500 disabled:cursor-not-allowed transition-colors mt-2 text-sm flex items-center justify-center gap-2"
                        >
                            {loading && (
                                <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
                                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" fill="none"/>
                                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"/>
                                </svg>
                            )}
                            {isSignUp ? (loading ? 'Signing Up...' : 'Sign Up') : (loading ? 'Logging In...' : 'Log In')}
                        </button>
                    </form>

                    <div className="mt-6 text-center text-sm text-neutral-500 border-t border-neutral-800 pt-6">
                        {isSignUp ? 'Already have an account? ' : "Don't have an account? "}
                        <button type="button" onClick={() => setIsSignUp(!isSignUp)} className="font-semibold text-white hover:underline cursor-pointer">
                            {isSignUp ? 'Log in' : 'Sign up'}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}

