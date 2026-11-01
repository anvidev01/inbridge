/**
 * app/page.tsx: Landing page, set as a printed report.
 * Every factual claim carries a footnote marker [n] that links to the Sources
 * list at the foot of the page. Every number is computed from the myScheme
 * dataset at build time; there are no user counts, testimonials, logos or
 * accuracy claims. The only client JS is the live dataset search
 * (SchemeProbe) and the scroll entrances (Reveal).
 */
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { Reveal } from '@/components/site/Reveal';
import { Hero, HERO_PHOTOS } from '@/components/landing/Hero';
import { HowItWorks } from '@/components/landing/HowItWorks';
import { SchemeProbe } from '@/components/landing/SchemeProbe';
import { Stats } from '@/components/landing/Stats';
import { Proof } from '@/components/landing/Proof';
import { Faq } from '@/components/landing/Faq';
import { Closing, CLOSING_PHOTOS } from '@/components/landing/Closing';
import { SourcesList } from '@/components/landing/SourcesList';
import { parseProbeParams, probeStates, runProbe } from '@/components/landing/scheme-query';
import { T } from '@/components/landing/type';
import { DATASET_LABEL, getFilterOptions, getScheme, getStats } from '@/lib/schemes';
import '@/components/landing/landing.css';

export const metadata: Metadata = {
    title: { absolute: 'InBridge: ask about any Indian government scheme, with answers linked to official sources' },
    description:
        'An independent AI assistant for Indian government schemes. Ask in English, Hindi or Hinglish; answers link to official .gov.in and .nic.in sources.',
    alternates: { canonical: '/' },
};

/** The live search opens on a real question, answered from the real dataset. */
const PROBE_TEXT = 'scholarship for girls in Bihar';

export default function HomePage() {
    const stats = getStats();
    const categories = getFilterOptions().categories;
    const pmKisan = getScheme('pm-kisan');

    const parsed = parseProbeParams(new URLSearchParams({ q: PROBE_TEXT }), probeStates());
    const initial = parsed.ok
        ? runProbe(parsed.query)
        : { q: '', state: null, total: 0, queryTooGeneral: false, items: [], href: '/services' };

    return (
        <div className={`${T.b} text-fg`}>
            <SiteHeader wide />
            <main id="main-content">
                <Hero total={stats.total} />
                {pmKisan && <HowItWorks scheme={pmKisan} />}
                <div className="mt-28 md:mt-36">
                    <SchemeProbe initialText={PROBE_TEXT} initial={initial} datasetTotal={stats.total} />
                </div>
                <Stats total={stats.total} categories={categories} />
                <Proof />
                <Faq total={stats.total} datasetLabel={DATASET_LABEL} />
                <Closing />
                <SourcesList />
            </main>
            <SiteFooter wide credits={[...HERO_PHOTOS, ...CLOSING_PHOTOS]} />
            <Reveal />
        </div>
    );
}
