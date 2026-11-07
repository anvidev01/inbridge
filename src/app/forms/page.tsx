/**
 * app/forms/page.tsx: fill a downloaded government form (PDF) in the browser.
 * All processing is client-side; see components/forms/FormFiller.tsx.
 */
import type { Metadata } from 'next';
import { SiteHeader } from '@/components/site/SiteHeader';
import { SiteFooter } from '@/components/site/SiteFooter';
import { FormFiller } from '@/components/forms/FormFiller';
import { PAGE_X, TYPE } from '@/components/site/InfoPage';

export const metadata: Metadata = {
    title: 'Fill a form',
    description: 'Upload a government form (PDF or photo). InBridge explains what it asks in simple words, then fills it in. Your details stay on your device.',
    alternates: { canonical: '/forms' },
};

export default function FormsPage() {
    return (
        <>
            <SiteHeader />
            <main id="main-content" className={`${PAGE_X} mx-auto w-full max-w-3xl py-10 sm:py-14`}>
                <h1 className={`${TYPE.head} font-serif font-medium`}>Fill a form</h1>
                <p className={`${TYPE.body} mt-4 text-muted`}>
                    Upload a government form: a PDF, or a photo of it, in English or Hindi. InBridge first explains in simple
                    words what each part is asking for, then fills it with your details and gives you a PDF or picture to
                    print. Your form and your details stay in this browser tab and are not saved. Only the printed text of
                    the blank form (with ID and phone numbers hidden) goes to the AI so it can explain the form. Your own
                    details are never sent. InBridge never submits anything for you.
                </p>
                <FormFiller />
            </main>
            <SiteFooter />
        </>
    );
}
