import React from 'react';
import { format } from 'date-fns';
import { UIMessage } from 'ai';
import { MarkdownRenderer } from './MarkdownRenderer';

interface MessageBubbleProps {
    message: UIMessage;
}

// Extract text from the new v5 parts array
function getTextContent(message: UIMessage): string {
    if (Array.isArray(message.parts)) {
        return message.parts
            .filter((p: any) => p.type === 'text')
            .map((p: any) => p.text)
            .join('');
    }
    // Fallback for any legacy format
    return (message as any).content ?? '';
}

interface SourceItem { title: string; url: string; }

export function MessageBubble({ message }: MessageBubbleProps) {
    const isUser = message.role === 'user';
    const textContent = getTextContent(message);

    // Parse Sources
    let displayContent = textContent;
    let sources: SourceItem[] | null = null;
    let isParsingSources = false;

    if (textContent.includes('---SOURCES---')) {
        const sourceStartIndex = textContent.indexOf('---SOURCES---');
        const sourceEndIndex = textContent.indexOf('---END_SOURCES---');

        if (sourceEndIndex !== -1) {
            // Complete sources block
            const jsonStr = textContent.substring(sourceStartIndex + 13, sourceEndIndex).trim();
            try {
                sources = JSON.parse(jsonStr);
                if (!Array.isArray(sources)) sources = [];
            } catch (e) {
                sources = []; // Fallback on parse error
            }
            displayContent = textContent.substring(sourceEndIndex + 17).trim();
            // Prepend anything that came before SOURCES (just in case)
            if (sourceStartIndex > 0) {
                displayContent = textContent.substring(0, sourceStartIndex).trim() + '\n\n' + displayContent;
            }
        } else {
            // Still streaming sources
            isParsingSources = true;
            // Hide the partial JSON from the user
            displayContent = textContent.substring(0, sourceStartIndex).trim();
        }
    }

    // Fallback to current time if createdAt is missing
    const formattedTime = format((message as any).createdAt || new Date(), 'hh:mm a');

    if (isUser) {
        return (
            <div className="w-full animate-[fadeIn_0.5s_ease-out_forwards] mt-12 mb-8">
                {/* User Query as Large Title */}
                <h2 className="text-3xl sm:text-4xl font-semibold tracking-tight text-neutral-100 leading-tight">
                    {textContent}
                </h2>
            </div>
        );
    }

    // Assistant Message Layout (Answer Engine Style)
    return (
        <div className="flex flex-col w-full animate-[fadeIn_0.5s_ease-out_forwards] mb-12">

            {/* Dynamic Sources Section */}
            {(sources && sources.length > 0) || isParsingSources ? (
                <div className="mb-8">
                    <div className="flex items-center gap-2 mb-4">
                        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#737373]"><path d="M4 22h14a2 2 0 0 0 2-2V7l-5-5H6a2 2 0 0 0-2 2v4" /><path d="M14 2v4a2 2 0 0 0 2 2h4" /><path d="M3 15h6" /><path d="M3 18h6" /></svg>
                        <h3 className="text-lg font-semibold text-neutral-200">Sources</h3>
                    </div>

                    <div className="flex gap-3 overflow-x-auto pb-2 -mx-4 px-4 sm:mx-0 sm:px-0 hide-scrollbar">
                        {isParsingSources ? (
                            // Loading Skeleton
                            [1, 2, 3].map(i => (
                                <div key={i} className="w-[160px] h-[76px] bg-[#0a0a0a] rounded-xl animate-pulse shrink-0 border border-neutral-800"></div>
                            ))
                        ) : (
                            // Actual Sources
                            sources?.map((source, i) => {
                                let hostname = 'gov.in';
                                try { hostname = new URL(source.url || 'https://india.gov.in').hostname.replace('www.', ''); } catch (e) { }
                                return (
                                    <a
                                        key={i}
                                        href={source.url}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="flex flex-col justify-between w-[160px] h-[76px] p-3 bg-[#0a0a0a] border border-neutral-800 rounded-xl hover:bg-[#171717] hover:border-neutral-600 transition-all shrink-0 shadow-sm group"
                                    >
                                        <p className="text-[13px] font-medium text-neutral-200 line-clamp-2 leading-snug group-hover:text-blue-400 transition-colors">{source.title}</p>
                                        <div className="flex items-center gap-1.5 mt-1">
                                            <div className="w-4 h-4 bg-neutral-800 group-hover:bg-neutral-700 rounded flex items-center justify-center transition-colors"><span className="text-[9px] font-bold text-neutral-400">{i + 1}</span></div>
                                            <span className="text-[11px] text-neutral-500 truncate group-hover:text-neutral-400 transition-colors">{hostname}</span>
                                        </div>
                                    </a>
                                )
                            })
                        )}
                        {/* More sources placeholder */}
                        {sources && sources.length > 0 && (
                            <div className="flex items-center justify-center w-[60px] h-[76px] bg-[#171717] border border-neutral-800 rounded-xl hover:bg-neutral-800 cursor-pointer shrink-0 transition-colors text-neutral-500">
                                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round"><path d="M5 12h14" /><path d="m12 5 7 7-7 7" /></svg>
                            </div>
                        )}
                    </div>
                </div>
            ) : null}

            {/* Answer Section */}
            <div>
                <div className="flex items-center gap-2 mb-4">
                    <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="text-[#737373]"><path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z" /></svg>
                    <h3 className="text-lg font-semibold text-neutral-200">Answer</h3>
                </div>

                {/* Assistant Output rendered as flowing text */}
                {displayContent ? (
                    <div className="prose prose-slate prose-p:leading-relaxed prose-p:text-neutral-300 max-w-none text-[15.5px]">
                        <MarkdownRenderer content={displayContent} />
                    </div>
                ) : (
                    // Very subtle text loading indicator while sources are being parsed
                    <div className="flex items-center gap-2 mt-4 opacity-50">
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '0ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '150ms' }}></div>
                        <div className="w-1.5 h-1.5 rounded-full bg-neutral-500 animate-bounce" style={{ animationDelay: '300ms' }}></div>
                    </div>
                )}

                {/* Feedback tools */}
                <div className="flex items-center gap-3 mt-6 pt-6 border-t border-neutral-800">
                    <button className="flex items-center justify-center w-8 h-8 rounded-full border border-neutral-800 text-[#737373] hover:text-emerald-600 hover:border-emerald-200 hover:bg-emerald-50 transition-colors" aria-label="Good response">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M7 10v12" /><path d="M15 5.88 14 10h5.83a2 2 0 0 1 1.92 2.56l-2.33 8A2 2 0 0 1 17.5 22H4a2 2 0 0 1-2-2v-8a2 2 0 0 1 2-2h2.76a2 2 0 0 0 1.79-1.11L12 2h0a3.13 3.13 0 0 1 3 3.88Z" /></svg>
                    </button>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full border border-neutral-800 text-[#737373] hover:text-red-600 hover:border-red-200 hover:bg-red-50 transition-colors" aria-label="Bad response">
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M17 14V2" /><path d="M9 18.12 10 14H4.17a2 2 0 0 1-1.92-2.56l2.33-8A2 2 0 0 1 6.5 2H20a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-2.76a2 2 0 0 0-1.79 1.11L12 22h0a3.13 3.13 0 0 1-3-3.88Z" /></svg>
                    </button>
                    <button className="flex items-center justify-center w-8 h-8 rounded-full border border-neutral-800 text-[#737373] hover:text-blue-600 hover:border-blue-200 hover:bg-blue-50 transition-colors" aria-label="Copy to clipboard" onClick={() => navigator.clipboard.writeText(textContent)}>
                        <svg xmlns="http://www.w3.org/2000/svg" width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><rect width="14" height="14" x="8" y="8" rx="2" ry="2" /><path d="M4 16c-1.1 0-2-.9-2-2V4c0-1.1.9-2 2-2h10c1.1 0 2 .9 2 2" /></svg>
                    </button>

                    <span className="text-[12px] text-[#737373] ml-auto flex items-center gap-1.5">
                        <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><circle cx="12" cy="12" r="10" /><polyline points="12 6 12 12 16 14" /></svg>
                        {formattedTime}
                    </span>
                </div>
            </div>

        </div>
    );

}
