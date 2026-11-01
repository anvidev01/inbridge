'use client';

import React from 'react';
import type { ChatStatus } from 'ai';
import { ArrowDown } from 'lucide-react';
import { StickToBottom, useStickToBottomContext } from 'use-stick-to-bottom';
import { MessageBubble } from './MessageBubble';
import type { ChatMode, InBridgeUIMessage, Language, PhaseData } from '@/lib/chat/protocol';

const COPY: Record<Language, { log: string; latest: string; pending: (phase: PhaseData | null) => string }> = {
    en: {
        log: 'Conversation',
        latest: 'Jump to latest',
        pending: (p) => {
            switch (p?.phase) {
                case 'searching-dataset': return 'Searching the scheme dataset…';
                case 'searching-gov': return 'Searching official government sites…';
                case 'reading': return p.count ? `Reading ${p.count} sources…` : 'Reading sources…';
                case 'writing': return 'Writing the answer…';
                default: return 'Working on it…';
            }
        },
    },
    hi: {
        log: 'बातचीत',
        latest: 'नवीनतम पर जाएँ',
        pending: (p) => {
            switch (p?.phase) {
                case 'searching-dataset': return 'योजना डेटासेट में खोज रहे हैं…';
                case 'searching-gov': return 'आधिकारिक सरकारी वेबसाइटों पर खोज रहे हैं…';
                case 'reading': return p.count ? `${p.count} स्रोत पढ़ रहे हैं…` : 'स्रोत पढ़ रहे हैं…';
                case 'writing': return 'उत्तर लिख रहे हैं…';
                default: return 'काम चल रहा है…';
            }
        },
    },
    hinglish: {
        log: 'Conversation',
        latest: 'Latest par jaayein',
        pending: (p) => {
            switch (p?.phase) {
                case 'searching-dataset': return 'Scheme dataset mein search ho raha hai…';
                case 'searching-gov': return 'Official government sites par search ho raha hai…';
                case 'reading': return p.count ? `${p.count} sources padh rahe hain…` : 'Sources padh rahe hain…';
                case 'writing': return 'Answer likh rahe hain…';
                default: return 'Kaam chal raha hai…';
            }
        },
    },
};

interface ChatWindowProps {
    messages: InBridgeUIMessage[];
    status: ChatStatus;
    /** Latest transient data-phase for the in-flight request. */
    phase: PhaseData | null;
    language: Language;
    mode: ChatMode;
    onFollowUp: (text: string) => void;
    onRegenerate: () => void;
}

function JumpToLatest({ label }: { label: string }) {
    const { isAtBottom, scrollToBottom } = useStickToBottomContext();
    if (isAtBottom) return null;
    return (
        <button
            type="button"
            onClick={() => scrollToBottom()}
            className="absolute bottom-3 left-1/2 -translate-x-1/2 inline-flex items-center gap-1.5 min-h-11 px-4 rounded-full border border-line bg-surface text-sm text-fg hover:bg-surface-2 transition-colors"
        >
            <ArrowDown className="w-4 h-4" aria-hidden="true" />
            {label}
        </button>
    );
}

export function ChatWindow({ messages, status, phase, language, mode, onFollowUp, onRegenerate }: ChatWindowProps) {
    const copy = COPY[language];
    const busy = status === 'submitted' || status === 'streaming';
    const last = messages[messages.length - 1];
    let lastAssistant = -1;
    for (let i = messages.length - 1; i >= 0; i--) {
        if (messages[i].role === 'assistant') { lastAssistant = i; break; }
    }
    // Before the first assistant chunk arrives there is no assistant message to
    // carry the phase line, so show a single pending row instead.
    const pending = busy && last?.role !== 'assistant';

    return (
        <StickToBottom className="relative flex-1 min-h-0" resize="smooth" initial="instant">
            <StickToBottom.Content
                // role=log identifies the transcript; announcements come from the
                // separate status line in ChatShell, so tokens are not read out one by one.
                role="log"
                aria-label={copy.log}
                aria-live="off"
                className="max-w-3xl mx-auto w-full px-4 md:px-8 py-6 md:py-10 flex flex-col gap-6"
            >
                {messages.map((m, i) => {
                    const inFlight = busy && i === messages.length - 1 && m.role === 'assistant';
                    return (
                        <MessageBubble
                            key={m.id}
                            message={m}
                            isLast={i === lastAssistant}
                            isStreaming={inFlight}
                            phase={inFlight ? phase : null}
                            language={language}
                            mode={mode}
                            onFollowUp={onFollowUp}
                            onRegenerate={onRegenerate}
                        />
                    );
                })}

                {pending && (
                    <div className="flex items-center gap-2 text-sm text-muted" aria-hidden="true">
                        <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
                        {copy.pending(phase)}
                    </div>
                )}
            </StickToBottom.Content>
            <JumpToLatest label={copy.latest} />
        </StickToBottom>
    );
}
