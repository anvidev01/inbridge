/**
 * Structured JSON logging for the Next.js chat plane.
 *
 * The Go backend logs with zerolog, which emits `{"level","time","message",...}`.
 * This module emits the *same* field names so a single aggregator query
 * (`level:error`, `service:chat-api`) spans both planes instead of needing one
 * parser per service.
 *
 * Zero dependencies on purpose: this runs in the Vercel Node runtime where every
 * added package is cold-start latency, and the whole surface is JSON.stringify
 * plus a level filter. Reach for pino only if sampling or transports are needed.
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

const LEVEL_ORDER: Record<LogLevel, number> = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3,
};

export interface LogFields {
    [key: string]: unknown;
}

/**
 * Field names whose values are replaced with "[redacted]" before serialisation.
 *
 * This service handles Aadhaar/VID numbers and citizen queries, and logs are
 * shipped to third-party aggregators. Redaction is applied by *key name* rather
 * than by scanning values, so a caller that passes a whole request object cannot
 * accidentally leak a credential it forgot about.
 */
const REDACTED_KEYS = new Set([
    'aadhaar',
    'vid',
    'password',
    'token',
    'authorization',
    'api_key',
    'apikey',
    'jwt',
    'email',
    'phone',
    'query',
    'prompt',
    'message_text',
    'content',
]);

const REDACTED = '[redacted]';

function minLevel(): number {
    const configured = (process.env.LOG_LEVEL || 'info').toLowerCase() as LogLevel;
    return LEVEL_ORDER[configured] ?? LEVEL_ORDER.info;
}

/**
 * Recursively replaces sensitive values and makes the payload JSON-safe.
 * Errors become `{message, name}` rather than the `{}` that JSON.stringify
 * produces for an Error instance.
 */
function sanitise(value: unknown, depth = 0): unknown {
    if (depth > 4) return '[truncated]';

    if (value instanceof Error) {
        return { name: value.name, message: value.message };
    }
    if (value === null || typeof value !== 'object') {
        return value;
    }
    if (Array.isArray(value)) {
        return value.slice(0, 20).map((v) => sanitise(v, depth + 1));
    }

    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
        out[k] = REDACTED_KEYS.has(k.toLowerCase()) ? REDACTED : sanitise(v, depth + 1);
    }
    return out;
}

function emit(level: LogLevel, message: string, fields: LogFields = {}): void {
    if (LEVEL_ORDER[level] < minLevel()) return;

    const record: Record<string, unknown> = {
        level,
        time: new Date().toISOString(),
        service: 'chat-api',
        message,
    };

    for (const [k, v] of Object.entries(fields)) {
        // Never let a caller field shadow the envelope keys.
        if (k === 'level' || k === 'time' || k === 'message') continue;
        record[k] = REDACTED_KEYS.has(k.toLowerCase()) ? REDACTED : sanitise(v);
    }

    const line = JSON.stringify(record);

    // Route to the matching console method so platform log viewers that colour
    // by stream (Vercel, CloudWatch) still classify these correctly.
    if (level === 'error') console.error(line);
    else if (level === 'warn') console.warn(line);
    else console.log(line);
}

export const log = {
    debug: (message: string, fields?: LogFields) => emit('debug', message, fields),
    info: (message: string, fields?: LogFields) => emit('info', message, fields),
    warn: (message: string, fields?: LogFields) => emit('warn', message, fields),
    error: (message: string, fields?: LogFields) => emit('error', message, fields),
};

/** Exported for tests. */
export const __internal = { sanitise, REDACTED_KEYS };
