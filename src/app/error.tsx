"use client";

/**
 * app/error.tsx: route-level error boundary
 * Rendered inside the root layout. Links are plain <a> on purpose: a full
 * navigation clears the failed render even when the error came from /chat.
 */
import { useEffect } from "react";
import { RotateCcw } from "lucide-react";

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
    <main
      id="main-content"
      className="min-h-dvh flex flex-col items-center justify-center px-5 py-16 text-center bg-bg text-fg"
    >
      {/* Full navigation by design (see header) */}
      {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
      <a
        href="/"
        className="inline-flex min-h-11 items-center px-2 font-serif text-3xl font-semibold tracking-tight text-fg"
      >
        InBridge
      </a>

      <h1 className="mt-10 font-serif text-2xl sm:text-3xl font-semibold break-words">
        Something went wrong
      </h1>
      <p lang="hi" className="mt-2 text-base text-muted">
        कुछ गड़बड़ हो गई।
      </p>
      <p className="mt-4 max-w-md text-base text-muted">
        This page failed to load. Try again, or start a new question.
      </p>

      <button
        type="button"
        onClick={() => reset()}
        className="mt-6 inline-flex min-h-11 items-center justify-center gap-2 rounded-full px-4 text-base font-medium text-accent transition-colors hover:bg-surface-2"
      >
        <RotateCcw size={18} aria-hidden="true" />
        Try again
      </button>

      <div className="mt-4 flex w-full max-w-xs flex-col gap-3 sm:w-auto sm:max-w-none sm:flex-row">
        <a
          href="/chat"
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-accent px-6 text-base font-medium text-accent-fg transition-opacity hover:opacity-90"
        >
          Ask InBridge
        </a>
        {/* eslint-disable-next-line @next/next/no-html-link-for-pages */}
        <a
          href="/services"
          className="inline-flex min-h-11 items-center justify-center rounded-full border border-muted bg-surface px-6 text-base font-medium text-fg transition-colors hover:bg-surface-2"
        >
          Browse schemes
        </a>
      </div>

      {error.digest && (
        <p className="mt-8 text-sm text-muted break-all">Error reference: {error.digest}</p>
      )}
    </main>
  );
}
