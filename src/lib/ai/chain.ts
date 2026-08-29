/**
 * Failover chain policy: which providers are tried, and in what order.
 *
 * Kept separate from router.ts so the policy can be unit-tested without
 * importing the Anthropic/Gemini/Groq SDKs.
 */

import type { LLMProvider } from '../observability/telemetry';

/**
 * Preference order used once the primary is chosen.
 * Anthropic first for answer quality, Groq last as the cheap/fast backstop.
 */
export const PREFERENCE_ORDER: LLMProvider[] = ['anthropic', 'gemini', 'groq'];

export const API_KEY_ENV: Record<LLMProvider, string> = {
    anthropic: 'ANTHROPIC_API_KEY',
    gemini: 'GOOGLE_GEMINI_API_KEY',
    groq: 'GROQ_API_KEY',
};

/** Env is injected rather than read globally so the policy is unit-testable. */
export type ProviderEnv = Record<string, string | undefined>;

export function isConfigured(provider: LLMProvider, env: ProviderEnv = process.env): boolean {
    return Boolean(env[API_KEY_ENV[provider]]);
}

/**
 * Builds the ordered failover chain for a request.
 *
 * Providers without a configured API key are dropped *before* any attempt is
 * made. This matters for the failover metric: treating "no key" as a failure
 * would make a single-provider deployment emit a failover on every request,
 * permanently inflating inbridge_llm_failovers_total and keeping the
 * failover-spike webhook alert firing. Only genuine runtime failures count.
 *
 * An explicitly requested provider that has no key is also dropped rather than
 * attempted -- failing a request because the caller named an unconfigured
 * provider is worse than serving it from a working one.
 */
export function buildChain(
    requestedProvider?: LLMProvider,
    env: ProviderEnv = process.env
): LLMProvider[] {
    const active = env.ACTIVE_AI_PROVIDER as LLMProvider | 'both' | undefined;

    // 'both' is a legacy value meaning "no specific primary" — fall through to
    // the preference order rather than treating it as a provider name.
    const configuredPrimary =
        active && active !== 'both' && PREFERENCE_ORDER.includes(active as LLMProvider)
            ? (active as LLMProvider)
            : 'anthropic';

    const primary: LLMProvider = requestedProvider ?? configuredPrimary;

    const ordered = [primary, ...PREFERENCE_ORDER.filter((p) => p !== primary)];
    return ordered.filter((p) => isConfigured(p, env));
}
