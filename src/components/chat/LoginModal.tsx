import React, { useState } from 'react';

interface LoginModalProps {
    isOpen: boolean;
    onClose: () => void;
    onLogin: (name: string) => void;
}

export function LoginModal({ isOpen, onClose, onLogin }: LoginModalProps) {
    const [email, setEmail] = useState('');
    const [name, setName] = useState('');
    const [isSignUp, setIsSignUp] = useState(false);

    if (!isOpen) return null;

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        onLogin(name || email.split('@')[0] || 'Guest');
        onClose();
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
                        {!isSignUp && (
                            <div>
                                <label className="block text-sm font-medium text-neutral-300 mb-1.5">Password</label>
                                <input
                                    type="password"
                                    placeholder="••••••••"
                                    className="w-full px-4 py-2.5 rounded-lg border border-neutral-800 focus:border-black focus:ring-1 focus:ring-black outline-none transition-all text-sm"
                                    required
                                />
                            </div>
                        )}

                        <button
                            type="submit"
                            className="w-full bg-white text-black font-medium py-2.5 rounded-lg hover:bg-gray-800 transition-colors mt-2 text-sm"
                        >
                            {isSignUp ? 'Sign Up' : 'Log In'}
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

