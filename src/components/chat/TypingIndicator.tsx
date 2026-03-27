import React from 'react';

export function TypingIndicator() {
    return (
        <div className="flex justify-start w-full mb-6">
            <div className="bg-[#0a0a0a] border text-center border-neutral-800 shadow-sm rounded-2xl px-5 py-4 w-fit flex items-center gap-1.5">
                <div className="w-2 h-2 rounded-full bg-[#1A237E]/40 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-[#1A237E]/40 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                <div className="w-2 h-2 rounded-full bg-[#1A237E]/40 animate-bounce" style={{ animationDelay: '300ms' }}></div>
            </div>
        </div>
    );
}
