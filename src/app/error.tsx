"use client";

/**
 * app/error.tsx: route-level error boundary.
 * Rendered inside the root layout. Links are plain <a> on purpose: a full
 * navigation clears the failed render even when the error came from /chat.
 */
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";
import { Logo } from "@/components/site/Logo";

const DISPLAY = "text-[length:clamp(2.75rem,1rem_+_6.4vw,6.5rem)] leading-[0.95] tracking-[-0.035em]";
const LEAD = "text-[length:clamp(1.25rem,1.1rem_+_0.6vw,1.5rem)] leading-[1.4]";
const LINK =
  "inline-flex min-h-12 items-center gap-2 text-lg text-fg underline decoration-accent decoration-1 underline-offset-[5px] transition-[text-decoration-thickness,color] duration-200 hover:decoration-[3px] hover:text-accent";

export default function RouteError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    // Message and digest only; never user content
    console.error("Route error", error.digest ?? "", error.message);
  }, [error]);

  return (
    <main id="main-content" className="min-h-dvh flex flex-col bg-bg text-fg px-5 sm:px-8 lg:px-12 py-6 sm:py-8">
      {/* Full navigation by design (see header) */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a href="/" aria-label="InBridge home" className="inline-flex min-h-11 items-center self-start transition-opacity hover:opacity-80">
        <Logo />
      </a>

      <div className="flex-1 flex items-center py-12 lg:pl-[calc(42vw_-_3rem)]">
        <div>
          <h1 className={`font-serif ${DISPLAY} text-balance`}>
            <span className="line-mask"><span>Something went wrong</span></span>
          </h1>
          <p lang="hi" className={`mt-8 ${LEAD}`}>कुछ गड़बड़ हो गई।</p>
          <p className="mt-4 max-w-[48ch] text-lg leading-[1.65]">
            This page failed to load. Try again, or start a new question.
          </p>

          <div className="mt-10 flex flex-col items-start gap-x-8 gap-y-3 sm:flex-row sm:items-center">
            <button
              type="button"
              onClick={() => reset()}
              className="inline-flex min-h-12 items-center justify-center gap-2 rounded-full bg-accent px-6 text-lg font-medium text-accent-fg transition-[filter,transform] duration-200 hover:brightness-110 active:translate-y-px"
            >
              <RotateCcw size={18} aria-hidden="true" />
              Try again
            </button>
            <a href="/chat" className={LINK}>Ask InBridge</a>
            {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
            <a href="/services" className={LINK}>Browse schemes</a>
          </div>

          {error.digest && (
            <p className="mt-10 text-sm text-muted break-all">Error reference: {error.digest}</p>
          )}
        </div>
      </div>
    </main>
  );
}
