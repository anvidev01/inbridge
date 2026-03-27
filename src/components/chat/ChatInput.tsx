import React, { useRef, useEffect, useState, useCallback } from 'react';

interface ChatInputProps {
    input: string;
    onInputChange: (value: string) => void;
    onSend: (text: string) => void;
    isStreaming: boolean;
    language: 'en' | 'hi' | 'hinglish';
    onLanguageChange: (lang: 'en' | 'hi' | 'hinglish') => void;
}

const getSpeechAPI = () =>
    (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition ?? null;

const FOCUS_TOPICS = [
    { label: 'Identity & ID', query: 'Focus only on identity and ID card services (Aadhaar, PAN, Voter ID). ' },
    { label: 'Health', query: 'Focus only on health and wellness government schemes. ' },
    { label: 'Education', query: 'Focus only on education grants, scholarships and student schemes. ' },
    { label: 'Documents', query: 'Focus only on official government document services. ' },
    { label: 'Agriculture', query: 'Focus only on agriculture and farmer welfare schemes. ' },
    { label: 'Finance', query: 'Focus only on government financial aid and banking schemes. ' },
];

const QUICK_EMOJIS = ['😊', '👍', '🙏', '✅', '❓', '📋', '📄', '🏛️', '💡', '🔗'];

export function ChatInput({ input, onInputChange, onSend, isStreaming, language, onLanguageChange }: ChatInputProps) {
    const textareaRef = useRef<HTMLTextAreaElement>(null);
    const fileInputRef = useRef<HTMLInputElement>(null);
    const recognitionRef = useRef<any>(null);

    const [isListening, setIsListening] = useState(false);
    const [speechSupported, setSpeechSupported] = useState(false);
    const [attachedFiles, setAttachedFiles] = useState<File[]>([]);
    const [showFocus, setShowFocus] = useState(false);
    const [showEmoji, setShowEmoji] = useState(false);
    const [activeFocus, setActiveFocus] = useState<string | null>(null);

    // Auto-resize textarea
    useEffect(() => {
        if (textareaRef.current) {
            textareaRef.current.style.height = 'auto';
            textareaRef.current.style.height = `${Math.min(textareaRef.current.scrollHeight, 120)}px`;
        }
    }, [input]);

    // Speech API support check
    useEffect(() => {
        setSpeechSupported(!!getSpeechAPI());
    }, []);

    // Close popovers on outside click
    useEffect(() => {
        const handler = () => { setShowFocus(false); setShowEmoji(false); };
        document.addEventListener('click', handler);
        return () => document.removeEventListener('click', handler);
    }, []);

    /* ── Speech Recognition ── */
    const stopListening = useCallback(() => {
        recognitionRef.current?.stop();
        setIsListening(false);
    }, []);

    const startListening = useCallback(() => {
        const SpeechAPI = getSpeechAPI();
        if (!SpeechAPI) return;
        const recognition: any = new SpeechAPI();
        recognition.lang = language === 'hi' ? 'hi-IN' : 'en-IN';
        recognition.interimResults = true;
        recognition.continuous = false;
        recognitionRef.current = recognition;
        recognition.onstart = () => setIsListening(true);
        recognition.onresult = (event: any) => {
            let t = '';
            for (let i = event.resultIndex; i < event.results.length; i++) t += event.results[i][0].transcript;
            onInputChange(t);
        };
        recognition.onend = () => setIsListening(false);
        recognition.onerror = () => setIsListening(false);
        recognition.start();
    }, [onInputChange, language]);

    const toggleListening = () => isListening ? stopListening() : startListening();

    /* ── File Attach ── */
    const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files ?? []);
        if (files.length === 0) return;
        setAttachedFiles(prev => [...prev, ...files]);
        // Append file names to message context
        const names = files.map(f => f.name).join(', ');
        onInputChange((input ? input + '\n' : '') + `[Attached: ${names}]`);
        // Reset so same file can be re-selected
        e.target.value = '';
    };

    const removeFile = (index: number) => {
        setAttachedFiles(prev => prev.filter((_, i) => i !== index));
    };

    /* ── Focus topic ── */
    const selectFocus = (topic: typeof FOCUS_TOPICS[0]) => {
        setActiveFocus(topic.label);
        setShowFocus(false);
        // Prepend scope to current input
        const currentClean = input.replace(/^(Focus only on[^.]+\. )/, '');
        onInputChange(topic.query + currentClean);
        textareaRef.current?.focus();
    };

    const clearFocus = () => {
        setActiveFocus(null);
        const currentClean = input.replace(/^(Focus only on[^.]+\. )/, '');
        onInputChange(currentClean);
    };

    /* ── Key handler ── */
    const handleKeyDown = (e: React.KeyboardEvent<HTMLTextAreaElement>) => {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            if (input.trim() && !isStreaming) {
                if (isListening) stopListening();
                onSend(input);
                setAttachedFiles([]);
                setActiveFocus(null);
            }
        }
    };

    const handleSend = () => {
        if (!input.trim() || isStreaming) return;
        onSend(input);
        setAttachedFiles([]);
        setActiveFocus(null);
    };

    return (
        <div className="w-full max-w-4xl mx-auto flex flex-col items-center pb-2">

            {/* Attached file chips */}
            {attachedFiles.length > 0 && (
                <div className="w-full flex flex-wrap gap-2 mb-2 px-1">
                    {attachedFiles.map((file, i) => (
                        <span key={i} className="flex items-center gap-1.5 bg-neutral-800 text-neutral-300 text-xs px-3 py-1 rounded-full">
                            <svg xmlns="http://www.w3.org/2000/svg" width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" /><polyline points="14 2 14 8 20 8" /></svg>
                            {file.name.length > 20 ? file.name.slice(0, 18) + '…' : file.name}
                            <button onClick={() => removeFile(i)} className="ml-1 text-neutral-500 hover:text-red-400 transition-colors">✕</button>
                        </span>
                    ))}
                </div>
            )}

            {/* Hidden file input */}
            <input
                ref={fileInputRef}
                type="file"
                multiple
                accept="image/*,.pdf,.doc,.docx,.txt"
                className="hidden"
                onChange={handleFileChange}
            />

            {/* Input Pill */}
            <div className="relative w-full bg-[#0a0a0a] rounded-[24px] border border-neutral-800 shadow-[0_2px_15px_-3px_rgba(0,0,0,0.05)] pl-2 pr-1.5 py-1.5 flex items-center transition-shadow focus-within:shadow-[0_4px_20px_-3px_rgba(0,0,0,0.08)] focus-within:border-neutral-700">

                <div className="flex items-center gap-0.5 shrink-0 pl-1">
                    {/* Paperclip → triggers file picker */}
                    <button
                        type="button"
                        onClick={() => fileInputRef.current?.click()}
                        className="p-2 text-[#737373] hover:text-neutral-300 transition-colors rounded-full hover:bg-[#171717] relative"
                        aria-label="Attach file"
                        title="Attach file"
                    >
                        <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m21.44 11.05-9.19 9.19a6 6 0 0 1-8.49-8.49l8.57-8.57A4 4 0 1 1 18 8.84l-8.59 8.57a2 2 0 0 1-2.83-2.83l8.49-8.48" /></svg>
                        {attachedFiles.length > 0 && <span className="absolute 1 top-1 right-1 w-2 h-2 bg-indigo-500 rounded-full"></span>}
                    </button>

                    {/* Focus Toggles */}
                    <div className="relative">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowFocus(v => !v); setShowEmoji(false); }}
                            className={`p-2 transition-colors rounded-full ${activeFocus ? 'text-indigo-400 bg-indigo-500/10' : 'text-[#737373] hover:text-neutral-300 hover:bg-[#171717]'}`}
                            title="Filter to a specific topic"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><circle cx="12" cy="12" r="3" /></svg>
                        </button>

                        {showFocus && (
                            <div onClick={e => e.stopPropagation()} className="absolute bottom-12 left-0 bg-[#171717] border border-neutral-700 rounded-2xl p-3 shadow-xl w-72 z-50">
                                <p className="text-xs text-neutral-500 mb-2 px-1">Narrow responses to a topic:</p>
                                <div className="flex flex-wrap gap-2">
                                    {FOCUS_TOPICS.map(t => (
                                        <button
                                            key={t.label}
                                            onClick={() => selectFocus(t)}
                                            className={`px-3 py-1.5 rounded-full text-[11px] font-medium border transition-all ${activeFocus === t.label
                                                ? 'bg-indigo-600 border-indigo-500 text-white'
                                                : 'bg-neutral-800 border-neutral-700 text-neutral-300 hover:bg-neutral-700'
                                                }`}
                                        >
                                            {t.label}
                                        </button>
                                    ))}
                                    {activeFocus && (
                                        <button onClick={clearFocus} className="px-3 py-1.5 rounded-full text-[11px] font-medium border border-red-900/50 text-red-400 hover:bg-red-900/20">Clear Filter</button>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Textarea */}
                <textarea
                    ref={textareaRef}
                    value={input}
                    onChange={(e) => onInputChange(e.target.value)}
                    onKeyDown={handleKeyDown}
                    disabled={isStreaming}
                    placeholder={isListening ? 'Listening...' : 'Ask InfoSetu...'}
                    className="flex-1 bg-transparent px-2 py-2.5 outline-none resize-none text-[15px] sm:text-base text-neutral-200 placeholder:text-[#525252] min-h-[44px] max-h-[120px] self-center overflow-y-auto leading-relaxed"
                    rows={1}
                    aria-label="Chat message input"
                />

                {/* Right Icons */}
                <div className="flex items-center gap-1.5 flex-shrink-0 pr-1">

                    {/* Emoji picker */}
                    <div className="relative hidden sm:block">
                        <button
                            type="button"
                            onClick={(e) => { e.stopPropagation(); setShowEmoji(v => !v); setShowFocus(false); }}
                            className="p-2 text-[#737373] hover:text-neutral-300 transition-colors rounded-full hover:bg-[#171717]"
                            aria-label="Insert Emoji"
                            title="Insert emoji"
                        >
                            <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><circle cx="12" cy="12" r="10" /><path d="M8 14s1.5 2 4 2 4-2 4-2" /><line x1="9" x2="9.01" y1="9" y2="9" /><line x1="15" x2="15.01" y1="9" y2="9" /></svg>
                        </button>
                        {showEmoji && (
                            <div onClick={e => e.stopPropagation()} className="absolute bottom-12 right-0 bg-[#171717] border border-neutral-700 rounded-2xl p-3 shadow-xl flex flex-wrap gap-2 w-48 z-50">
                                {QUICK_EMOJIS.map(em => (
                                    <button key={em} onClick={() => { onInputChange(input + em); setShowEmoji(false); }} className="text-xl hover:scale-125 transition-transform">{em}</button>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Mic */}
                    {speechSupported && (
                        <button
                            type="button"
                            onClick={toggleListening}
                            disabled={isStreaming}
                            aria-label={isListening ? 'Stop recording' : 'Start voice input'}
                            title={isListening ? 'Click to stop' : 'Click to speak'}
                            className={`p-2 transition-all rounded-full ${isListening
                                ? 'text-red-400 bg-red-950 animate-pulse'
                                : 'text-[#737373] hover:text-neutral-300 hover:bg-[#171717]'
                                }`}
                        >
                            {isListening
                                ? <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="currentColor"><rect x="6" y="6" width="12" height="12" rx="2" /></svg>
                                : <svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z" /><path d="M19 10v2a7 7 0 0 1-14 0v-2" /><line x1="12" x2="12" y1="19" y2="22" /></svg>
                            }
                        </button>
                    )}

                    {/* Language Selector */}
                    <div className="flex items-center border-r border-neutral-700 pr-2 mr-1">
                        <select
                            value={language}
                            onChange={e => onLanguageChange(e.target.value as 'en' | 'hi' | 'hinglish')}
                            className="bg-transparent text-xs font-medium text-neutral-400 hover:text-neutral-200 outline-none cursor-pointer appearance-none transition-colors"
                            aria-label="Select language"
                            title="Change reply language"
                        >
                            <option value="en" className="bg-[#171717] text-neutral-200">English</option>
                            <option value="hi" className="bg-[#171717] text-neutral-200">Hindi (हिन्दी)</option>
                            <option value="hinglish" className="bg-[#171717] text-neutral-200">Hinglish</option>
                        </select>
                    </div>

                    {/* Send */}
                    <button
                        type="button"
                        onClick={handleSend}
                        disabled={!input.trim() || isStreaming}
                        aria-label="Send message"
                        className={`ml-1 w-10 h-10 rounded-full flex items-center justify-center transition-all flex-shrink-0
                            ${input.trim() && !isStreaming
                                ? 'bg-[#ededed] text-black hover:bg-white shadow-md hover:shadow-lg'
                                : 'bg-neutral-800 text-neutral-600 cursor-not-allowed'
                            }`}
                    >
                        {isStreaming
                            ? <svg className="animate-spin" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M21 12a9 9 0 1 1-6.219-8.56" /></svg>
                            : <svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="m22 2-7 20-4-9-9-4Z" /><path d="M22 2 11 13" /></svg>
                        }
                    </button>
                </div>
            </div>

            {/* Disclaimer */}
            <p className="mt-2 text-[10px] sm:text-[11px] text-[#525252] text-center max-w-2xl px-4 leading-relaxed tracking-wide">
                InfoSetu provides information based on current government guidelines. Consult official portals.
            </p>
        </div>
    );
}
