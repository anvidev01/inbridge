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
    description: 'Upload a fillable PDF form, check your details, and download it filled in. Your details stay on your device.',
    alternates: { canonical: '/forms' },
};

export default function FormsPage() {
    return (
        <>
            <SiteHeader />
            <main id="main-content" className={`${PAGE_X} mx-auto w-full max-w-3xl py-10 sm:py-14`}>
                <h1 className={`${TYPE.head} font-serif font-medium`}>Fill a form</h1>
                <p className={`${TYPE.body} mt-4 text-muted`}>
                    Upload a fillable PDF form you downloaded from an official site, type your details, check the result
                    and download it to print. Your details and your form are processed in this browser tab only. They are
                    not uploaded, saved or sent to any AI. InBridge never submits anything for you.
                </p>
                <FormFiller />
            </main>
            <SiteFooter />
        </>
    );
}
