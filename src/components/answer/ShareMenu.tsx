'use client';

import React, { useSyncExternalStore } from 'react';
import { Share2 } from 'lucide-react';

import { whatsappShareUrl } from '@/lib/answer/text';
import type { AnswerStrings } from '@/lib/answer/strings';
import { ActionButton } from './ActionButton';

const noopSubscribe = () => () => {};

interface ShareMenuProps {
    /** Built at click time: summary, source URLs and the InBridge footer. */
    getText: () => string;
    strings: AnswerStrings;
}

/**
 * Share an answer. Uses the Web Share API (the phone's share sheet, which
 * includes WhatsApp) when available, otherwise opens a WhatsApp link with the
 * text prefilled. There is no share-by-URL page: answers are not stored.
 */
export function ShareMenu({ getText, strings }: ShareMenuProps) {
    const onClick = async () => {
        const text = getText();
        if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
            try {
                await navigator.share({ title: 'InBridge', text });
                return;
            } catch (err) {
                // The user closed the sheet: do nothing. Anything else: fall back to WhatsApp.
                if (err instanceof DOMException && err.name === 'AbortError') return;
            }
        }
        window.open(whatsappShareUrl(text), '_blank', 'noopener,noreferrer');
    };

    // Server render has no navigator; the snapshot switches after hydration without a mismatch.
    const hasNativeShare = useSyncExternalStore(
        noopSubscribe,
        () => typeof navigator.share === 'function',
        () => false
    );

    return (
        <ActionButton
            icon={<Share2 size={16} />}
            label={hasNativeShare ? strings.share : strings.shareWhatsApp}
            onClick={onClick}
        />
    );
}
