import React from 'react';
import { AlertTriangle, Database, Globe } from 'lucide-react';

import type { Provenance } from '@/lib/chat/protocol';
import type { AnswerStrings } from '@/lib/answer/strings';
import { formatDateTime } from '@/lib/answer/format';

interface ProvenanceLineProps {
    provenance: Provenance;
    strings: AnswerStrings;
    /** BCP-47 tag for date formatting. */
    locale: string;
}

/** One line under the answer saying where its context came from, based on the server's real source value. */
export function ProvenanceLine({ provenance, strings, locale }: ProvenanceLineProps) {
    const when = formatDateTime(provenance.retrievedAt, locale);

    let icon: React.ReactNode;
    let text: string;
    let tone = 'text-muted';
    switch (provenance.source) {
        case 'vector_store':
            icon = <Database size={14} />;
            text = strings.provenanceDataset(provenance.datasetLabel);
            break;
        case 'tavily_search':
            icon = <Globe size={14} />;
            text = strings.provenanceLive(when);
            break;
        case 'cache':
            icon = <Globe size={14} />;
            text = strings.provenanceCache(when);
            break;
        case 'llm_direct':
        default:
            icon = <AlertTriangle size={14} />;
            text = strings.provenanceNone;
            tone = 'text-danger';
            break;
    }

    return (
        <p className={`mt-4 flex items-start gap-1.5 text-[13px] leading-snug ${tone}`}>
            <span aria-hidden="true" className="mt-0.5 shrink-0">{icon}</span>
            <span>{text}</span>
        </p>
    );
}
