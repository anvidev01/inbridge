'use client';

import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { MessageSquareText, RotateCcw } from 'lucide-react';

import { MarkdownRenderer } from './MarkdownRenderer';
import { ActionButton, CopyButton } from '@/components/answer/ActionButton';
import { Checklist } from '@/components/answer/Checklist';
import { ComplaintDraft } from '@/components/answer/ComplaintDraft';
import { FeedbackButtons } from '@/components/answer/FeedbackButtons';
import { FollowUps } from '@/components/answer/FollowUps';
import { PhaseLine } from '@/components/answer/PhaseLine';
import { ProvenanceLine } from '@/components/answer/ProvenanceLine';
import { ReadAloud } from '@/components/answer/ReadAloud';
import { ShareMenu } from '@/components/answer/ShareMenu';
import { SourceStrip, sourceCardId } from '@/components/answer/SourceStrip';
import { useStableCitations } from '@/components/answer/useStableCitations';
import { LANGUAGES, dataPart, messageText } from '@/lib/chat/protocol';
import { SITE_URL } from '@/lib/site';
import { answerStrings } from '@/lib/answer/strings';
import { buildCopyText, buildShareText, cleanAnswerText } from '@/lib/answer/text';
import { extractChecklist, extractComplaintDraft } from '@/lib/answer/sections';
import { formatTime } from '@/lib/answer/format';
import { answerContext, isStoppedAnswer } from '@/lib/answer/message';

import type { ChatMode, Citation, InBridgeUIMessage, Language, PhaseData } from '@/lib/chat/protocol';

/**
 * Contract between ChatWindow (owner: chat shell) and MessageBubble (owner:
 * answer rendering). Do not change without updating both sides.
 */
export interface MessageBubbleProps {
    message: InBridgeUIMessage;
    /** True for the most recent assistant message (only it gets Regenerate). */
    isLast: boolean;
    /** True while this message is being generated. */
    isStreaming: boolean;
    /** Live pipeline phase for the in-flight answer (from transient data-phase parts). */
    phase: PhaseData | null;
    /** UI language, for labels, read-aloud voice and the bubble's lang attribute. */
    language: Language;
    mode: ChatMode;
    /** Send a follow-up question as a new user message. */
    onFollowUp: (text: string) => void;
    /** Regenerate the last answer. */
    onRegenerate: () => void;
}

const HIGHLIGHT_MS = 2000;
const EMPTY_SOURCES: Citation[] = [];

export function MessageBubble({ message, isLast, isStreaming, phase, language, mode, onFollowUp, onRegenerate }: MessageBubbleProps) {
    const rawText = messageText(message);

    if (message.role === 'user') {
        return (
            <div className="mt-10 mb-2 w-full animate-[page-enter_240ms_cubic-bezier(0.22,1,0.36,1)_both]">
                {/* The question reads big (answer-engine layout) but is not a heading. */}
                <p className="font-serif text-xl font-medium leading-snug text-fg whitespace-pre-wrap break-words wrap-anywhere sm:text-2xl">
                    {rawText}
                </p>
            </div>
        );
    }

    return (
        <AssistantAnswer
            message={message}
            rawText={rawText}
            isLast={isLast}
            isStreaming={isStreaming}
            phase={phase}
            language={language}
            mode={mode}
            onFollowUp={onFollowUp}
            onRegenerate={onRegenerate}
        />
    );
}

function AssistantAnswer({ message, rawText, isLast, isStreaming, phase, language: uiLanguage, mode: uiMode, onFollowUp, onRegenerate }: MessageBubbleProps & { rawText: string }) {
    // Labels, lang and the complaint hand-off follow the mode/language the
    // answer was generated in (metadata), not the current UI toggles.
    const { mode, language } = answerContext(message, { mode: uiMode, language: uiLanguage });
    const t = answerStrings(language);
    const lang = LANGUAGES.find((l) => l.code === language) ?? LANGUAGES[0];

    const answer = useMemo(() => cleanAnswerText(rawText), [rawText]);
    // Stable across streamed chunks while the sources themselves are unchanged.
    const sources = useStableCitations(dataPart(message, 'sources') ?? EMPTY_SOURCES);
    const provenance = dataPart(message, 'provenance');
    const followups = dataPart(message, 'followups') ?? [];
    const createdAt = message.metadata?.createdAt;

    // Structured sections are only extracted once the answer is complete, so
    // they don't flicker in and out while tokens stream.
    const checklist = useMemo(
        () => (!isStreaming && sources.length > 0 ? extractChecklist(answer) : null),
        [answer, isStreaming, sources.length]
    );
    const draft = useMemo(
        () => (!isStreaming && mode === 'grievance' ? extractComplaintDraft(answer) : null),
        [answer, isStreaming, mode]
    );

    // Citation chip -> scroll to and briefly highlight the matching source card.
    const [highlighted, setHighlighted] = useState<number | null>(null);
    const highlightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    useEffect(() => () => {
        if (highlightTimer.current) clearTimeout(highlightTimer.current);
    }, []);

    const jumpToSource = useCallback((n: number) => {
        const card = document.getElementById(sourceCardId(message.id, n));
        if (!card) return;
        const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
        card.scrollIntoView({ behavior: reduce ? 'auto' : 'smooth', block: 'nearest', inline: 'nearest' });
        card.focus({ preventScroll: true });
        setHighlighted(n);
        if (highlightTimer.current) clearTimeout(highlightTimer.current);
        highlightTimer.current = setTimeout(() => setHighlighted(null), HIGHLIGHT_MS);
    }, [message.id]);

    const time = formatTime(createdAt, lang.htmlLang);
    const showActions = !isStreaming && answer.length > 0;
    const stopped = isStoppedAnswer(message, { isLast, isStreaming, hasText: answer.length > 0 });
    const citationHosts = useMemo(() => [...new Set(sources.map((s) => s.host).filter(Boolean))], [sources]);

    return (
        <article lang={lang.htmlLang} aria-label={t.answer} className="mb-10 flex w-full flex-col animate-[page-enter_240ms_cubic-bezier(0.22,1,0.36,1)_both]">
            <p className="mb-3 flex items-center gap-2 text-sm font-semibold text-muted">
                <MessageSquareText size={16} aria-hidden="true" />
                {t.answer}
            </p>

            {isStreaming && <PhaseLine phase={phase} strings={t} pending={!answer} />}

            {answer && (
                <MarkdownRenderer content={answer} citations={sources} onCitationJump={jumpToSource} strings={t} />
            )}
            {stopped && <p className="mt-1 text-sm italic text-muted">{t.stopped}</p>}

            {checklist && <Checklist messageId={message.id} checklist={checklist} strings={t} />}
            {draft && <ComplaintDraft draft={draft} strings={t} />}

            {provenance && answer && <ProvenanceLine provenance={provenance} strings={t} locale={lang.htmlLang} />}

            <SourceStrip messageId={message.id} sources={sources} strings={t} highlighted={highlighted} lang={lang.htmlLang} />

            {showActions && (
                <div className="mt-5 -ml-2.5 flex flex-wrap items-center gap-1">
                    <CopyButton
                        getText={() => buildCopyText(answer, sources, t.sources)}
                        label={t.copy}
                        copiedLabel={t.copied}
                        failedLabel={t.copyFailed}
                    />
                    <ShareMenu
                        getText={() => buildShareText(answer, sources, { sourcesLabel: t.sources, footer: `${t.shareFooter}: ${SITE_URL}` })}
                        strings={t}
                    />
                    <ReadAloud text={answer} speechLang={lang.speechLang} strings={t} />
                    {isLast && (
                        <ActionButton icon={<RotateCcw size={16} />} label={t.regenerate} onClick={onRegenerate} />
                    )}
                    <FeedbackButtons
                        messageId={message.id}
                        sourceType={provenance?.source}
                        citationHosts={citationHosts}
                        strings={t}
                    />
                    {time && (
                        <time
                            dateTime={new Date(createdAt!).toISOString()}
                            className="ml-auto pl-2 text-xs tabular-nums text-muted"
                        >
                            {time}
                        </time>
                    )}
                </div>
            )}

            {isLast && !isStreaming && <FollowUps items={followups} strings={t} onSelect={onFollowUp} />}
        </article>
    );
}
