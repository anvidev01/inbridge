import React, { useRef, useEffect } from 'react';
import { UIMessage } from 'ai';
import { MessageBubble } from './MessageBubble';

interface ChatWindowProps {
    messages: UIMessage[];
    isStreaming: boolean;
    onSuggestionClick: (text: string) => void;
}

export function ChatWindow({ messages, isStreaming, onSuggestionClick }: ChatWindowProps) {
    const EndRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        EndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, [messages, isStreaming]);

    const SUGGESTIONS = [
        "Check Aadhaar Status",
        "Apply for PAN Card",
        "Voter ID Registration",
        "Health Insurance Schemes"
    ];

    return (
        <div className="flex-1 w-full overflow-y-auto px-4 md:px-8 py-8 md:py-12" aria-live="polite">
            <div className="max-w-4xl mx-auto w-full flex flex-col gap-6">

                {/* Thread Messages */}
                {messages.map((m) => (
                    <MessageBubble key={m.id} message={m} />
                ))}

                {/* Streaming Indicator */}
                {isStreaming && (
                    <div className="flex flex-col gap-3 w-full animate-[fadeIn_0.5s_ease-out_forwards] mt-6">
                        {/* Simple streaming typing indicator */}                        <div className="flex items-center gap-2 mt-4">
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                            <div className="w-1.5 h-1.5 rounded-full bg-gray-400 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                        </div>
                    </div>
                )}

                <div ref={EndRef} />
            </div>
        </div>
    );
}
