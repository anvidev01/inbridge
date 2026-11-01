/** Date/time formatting for answers (Intl only; no date library). */

/** "3:42 pm" in the given locale, or '' when the timestamp is missing/invalid. */
export function formatTime(epochMs: number | undefined, locale: string, timeZone?: string): string {
    if (typeof epochMs !== 'number' || !Number.isFinite(epochMs)) return '';
    try {
        return new Intl.DateTimeFormat(locale, { hour: 'numeric', minute: '2-digit', timeZone }).format(epochMs);
    } catch {
        return '';
    }
}

/** "1 Nov 2026, 3:42 pm" for an ISO string, or '' when unparseable. */
export function formatDateTime(iso: string | undefined, locale: string, timeZone?: string): string {
    if (!iso) return '';
    const ms = Date.parse(iso);
    if (Number.isNaN(ms)) return '';
    try {
        return new Intl.DateTimeFormat(locale, {
            day: 'numeric',
            month: 'short',
            year: 'numeric',
            hour: 'numeric',
            minute: '2-digit',
            timeZone,
        }).format(ms);
    } catch {
        return '';
    }
}
