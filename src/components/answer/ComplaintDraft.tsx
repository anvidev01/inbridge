import React from 'react';
import { ExternalLink, FileText } from 'lucide-react';

import type { AnswerStrings } from '@/lib/answer/strings';
import { CopyButton } from './ActionButton';

/** Public CPGRAMS portal, where citizens file grievances themselves. */
const CPGRAMS_URL = 'https://pgportal.gov.in/';

interface ComplaintDraftProps {
    draft: string;
    strings: AnswerStrings;
}

/**
 * Hand-off for grievance mode (F9): copy the drafted complaint and open the
 * official portal. InBridge never submits anything on the user's behalf.
 */
export function ComplaintDraft({ draft, strings }: ComplaintDraftProps) {
    return (
        <section aria-label={strings.draftTitle} className="mt-6 rounded-lg border border-line bg-surface p-4">
            <p className="flex items-center gap-2 text-base font-semibold text-fg">
                <FileText size={18} aria-hidden="true" className="text-accent" />
                {strings.draftTitle}
            </p>
            <div className="mt-3 flex flex-wrap gap-2">
                <CopyButton
                    getText={() => draft}
                    label={strings.copyDraft}
                    copiedLabel={strings.copied}
                    failedLabel={strings.copyFailed}
                    alwaysShowLabel
                    className="border border-line"
                />
                <a
                    href={CPGRAMS_URL}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex min-h-11 items-center gap-1.5 rounded-full bg-accent px-4 text-sm font-medium text-accent-fg"
                >
                    {strings.openCpgrams}
                    <ExternalLink size={14} aria-hidden="true" />
                    <span className="sr-only">{strings.newTab}</span>
                </a>
            </div>
            <p className="mt-3 text-sm text-muted">{strings.draftNotice}</p>
        </section>
    );
}
