/**
 * app/not-found.tsx: the 404 page.
 * Rendered inside the root layout, so tokens, fonts and the skip link apply.
 * Same axis as the inner pages; the Howrah Bridge in fog sits in the left
 * column, credited under it.
 */
import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { Logo } from "@/components/site/Logo";
import { Reveal } from "@/components/site/Reveal";
import { AXIS, BUTTON, PAGE_X, PhotoCredits, TEXT_LINK, TYPE } from "@/components/site/InfoPage";
import { PHOTOS } from "@/lib/photos";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

const PHOTO = PHOTOS["bridge-fog"];

export default function NotFound() {
  return (
    <main id="main-content" className={`min-h-dvh flex flex-col bg-bg text-fg ${PAGE_X} py-6 sm:py-8`}>
      <Reveal />
      <Link href="/" aria-label="InBridge home" className="inline-flex min-h-11 items-center self-start text-fg transition-opacity hover:opacity-80">
        <Logo />
      </Link>

      <div className={`${AXIS} flex-1 items-center gap-y-12 py-12 lg:py-16`}>
        <div className="lg:col-start-2 lg:row-start-1">
          <h1 className={`font-serif ${TYPE.display} text-balance break-words`}>
            <span className="line-mask"><span>We couldn&apos;t find that page</span></span>
          </h1>
          <p lang="hi" className={`mt-8 ${TYPE.lead}`}>यह पेज नहीं मिला।</p>
          <p className={`mt-4 max-w-[48ch] ${TYPE.body}`}>
            The link may be old or mistyped. Ask your question directly, or browse the list of schemes.
          </p>
          <div data-reveal className="mt-10 flex flex-col items-start gap-x-8 gap-y-3 sm:flex-row sm:items-center">
            <Link href="/chat" className={BUTTON}>Ask InBridge</Link>
            <Link href="/services" className={`inline-flex min-h-12 items-center text-lg ${TEXT_LINK}`}>
              Browse schemes
            </Link>
          </div>
        </div>

        <figure data-reveal className="mt-12 lg:mt-0 lg:col-start-1 lg:row-start-1 lg:pr-16">
          <div className="relative aspect-[3/2] lg:aspect-[4/5] overflow-hidden bg-surface">
            <Image
              src={PHOTO.src}
              alt={PHOTO.alt}
              fill
              sizes="(min-width: 1024px) 38vw, 100vw"
              className="object-cover grayscale contrast-[1.05]"
            />
          </div>
          <figcaption className="mt-4">
            <PhotoCredits photos={["bridge-fog"]} />
          </figcaption>
        </figure>
      </div>
    </main>
  );
}
