/**
 * app/not-found.tsx — 404 page
 * Rendered inside the root layout, so tokens, fonts and the skip link apply.
 */
import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Page not found",
  robots: { index: false },
};

export default function NotFound() {
  return (
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-16 text-center bg-bg text-fg"
    >
      <Link
        href="/"
        className="inline-flex min-h-11 items-center px-2 font-serif text-3xl font-semibold tracking-tight text-fg"
      >
        InBridge
      </Link>

      <p className="mt-10 text-sm font-medium text-muted">404</p>
      <h1 className="mt-2 font-serif text-2xl sm:text-3xl font-semibold break-words">
        We couldn&apos;t find that page
      </h1>
      <p lang="hi" className="mt-2 text-base text-muted">
        यह पेज नहीं मिला।
      </p>
      <p className="mt-4 max-w-md text-base text-muted">
        The link may be old or mistyped. Ask your question directly, or browse the list of schemes.
      </p>

      <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <Link
          href="/chat"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-base font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          Ask InBridge
        </Link>
        <Link
          href="/services"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-6 text-base font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Browse schemes
        </Link>
      </div>
    </main>
  );
}
