/**
 * app/about/page.tsx: how InBridge works.
 * Who runs it, where answers come from (counts computed from the dataset),
 * which AI providers write them, what it does not do, known limits and an
 * accessibility statement that lists only what is implemented.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoPage, InfoSection } from '@/components/site/InfoPage';
import { CONTACT_URL, REPO_URL } from '@/components/site/SiteFooter';
import { DATASET_MONTH, getStats } from '@/lib/schemes';
import { DISCLAIMER } from '@/lib/site';

export const metadata: Metadata = {
    title: 'How InBridge works',
    description:
        'Who builds InBridge, where its answers come from, which AI models write them, what it does not do, and its known limits.',
    alternates: { canonical: '/about' },
};

export default function AboutPage() {
    const stats = getStats();
    const n = (v: number) => v.toLocaleString('en-IN');

    return (
        <InfoPage
            current="about"
            title="How InBridge works"
            photos={['bridge-fog', 'station', 'post-office', 'village-school']}
            intro={
                <p>
                    InBridge answers questions about Indian government schemes in plain language and links every
                    answer back to official sources, so you can check it yourself.
                </p>
            }
        >
            <InfoSection id="who" title="Who we are">
                <p>
                    InBridge is built by a small independent team. It is not a government website and is not affiliated
                    with, endorsed by or run on behalf of any government body. The code is open on{' '}
                    <a href={REPO_URL} target="_blank" rel="noopener noreferrer">GitHub</a>.
                </p>
                <p className="bg-surface px-6 py-5">{DISCLAIMER.en}</p>
            </InfoSection>

            <InfoSection id="sources" title="Where answers come from">
                <p>An answer is put together in up to three steps, in this order.</p>
                <h3>First, a scheme dataset from myScheme</h3>
                <p>
                    InBridge keeps a copy of the public scheme listing on myscheme.gov.in, a snapshot taken in{' '}
                    {DATASET_MONTH}. It has <strong>{n(stats.total)} schemes</strong>: {n(stats.central)} Central and{' '}
                    {n(stats.state)} State schemes, across {n(stats.categories)} categories, {n(stats.states)} states
                    and union territories, and {n(stats.issuers)} issuing ministries and governments.
                </p>
                <p>
                    For each scheme it holds the name, issuing department, level, states, categories, who it is for, a
                    short description, tags and the myScheme link. It does <strong>not</strong> hold eligibility rules,
                    document lists, benefit amounts, helplines or deadlines. You can browse it in the{' '}
                    <Link href="/services">scheme directory</Link>.
                </p>
                <h3>Then, a live search of government websites</h3>
                <p>
                    When the dataset is not enough, or you ask about something recent, InBridge searches the web through
                    Tavily, restricted to <strong>.gov.in</strong> and <strong>.nic.in</strong> websites. Every result is
                    checked again on our server, and pages from other domains are dropped before the AI sees them.
                </p>
                <h3>Last, an AI model writes the answer</h3>
                <p>
                    Answers are written by a large language model: currently Groq-hosted models, with Anthropic or
                    Google Gemini used instead when configured. If one fails, the next is tried. The model works only
                    from the information retrieved from the dataset and the live search, and is told to cite only the
                    sources it was given and to say so when it does not know.
                </p>
            </InfoSection>

            <InfoSection id="does-not" title="What InBridge does not do">
                <ul>
                    <li>It does not file applications or complaints for you. It can help you draft a complaint and point you to the official portal.</li>
                    <li>It does not fetch your application status or any personal record.</li>
                    <li>It does not need your Aadhaar, PAN, OTP or bank details, and blocks messages that look like Aadhaar or PAN numbers.</li>
                    <li>It does not decide whether you are eligible. Only the issuing department can.</li>
                </ul>
            </InfoSection>

            <InfoSection id="limits" title="Known limits">
                <ul>
                    <li>AI answers can be wrong or incomplete, even with sources. Check the linked official page.</li>
                    <li>The dataset is a snapshot. Schemes added, changed or closed after it was taken may be missing or out of date.</li>
                    <li>Live search depends on what government websites publish and what the search provider finds.</li>
                    <li>InBridge works in English, Hindi and Hinglish only.</li>
                    <li>Chat history is stored only in your browser, so it does not follow you to another device.</li>
                </ul>
            </InfoSection>

            <InfoSection id="accessibility" title="Accessibility">
                <p>We want InBridge to be usable by everyone. What is in place today:</p>
                <ul>
                    <li>Pages are built to be used with a keyboard, starting with a &ldquo;Skip to main content&rdquo; link.</li>
                    <li>A visible focus outline shows where you are when using a keyboard.</li>
                    <li>Pinch-zoom and browser text zoom are allowed.</li>
                    <li>Animations are switched off when your device asks for reduced motion.</li>
                    <li>Hindi text uses Noto Devanagari fonts with extra line spacing for readability.</li>
                    <li>Light and dark themes, and text inputs at a size that phones do not need to zoom into.</li>
                </ul>
                <p>
                    InBridge has not had an independent accessibility audit, and testing with screen readers is not yet
                    complete. If something is hard to use, please tell us on{' '}
                    <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">GitHub issues</a>.
                </p>
            </InfoSection>

            <InfoSection id="privacy" title="Privacy">
                <p>
                    You can use InBridge without an account. Read what we handle and who processes it in the{' '}
                    <Link href="/privacy">Privacy notice</Link>.
                </p>
            </InfoSection>
        </InfoPage>
    );
}
