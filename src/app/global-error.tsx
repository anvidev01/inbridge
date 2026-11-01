"use client";

/**
 * app/global-error.tsx: last-resort boundary for errors in the root layout.
 * Replaces the root layout, so it renders its own <html>/<body>. The theme
 * bootstrap and next/font do not run here, so :root dark tokens apply and the
 * font variables globals.css expects (--font-inter etc.) are defined inline on
 * <html> with system fallbacks; otherwise --font-sans/--font-serif would be
 * invalid and text would render in the browser default serif.
 */
import { useEffect, type CSSProperties } from "react";
import { Logo } from "@/components/site/Logo";

const FALLBACK_FONTS = {
  "--font-inter": 'system-ui, -apple-system, "Segoe UI", Roboto, sans-serif',
  "--font-noto-deva": '"Noto Sans Devanagari", "Nirmala UI", sans-serif',
  "--font-source-serif": 'Georgia, "Times New Roman", serif',
  "--font-noto-serif-deva": '"Noto Serif Devanagari", serif',
} as CSSProperties;
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
    <html lang="en-IN" data-theme="dark" style={FALLBACK_FONTS}>
      <head>
        <title>Something went wrong · InBridge</title>
      </head>
      <body className="min-h-dvh bg-bg text-fg font-sans antialiased">
        <main id="main-content" className="min-h-dvh flex flex-col px-5 sm:px-8 lg:px-12 py-6 sm:py-8">
          {/* Full reload on purpose: the root layout itself failed */}
          {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
          <a href="/" aria-label="InBridge home" className="inline-flex min-h-11 items-center self-start transition-opacity hover:opacity-80">
            <Logo />
          </a>
          <div className="flex-1 flex items-center py-12 lg:pl-[calc(42vw_-_3rem)]">
            <div>
              <h1 className="font-serif text-[length:clamp(2.75rem,1rem_+_6.4vw,6.5rem)] leading-[0.95] tracking-[-0.035em] text-balance">
                Something went wrong
              </h1>
              <p className="mt-8 max-w-[48ch] text-lg leading-[1.65]">
                InBridge failed to load. Try again, or reload the page in a moment.
              </p>
              <div className="mt-10 flex flex-col items-start gap-x-8 gap-y-3 sm:flex-row sm:items-center">
                <button
                  type="button"
                  onClick={() => reset()}
                  className="inline-flex min-h-12 items-center justify-center bg-accent px-6 text-lg font-medium text-accent-fg transition-[filter,transform] duration-200 hover:brightness-110 active:translate-y-px"
                >
                  Try again
                </button>
                <a
                  href="/chat"
                  className="inline-flex min-h-12 items-center text-lg text-fg underline decoration-accent decoration-1 underline-offset-[5px] transition-[text-decoration-thickness,color] duration-200 hover:decoration-[3px] hover:text-accent"
                >
                  Ask InBridge
                </a>
              </div>
              {error.digest && (
                <p className="mt-10 text-sm text-muted break-all">Error reference: {error.digest}</p>
              )}
            </div>
          </div>
        </main>
      </body>
    </html>
  );
}
