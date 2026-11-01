"use client";

/**
 * app/global-error.tsx — last-resort boundary for errors in the root layout
 * Replaces the root layout, so it renders its own <html>/<body>. The theme
 * bootstrap and next/font do not run here: :root dark tokens and the font
 * fallbacks in globals.css apply.
 */
import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Message and digest only; never user content
    console.error("Global error", error.digest ?? "", error.message);
  }, [error]);

  return (
    <html lang="en-IN" data-theme="dark">
      <head>
        <title>Something went wrong · InBridge</title>
      </head>
      <body className="min-h-dvh bg-bg text-fg font-sans antialiased">
        <main
          id="main-content"
          className="min-h-dvh flex flex-col items-center justify-center px-5 py-16 text-center"
        >
          {/* Full reload on purpose: the root layout itself failed */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a
            href="/"
            className="inline-flex min-h-11 items-center px-2 font-serif text-3xl font-semibold tracking-tight text-fg"
          >
            InBridge
          </a>
          <h1 className="mt-10 font-serif text-2xl font-semibold">Something went wrong</h1>
          <p className="mt-4 max-w-md text-base text-muted">
            InBridge failed to load. Try again, or reload the page in a moment.
          </p>
          <div className="mt-8 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-base font-medium text-accent-fg transition-opacity hover:opacity-90"
            >
              Try again
            </button>
            <a
              href="/chat"
              className="inline-flex min-h-11 items-center justify-center rounded-full border border-line bg-surface px-6 text-base font-medium text-fg transition-colors hover:bg-surface-2"
            >
              Ask InBridge
            </a>
          </div>
          {error.digest && (
            <p className="mt-8 text-sm text-muted break-all">Error reference: {error.digest}</p>
          )}
        </main>
      </body>
    </html>
  );
}
