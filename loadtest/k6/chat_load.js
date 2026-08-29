/**
 * InBridge — /api/chat Load Test
 * ==============================
 * Targets the Next.js chat endpoint, which is the expensive path:
 *   rate limit → guardrails/PII → RAG retrieval (cache | FAISS | Tavily) → LLM chain
 *
 * The backend CRUD endpoints are covered separately by api_load.js.
 *
 * Traffic shape
 * -------------
 * Real citizen traffic is heavily repetitive: a handful of scheme questions
 * ("how do I apply for PM-Kisan?") dominate, with a long tail of unique
 * phrasings. A load test that sends only unique queries would show the RAG
 * cache doing nothing, and one that sends a single query would show it doing
 * far too much. CACHE_HIT_RATIO models the mix, defaulting to 70% repeats.
 *
 * Usage
 * -----
 *   BASE_URL=http://localhost:3000 k6 run loadtest/k6/chat_load.js
 *
 *   # before/after the RAG cache (TTL 0 makes every lookup a miss):
 *   RAG_CACHE_TTL_MS=0 npm start   # then run with RUN_LABEL=before
 *   npm start                      # then run with RUN_LABEL=after
 */

import http from 'k6/http';
import { check } from 'k6';
import { Trend, Rate, Counter } from 'k6/metrics';

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL = __ENV.BASE_URL || 'http://localhost:3000';
const RUN_LABEL = __ENV.RUN_LABEL || 'unlabelled';
const CACHE_HIT_RATIO = Number(__ENV.CACHE_HIT_RATIO || 0.7);
const VUS = Number(__ENV.VUS || 20);
const DURATION = __ENV.DURATION || '60s';

// ── Custom metrics ────────────────────────────────────────────────────────────
// Split by traffic class: a blended p95 hides whether the cache is working.
const hotLatency = new Trend('chat_hot_query_duration', true);
const coldLatency = new Trend('chat_cold_query_duration', true);
const chatErrors = new Rate('chat_errors');
const rateLimited = new Counter('chat_rate_limited');

// ── Query pools ───────────────────────────────────────────────────────────────
// HOT: the repeated queries real traffic is dominated by. Kept small so they
// stay resident in the LRU.
const HOT_QUERIES = [
    'How do I apply for PM-Kisan?',
    'What documents do I need for an Aadhaar update?',
    'How do I check my PAN card application status?',
    'What is the eligibility for PM Awas Yojana?',
    'How do I file a grievance about a delayed pension?',
];

// COLD: templated to generate unique phrasings, so each one misses the cache.
const COLD_TEMPLATES = [
    'What is the procedure for scheme variant',
    'Explain the eligibility criteria for case',
    'Which office handles application type',
    'What is the deadline for submission batch',
];

function pickQuery() {
    if (Math.random() < CACHE_HIT_RATIO) {
        return { text: HOT_QUERIES[Math.floor(Math.random() * HOT_QUERIES.length)], hot: true };
    }
    const template = COLD_TEMPLATES[Math.floor(Math.random() * COLD_TEMPLATES.length)];
    // VU + iteration + random makes the query unique across the whole run.
    const nonce = `${__VU}-${__ITER}-${Math.floor(Math.random() * 1e6)}`;
    return { text: `${template} ${nonce}?`, hot: false };
}

export const options = {
    scenarios: {
        chat: {
            executor: 'constant-vus',
            vus: VUS,
            duration: DURATION,
            tags: { run: RUN_LABEL },
        },
    },
    thresholds: {
        // SLO for the retrieval path. The LLM call itself is provider-bound and
        // is not what this test is asserting on.
        'chat_hot_query_duration': ['p(95)<500'],
        'chat_cold_query_duration': ['p(95)<3000'],
        // Rate limiting is a correct 429, not a failure, so http_req_failed is
        // not a useful threshold here — chat_errors excludes 429s.
        'chat_errors': ['rate<0.05'],
    },
    summaryTrendStats: ['avg', 'min', 'med', 'p(95)', 'p(99)', 'max'],
};

export default function () {
    const { text, hot } = pickQuery();

    const body = JSON.stringify({
        messages: [{ role: 'user', parts: [{ type: 'text', text }] }],
        languageInstruction: 'Always respond in English only.',
    });

    const res = http.post(`${BASE_URL}/api/chat`, body, {
        headers: { 'Content-Type': 'application/json' },
        tags: { endpoint: 'chat', class: hot ? 'hot' : 'cold' },
        timeout: '60s',
    });

    if (hot) hotLatency.add(res.timings.duration);
    else coldLatency.add(res.timings.duration);

    if (res.status === 429) {
        rateLimited.add(1);
        // A 429 is the rate limiter behaving correctly. Counting it as an error
        // would make the error rate a measure of test configuration rather than
        // of service health.
        return;
    }

    // 200 = streamed answer. 500 = the chain ran but no LLM provider is
    // configured, which is expected when running the retrieval-path benchmark
    // without provider keys; ACCEPT_5XX makes that an explicit choice rather
    // than a silently ignored failure.
    const acceptable = __ENV.ACCEPT_5XX === 'true' ? [200, 500] : [200];

    const ok = check(res, {
        'status acceptable': (r) => acceptable.includes(r.status),
        'no guardrail rejection': (r) => r.status !== 400,
    });
    chatErrors.add(!ok);
}

export function handleSummary(data) {
    const q = (name, stat) => {
        const m = data.metrics[name];
        return m && m.values[stat] !== undefined ? m.values[stat].toFixed(1) : 'n/a';
    };

    const lines = [
        '',
        '═══════════ InBridge /api/chat — ' + RUN_LABEL + ' ═══════════',
        `VUs: ${VUS}   duration: ${DURATION}   cache hit ratio: ${CACHE_HIT_RATIO}`,
        '',
        'Hot (repeated) queries   p95: ' + q('chat_hot_query_duration', 'p(95)') + 'ms   p99: ' + q('chat_hot_query_duration', 'p(99)') + 'ms   med: ' + q('chat_hot_query_duration', 'med') + 'ms',
        'Cold (unique) queries    p95: ' + q('chat_cold_query_duration', 'p(95)') + 'ms   p99: ' + q('chat_cold_query_duration', 'p(99)') + 'ms   med: ' + q('chat_cold_query_duration', 'med') + 'ms',
        'All requests             p95: ' + q('http_req_duration', 'p(95)') + 'ms   p99: ' + q('http_req_duration', 'p(99)') + 'ms',
        '',
        'Requests: ' + (data.metrics.http_reqs ? data.metrics.http_reqs.values.count : 'n/a') +
            '   rate-limited: ' + (data.metrics.chat_rate_limited ? data.metrics.chat_rate_limited.values.count : 0),
        '════════════════════════════════════════════════════',
        '',
    ];

    return {
        stdout: lines.join('\n'),
        [`loadtest/results/chat_${RUN_LABEL}.json`]: JSON.stringify(data, null, 2),
    };
}
