'use client';

import { useState } from 'react';

import type { Citation } from '@/lib/chat/protocol';
import { citationsKey } from '@/lib/answer/markdown';

/**
 * Returns the same array reference for as long as the citation content is
 * unchanged. The AI SDK clones the in-flight message on every streamed chunk,
 * so data-part arrays get a new reference per token even when nothing changed.
 */
export function useStableCitations(citations: Citation[]): Citation[] {
    const [stable, setStable] = useState(citations);
    if (stable !== citations && citationsKey(stable) !== citationsKey(citations)) {
        // Adjusting state during render is React's supported pattern for
        // deriving from props; React re-renders before committing.
        setStable(citations);
        return citations;
    }
    return stable;
}
