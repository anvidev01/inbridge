/**
 * "Large questions, answers beside": every answer open, nothing collapses.
 * Answers follow what the code and the /about and /privacy pages say.
 */
import type { ReactNode } from 'react';
import { Ref } from './Ref';
import { MARGIN, T } from './type';

export function Faq({ total, datasetLabel }: { total: number; datasetLabel: string }) {
    const count = total.toLocaleString('en-IN');
    const rows: { q: string; a: ReactNode }[] = [
        {
            q: 'Is InBridge a government website?',
            a: (
                <>
                    No. InBridge is an independent AI assistant. It is not run by, affiliated with or endorsed by any
                    government body. Its answers link to official portals so you can confirm them there
                    <Ref to="search" />.
                </>
            ),
        },
        {
            q: 'Does it need my Aadhaar?',
            a: (
                <>
                    No. You never need to give your Aadhaar, PAN, OTP or bank details, and there is no sign-up.
                    Messages that look like an Aadhaar or PAN number are blocked before they reach the AI model
                    <Ref to="privacy" />.
                </>
            ),
        },
        {
            q: 'Where do answers come from?',
            a: (
                <>
                    First from a copy of the myScheme listing ({datasetLabel}, {count} schemes)
                    <Ref to="myscheme" />. When that is not enough, or the question is about something recent, from a
                    live search limited to .gov.in and .nic.in sites
                    <Ref to="search" />. An AI model writes the answer from those sources only, and can still be
                    wrong.
                </>
            ),
        },
        {
            q: 'Which languages does it answer in?',
            a: (
                <>
                    English, <span lang="hi">हिन्दी</span> and Hinglish, which is Hindi typed in Latin letters. You
                    pick the reply language in the chat
                    <Ref to="search" />, and you can speak your question where your browser supports it
                    <Ref to="privacy" />.
                </>
            ),
        },
        {
            q: 'Can it apply or file a complaint for me?',
            a: (
                <>
                    No. It cannot apply, check an application’s status or file a complaint. It can draft a complaint
                    for you to submit yourself on CPGRAMS, the government’s grievance portal
                    <Ref to="cpgrams" />, and it points you to the official portal to apply.
                </>
            ),
        },
        {
            q: 'Is my chat stored?',
            a: (
                <>
                    Not by InBridge. Your history stays in your browser, on your device. Messages go to an AI provider
                    to write the answer, and sometimes a search query goes to a search provider limited to .gov.in and
                    .nic.in sites; neither is saved in a database. Search results may stay in server memory for up to
                    15 minutes
                    <Ref to="privacy" />.
                </>
            ),
        },
    ];

    return (
        <section aria-labelledby="faq-heading" className={`${MARGIN} bg-surface py-28 md:py-36`}>
            <div className="md:grid md:grid-cols-12 md:gap-x-8">
                <h2 id="faq-heading" className={`${T.h} text-muted md:col-span-6`} data-reveal>
                    Questions people ask first
                </h2>
            </div>
            <dl>
                {rows.map((row) => (
                    <div key={row.q} className="mt-14 md:mt-20 md:grid md:grid-cols-12 md:gap-x-8" data-reveal>
                        <dt className={`${T.h} text-fg md:col-span-6 text-balance`}>{row.q}</dt>
                        <dd className={`${T.b} mt-3 md:mt-1.5 md:col-span-5 md:col-start-8 max-w-[44ch] text-fg text-pretty`}>
                            {row.a}
                        </dd>
                    </div>
                ))}
            </dl>
        </section>
    );
}
