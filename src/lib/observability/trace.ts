/**
 * In-memory trace of recent chat requests: which stage each reached and when.
 *
 * Built to find a rare stall (a request that sent its sources and then never
 * answered) without access to the platform's logs. A request that never reaches
 * "done" stays `open` with the last stage it passed. Read it from
 * GET /api/internal/providers (token-guarded). Per instance, newest last, capped;
 * no question text is ever recorded.
 */

export interface TraceStage {
    stage: string;
    atMs: number;
    detail?: string;
}

export interface Trace {
    id: string;
    startedAt: string;
    open: boolean;
    stages: TraceStage[];
}

const MAX_TRACES = 30;
const traces: Trace[] = [];

export function startTrace(): { mark: (stage: string, detail?: string) => void; end: (detail?: string) => void } {
    const started = Date.now();
    const trace: Trace = {
        id: Math.random().toString(36).slice(2, 8),
        startedAt: new Date(started).toISOString(),
        open: true,
        stages: [],
    };
    traces.push(trace);
    if (traces.length > MAX_TRACES) traces.shift();

    const mark = (stage: string, detail?: string) => {
        trace.stages.push({ stage, atMs: Date.now() - started, ...(detail ? { detail: detail.slice(0, 80) } : {}) });
    };
    return {
        mark,
        end: (detail?: string) => {
            mark('done', detail);
            trace.open = false;
        },
    };
}

/** Newest first. */
export function recentTraces(limit = 15): Trace[] {
    return traces.slice(-limit).reverse();
}
