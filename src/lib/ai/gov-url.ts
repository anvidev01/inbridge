/**
 * Government-domain checks, kept dependency-free so both the server (retrieval,
 * citation building) and the client (link rendering) can import them without
 * pulling in the Tavily or embedding runtimes.
 */

// Bare domain suffixes: Tavily's include_domains takes domains, not ".gov.in".
// The previous [".gov.in", ".nic.in"] made every Tavily search return zero
// results in production (logs: Tavily called, citations: 0, no error).
export const GOV_DOMAINS = ['gov.in', 'nic.in'];

/** True when a URL is hosted on an official Indian government domain. */
export function isGovUrl(url: string | undefined): boolean {
    if (!url) return false;
    try {
        const host = new URL(url).hostname.toLowerCase();
        return GOV_DOMAINS.some((d) => host === d || host.endsWith(`.${d}`));
    } catch {
        return false;
    }
}

/** Hostname without a leading "www.", or null when the URL is not http(s). */
export function displayHost(url: string): string | null {
    try {
        const parsed = new URL(url);
        if (parsed.protocol !== 'https:' && parsed.protocol !== 'http:') return null;
        return parsed.hostname.toLowerCase().replace(/^www\./, '');
    } catch {
        return null;
    }
}
