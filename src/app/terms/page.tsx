/**
 * app/terms/page.tsx: the terms of use.
 * Plain-language terms: informational service, no affiliation, external
 * links, acceptable use, limitation of liability, Indian law.
 */
import type { Metadata } from 'next';
import Link from 'next/link';
import { InfoBand, InfoPage, InfoSection } from '@/components/site/InfoPage';
import { CONTACT_URL } from '@/components/site/SiteFooter';

export const metadata: Metadata = {
    title: 'Terms of use',
    description: 'The terms for using InBridge, an independent AI assistant for information about Indian government schemes.',
    alternates: { canonical: '/terms' },
};

const UPDATED = '1 November 2026';

export default function TermsPage() {
    return (
        <InfoPage
            title="Using InBridge"
            updated={UPDATED}
            photos={['bridge-crowd', 'village-school', 'station', 'farmer']}
            intro={
                <p>
                    These are the terms of use. By using InBridge you agree to them. They are written to be read, so
                    please do.
                </p>
            }
        >
            <InfoSection id="information-only" title="Information only">
                <p>
                    InBridge gives general information about Indian government schemes and services, written by an AI
                    model from a scheme dataset and from government websites. It is not legal, financial, tax or medical
                    advice, and it is not a decision about whether you qualify for anything.
                </p>
                <p>
                    Answers can be wrong, incomplete or out of date. Always confirm details, eligibility, documents, fees
                    and deadlines on the official page linked in each answer before you act on them.
                </p>
            </InfoSection>

            <InfoSection id="not-government" title="Not a government service">
                <p>
                    InBridge is independent. It is not run by, affiliated with or endorsed by the Government of India,
                    any State or Union Territory government, or any government department or agency. Scheme names and
                    department names are used only to describe them.
                </p>
                <p>
                    InBridge does not file applications or complaints, check application status, or collect payments.
                    Any application, complaint or payment happens on the official portal, under that portal&apos;s terms.
                </p>
            </InfoSection>

            <InfoSection id="links" title="Links to other websites">
                <p>
                    Answers and scheme pages link to government and other external websites. We do not control those
                    sites and are not responsible for their content, availability or how they handle your data.
                </p>
            </InfoSection>

            <InfoSection id="acceptable-use" title="Acceptable use">
                <p>Please do not:</p>
                <ul>
                    <li>enter Aadhaar numbers, PAN, OTPs, passwords, bank details or other people&apos;s personal data;</li>
                    <li>use InBridge for anything unlawful, or to harass, deceive or impersonate anyone;</li>
                    <li>try to break, overload or bypass the service&apos;s safety and rate limits, or scrape it automatically;</li>
                    <li>present InBridge answers as official government statements.</li>
                </ul>
                <p>We may limit or block access that breaks these rules or puts the service at risk.</p>
            </InfoSection>

            <InfoSection id="liability" title="No guarantee, and limits on liability">
                <p>
                    InBridge is provided free, &ldquo;as is&rdquo; and &ldquo;as available&rdquo;, without any promise
                    that it is accurate, complete or always online. To the extent the law allows, the people who build
                    and run InBridge are not liable for any loss or damage arising from your use of it or reliance on
                    its answers, including missed benefits or deadlines. Nothing in these terms limits rights you have
                    that cannot be limited by law.
                </p>
            </InfoSection>

            <InfoBand>
                <InfoSection id="your-data" title="Your data">
                    <p>
                        How we handle your data is explained in the <Link href="/privacy">Privacy notice</Link>.
                    </p>
                </InfoSection>

                <InfoSection id="changes" title="Changes">
                    <p>
                        We may update these terms as the service changes. The date at the top shows the latest version.
                        Continuing to use InBridge after a change means you accept the updated terms.
                    </p>
                </InfoSection>

                <InfoSection id="law" title="Governing law">
                    <p>These terms are governed by the laws of India.</p>
                </InfoSection>

                <InfoSection id="contact" title="Contact">
                    <p>
                        Questions about these terms: open an issue on the project&apos;s{' '}
                        <a href={CONTACT_URL} target="_blank" rel="noopener noreferrer">GitHub issues page</a>. Please do
                        not post personal details there.
                    </p>
                </InfoSection>
            </InfoBand>
        </InfoPage>
    );
}
