'use client';

import React, { useState, useMemo, useRef, useEffect } from 'react';
import { useChat } from '@ai-sdk/react';
import { DefaultChatTransport } from 'ai';
import { ChatWindow } from './ChatWindow';
import { ChatInput } from './ChatInput';
import { Sidebar, ChatHistoryItem } from './Sidebar';
import { LoginModal } from './LoginModal';

export function ChatShell() {
    const [sidebarOpen, setSidebarOpen] = useState(false);
    const [user, setUser] = useState<string | null>(null);
    const [loginOpen, setLoginOpen] = useState(false);
    const [currentChatId, setCurrentChatId] = useState<string | null>(null);
    const [inputValue, setInputValue] = useState('');
    const [language, setLanguage] = useState<'en' | 'hi' | 'hinglish'>('en');

    const LANG_INSTRUCTIONS: Record<string, string> = {
        en: 'You MUST always reply in English only, no matter what language the user writes in. Never switch to Hindi or any other language.',
        hi: 'आपको हमेशा केवल हिंदी में जवाब देना है, चाहे उपयोगकर्ता किसी भी भाषा में लिखे। अंग्रेज़ी या किसी भी अन्य भाषा का प्रयोग बिल्कुल न करें।',
        hinglish: 'You MUST always reply in Hinglish — a natural mix of Hindi and English in the same sentences, the way young urban Indians speak — no matter what language the user writes in. Example: "Aadhaar card ke liye aapko UIDAI portal pe jaana hoga aur apni details submit karni padegi." Never reply in pure English or pure Hindi only.',
    };

    // langRef always holds the CURRENT language so the fetch closure never goes stale
    const langRef = useRef(language);
    useEffect(() => { langRef.current = language; }, [language]);

    // Transport created once; custom fetch reads langRef.current on every send
    const transportRef = useRef(new DefaultChatTransport({
        api: '/api/chat',
        fetch: (url: RequestInfo | URL, init?: RequestInit) => {
            const body = JSON.parse((init?.body as string) ?? '{}');
            body.languageInstruction = LANG_INSTRUCTIONS[langRef.current];
            return globalThis.fetch(url, { ...init, body: JSON.stringify(body) });
        },
    }));

    const { messages, sendMessage, status, setMessages } = useChat({
        transport: transportRef.current,
    });

    const isStreaming = status === 'streaming' || status === 'submitted';

    // Build chat history from user messages sent so far
    const chatHistory = useMemo(() => {
        return messages
            .filter(m => m.role === 'user')
            .map((m, i) => ({
                id: String(i),
                title: (m.parts?.find((p: any) => p.type === 'text') as any)?.text?.slice(0, 60) ?? 'Message',
                updatedAt: new Date(),
            }));
    }, [messages]);

    const handleSend = async (text: string) => {
        if (!text.trim() || isStreaming) return;
        setInputValue('');
        await sendMessage({ role: 'user', parts: [{ type: 'text', text }] });
    };

    const handleSuggestionClick = (suggestion: string) => {
        handleSend(suggestion);
    };

    return (
        <div className="flex h-screen w-full bg-[#0a0a0a] overflow-hidden font-sans">
            <Sidebar
                isOpen={sidebarOpen}
                onClose={() => setSidebarOpen(false)}
                history={chatHistory}
                currentChatId={currentChatId}
                onSelectChat={setCurrentChatId}
                onNewChat={() => {
                    setMessages([]);
                    setCurrentChatId(null);
                }}
                onDeleteChat={() => { }}
                onServiceClick={(msg) => {
                    setSidebarOpen(false);
                    handleSend(msg);
                }}
                user={user}
                onOpenLogin={() => setLoginOpen(true)}
                onLogout={() => setUser(null)}
            />

            <LoginModal
                isOpen={loginOpen}
                onClose={() => setLoginOpen(false)}
                onLogin={(name) => setUser(name)}
            />

            <div key={language} className="flex-1 flex flex-col min-w-0 bg-[#0a0a0a] h-full relative">

                {/* Minimal Top Nav */}
                <header className="flex items-center justify-between px-6 py-4 z-10 shrink-0">
                    <div className="flex items-center gap-3">
                        <button onClick={() => setSidebarOpen(true)} className="lg:hidden p-2 -ml-2 text-neutral-500 hover:text-neutral-100 rounded-lg hover:bg-neutral-800">
                            <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="18" x2="21" y2="18" /></svg>
                        </button>
                    </div>
                    <div className="flex items-center gap-4">
                        <button onClick={() => { setMessages([]); setCurrentChatId(null); }} className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white text-black hover:bg-gray-800 text-sm font-medium transition-colors shadow-sm">
                            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M12 5v14" /><path d="M5 12h14" /></svg>
                            New Thread
                        </button>
                    </div>
                </header>

                {/* Main Content Area */}
                <div className="flex-1 overflow-hidden flex flex-col relative w-full h-full justify-center">

                    {messages.length === 0 ? (
                        /* Home State: Centered Large Search */
                        <div className="flex flex-col items-center justify-center w-full max-w-3xl mx-auto px-4 sm:px-8 pb-32 animate-[fadeIn_0.5s_ease-out]">
                            <h1 className="text-4xl font-semibold tracking-tight text-neutral-100 mb-8 font-serif">What do you want to know?</h1>
                            <div className="w-full">
                                <ChatInput input={inputValue} onInputChange={setInputValue} onSend={handleSend} isStreaming={isStreaming} language={language} onLanguageChange={setLanguage} />
                            </div>


                        </div>
                    ) : (
                        /* Conversational State: Input at bottom */
                        <div className="flex flex-col h-full w-full">
                            <ChatWindow messages={messages} isStreaming={isStreaming} onSuggestionClick={handleSuggestionClick} />
                            <div className="w-full bg-[#0a0a0a] pt-2 pb-6 px-4 md:px-8 z-10 shrink-0 border-t border-neutral-800">
                                <div className="max-w-4xl mx-auto">
                                    <ChatInput input={inputValue} onInputChange={setInputValue} onSend={handleSend} isStreaming={isStreaming} language={language} onLanguageChange={setLanguage} />
                                </div>
                            </div>
                        </div>
                    )}

                </div>
            </div>

        </div>
    );
}
