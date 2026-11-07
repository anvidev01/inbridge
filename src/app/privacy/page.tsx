/**
 * app/privacy/page.tsx: the privacy notice.
 * Itemised to the structure DPDP Rule 3 describes (data, purpose, processors,
 * retention, deletion, contact, complaint to the Board). Says "built with ...
 * in mind", never "compliant". Every statement must match what the code does;
 * update this page when data handling changes.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoBand, InfoPage, InfoSection } from '@/components/site/InfoPage';
import { CONTACT_URL } from '@/components/site/SiteFooter';

export const metadata: Metadata = {
    title: 'Privacy',
    description: 'What data InBridge handles, why, who processes it, how long it is kept and how to delete it.',
    alternates: { canonical: '/privacy' },
};

const UPDATED = '1 November 2026';

export default function PrivacyPage() {
    return (
        <InfoPage
            title="Your data on InBridge"
            updated={UPDATED}
            masthead="lead"
            quiet
            photos={['post-office', 'bridge-crowd', 'farmer', 'station']}
            intro={
                <p>
                    You can use InBridge without an account; signing in is optional and only adds saved conversations
                    across devices. This notice lists everything we handle, why, and who else
                    processes it. It is built with DPDP Act 2023 (Digital Personal Data Protection Act) requirements in
                    mind.
                </p>
            }
        >
            <InfoSection id="identity-numbers" title="Please don't share identity numbers">
                <p>
                    You never need to give InBridge your Aadhaar number, PAN, OTPs, bank account details or passwords.
                    Messages that look like an Aadhaar or PAN number are blocked before they reach the AI model. If you
                    need to act on your own records, do it on the official government portal.
                </p>
            </InfoSection>

            <InfoSection id="what-we-handle" title="What we handle and why">
                <h3>The questions you type or speak</h3>
                <ul>
                    <li>
                        <strong>What:</strong> the text of your messages and the recent conversation, plus the language and
                        topic you choose.
                    </li>
                    <li>
                        <strong>Speaking instead of typing:</strong> the microphone is used only while you press the mic
                        button in the chat box. Speech recognition is done by your browser, not by InBridge, and your
                        audio may be processed by the browser vendor (for example, Google for Chrome) under its own
                        policy. InBridge receives only the resulting text, exactly as if you had typed it.
                    </li>
                    <li>
                        <strong>Why:</strong> to find relevant scheme information and write an answer.
                    </li>
                    <li>
                        <strong>Where it goes:</strong> to our server, which searches the scheme dataset on the server
                        itself; to an AI model provider to write the answer; and, when the dataset is not enough, a search
                        query is sent to a search provider that looks only at .gov.in and .nic.in websites.
                    </li>
                    <li>
                        <strong>Kept:</strong> we do not save your messages in a database. Search results for a question
                        may be kept in server memory for up to 15 minutes so a repeated question is faster; that memory
                        clears when the server restarts.
                    </li>
                </ul>

                <h3>Your chat history</h3>
                <ul>
                    <li>
                        <strong>What:</strong> past conversations and small preferences such as theme and language.
                    </li>
                    <li>
                        <strong>Where:</strong> in your browser&apos;s local storage on your device. If you are not signed
                        in, it is not uploaded to us. If you sign in, your conversations are also saved to your account
                        (see below) so you can continue them on another device. The storage keys are <code>inbridge_threads_v1</code> (chat history),{' '}
                        <code>inbridge_language</code>, <code>inbridge_onboarding_v1</code>, <code>inbridge_theme</code>,{' '}
                        <code>inbridge_feedback:*</code> (which answers you rated) and <code>inbridge_checklist:*</code>{' '}
                        (ticked checklist items). When you are signed in,{' '}
                        <code>inbridge_token</code>, <code>inbridge_user</code> and <code>inbridge_threads_owner</code>{' '}
                        also hold your sign-in session and which account the saved history belongs to.
                    </li>
                    <li>
                        <strong>Kept:</strong> until you delete it (see &ldquo;How to delete your data&rdquo; below).
                    </li>
                </ul>

                <h3>Your IP address</h3>
                <ul>
                    <li>
                        <strong>Why:</strong> to limit how many messages one connection can send per minute, so the service
                        stays available for everyone.
                    </li>
                    <li>
                        <strong>Kept:</strong> used to count requests per minute for rate limiting; held in server memory
                        only for that window, never written to a database. Our hosting provider also records IP addresses
                        in its standard request logs under its own policy.
                    </li>
                </ul>

                <h3>Feedback on answers</h3>
                <ul>
                    <li>
                        <strong>What:</strong> a thumbs up or down, any reason codes you pick, an optional short note you
                        write (personal numbers such as phone or Aadhaar numbers are masked before it is logged), the kind
                        of source the answer used, the website names it cited and a random ID for the answer. It never
                        includes your question or the answer text.
                    </li>
                    <li>
                        <strong>Where:</strong> written as one structured line in our server logs, which are kept by our
                        hosting provider. Feedback is not stored in a database.
                    </li>
                    <li>
                        <strong>Why:</strong> to find and fix wrong or outdated answers.
                    </li>
                </ul>

                <h3>Account details, only if you sign in</h3>
                <ul>
                    <li>
                        <strong>What:</strong> your name, email address and a hashed password (never the password
                        itself), a randomly generated account ID, and, while you are signed in, your chat conversations
                        (your questions and the answers shown, with their sources).
                    </li>
                    <li>
                        <strong>Why:</strong> to keep you signed in and let you continue conversations on any device. Nothing
                        else is done with them.
                    </li>
                    <li>
                        <strong>Where:</strong> Render hosts the account service and Supabase (a PostgreSQL database in
                        Mumbai) stores the records. A sign-in lasts 24 hours.
                    </li>
                    <li>
                        <strong>Signing out</strong> removes the account&apos;s saved conversations from that device.
                        They stay in your account until you delete them.
                    </li>
                </ul>

                <p>
                    InBridge does not use advertising or analytics cookies and does not sell or share your data for
                    advertising.
                </p>
            </InfoSection>

            <InfoSection id="form-filling" title="Filling a form (/forms)">
                <p>
                    The form filler works inside your browser tab. The form you choose and the details you type are never
                    uploaded or stored, and closing or refreshing the page forgets them. Scans and photos are read by a
                    text reader that runs in your browser (its program and Hindi/English language data are downloaded from
                    a public CDN the first time, and that request contains nothing from your form).
                </p>
                <p>
                    To explain the form in simple words, the <strong>printed text of the blank form</strong> is sent to our
                    server and then to an AI provider (Google Gemini or Groq, whichever is available), after you press
                    &ldquo;Explain this form&rdquo;. Aadhaar, PAN and phone numbers in that text are hidden first, in your
                    browser and again on our server. The text is not stored or logged by InBridge. Free-tier AI services may
                    keep or review what they receive, so please upload a <strong>blank</strong> form: if a form already has
                    your name or address written on it, that text would be sent too. Your own details (the ones you type in
                    step 3) are never sent.
                </p>
                <p>
                    Aadhaar, PAN, bank, mobile and email fields are left empty unless you switch them on, and declarations
                    are never ticked for you. InBridge does not submit forms.
                </p>
            </InfoSection>

            <InfoSection id="processors" title="Who processes your data">
                <p>These companies process data for us to run the service. Some may process it outside India.</p>
                <ul>
                    <li>
                        <strong>AI model providers.</strong> Answers are written by a large language model: currently
                        Groq-hosted models, with Anthropic or Google Gemini used instead when configured. If one fails,
                        the next is tried. Whichever provider answers receives your messages and the retrieved scheme
                        information.
                    </li>
                    <li><strong>Tavily</strong> searches .gov.in and .nic.in websites. It receives a search query based on your message.</li>
                    <li><strong>Vercel</strong> hosts the website and the chat server. It handles all requests, including IP addresses, and keeps the server logs that hold feedback lines.</li>
                    <li><strong>Render and Supabase</strong> are used only if you sign in: Render hosts the account service and Supabase stores account records and saved conversations.</li>
                </ul>
                <p>Each provider keeps data under its own terms and privacy policy.</p>
            </InfoSection>

            <InfoSection id="delete" title="How to delete your data">
                <ul>
                    <li>
                        <strong>Chat history:</strong> delete conversations in the chat history panel, or clear this
                        site&apos;s data in your browser settings (site settings, then clear storage). Without an account
                        this removes every copy. When signed in, deleting a conversation or choosing clear all in the
                        panel also deletes it from your account; clearing browser storage alone does not.
                    </li>
                    <li>
                        <strong>Feedback:</strong> feedback is not linked to your name or email. Choosing a thumbs up or
                        down also saves that choice on your device under <code>inbridge_feedback:*</code>, which clearing
                        site data removes. If you wrote a note you want removed from the server logs, contact us below.
                    </li>
                </ul>
            </InfoSection>

            <InfoBand>
                <InfoSection id="rights" title="Your rights">
                    <p>
                        You can ask us what personal data we hold about you, and ask us to correct or delete it, or raise a
                        grievance about how it was handled. If you are not satisfied with our response, you have the right to
                        complain to the <strong>Data Protection Board of India</strong>.
                    </p>
                </InfoSection>

                <InfoSection id="contact" title="Contact">
                    <p>
                        For privacy questions or requests, open an issue on the project&apos;s{' '}
                        <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">GitHub issues page</a>. Issues are
                        public, so please do not include personal details in them; say what you need and we will arrange a
                        private channel.
                    </p>
                    <p>
                        See also the <Link href="/terms">Terms of use</Link> and{' '}
                        <Link href="/about">how InBridge works</Link>.
                    </p>
                </InfoSection>
            </InfoBand>
        </InfoPage>
    );
}
