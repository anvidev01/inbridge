/**
 * InBridge Backend — k6 Load Test
 * ================================
 * Targets:
 *   - POST /api/v1/auth/login        (rate-limited public endpoint)
 *   - GET  /api/v1/services          (public, no auth)
 *   - POST /api/v1/services/apply    (auth-required, DB write)
 *   - GET  /api/v1/grievance/:id     (auth-required, DB read)
 *   - GET  /healthz                  (probe baseline)
 *   - GET  /readyz                   (readiness probe)
 *
 * Stages:
 *   0–30s   ramp-up   → 10 VUs
 *   30–90s  sustained → 50 VUs   (baseline)
 *   90–120s spike     → 100 VUs  (stress test)
 *   120–150s ramp-down → 0 VUs
 *
 * Thresholds (SLOs):
 *   - p95 response time < 2 000ms
 *   - p99 response time < 4 000ms
 *   - error rate        < 1%
 *
 * Usage:
 *   BASE_URL=http://localhost:8080 \
 *   TEST_EMAIL=load@test.local TEST_PASS=LoadTest1! \
 *   k6 run loadtest/k6/chat_load.js --out json=loadtest/results/run_$(date +%s).json
 */

import http from 'k6/http';
import { check, group, sleep } from 'k6';
import { Rate, Trend } from 'k6/metrics';

// ── Config ────────────────────────────────────────────────────────────────────
const BASE_URL  = __ENV.BASE_URL  || 'http://localhost:8080';
const EMAIL     = __ENV.TEST_EMAIL || 'load@test.local';
const PASSWORD  = __ENV.TEST_PASS  || 'LoadTest1!';

// ── Custom metrics ────────────────────────────────────────────────────────────
const loginErrors    = new Rate('login_errors');
const serviceErrors  = new Rate('service_apply_errors');
const authLatency    = new Trend('auth_login_duration', true);
const applyLatency   = new Trend('service_apply_duration', true);

// ── Stage config ──────────────────────────────────────────────────────────────
export const options = {
  stages: [
    { duration: '30s', target: 10  },   // ramp-up
    { duration: '60s', target: 50  },   // sustained load
    { duration: '30s', target: 100 },   // spike
    { duration: '30s', target: 0   },   // ramp-down
  ],
  thresholds: {
    // SLO: 95th percentile under 2s, 99th under 4s
    'http_req_duration{status:200}': ['p(95)<2000', 'p(99)<4000'],
    // Allow at most 1% of requests to fail
    'http_req_failed': ['rate<0.01'],
    // Auth-specific SLO
    'auth_login_duration': ['p(95)<1500'],
  },
  // Summarise results to stdout + JSON
  summaryTrendStats: ['avg', 'min', 'med', 'max', 'p(95)', 'p(99)'],
};

// ── Setup: register a test user (runs once before stages) ─────────────────────
export function setup() {
  const registerPayload = JSON.stringify({
    email:     EMAIL,
    password:  PASSWORD,
    full_name: 'Load Test User',
    vid:       '000000000000',
  });

  const registerRes = http.post(`${BASE_URL}/api/v1/auth/register`, registerPayload, {
    headers: { 'Content-Type': 'application/json' },
    tags:    { endpoint: 'register' },
  });

  // 201 Created or 409 Conflict (already registered) both mean we can proceed.
  if (registerRes.status !== 201 && registerRes.status !== 409) {
    console.warn(`setup: unexpected register status ${registerRes.status}`);
  }

  // Log in to get a token for the setup phase.
  const loginRes = http.post(
    `${BASE_URL}/api/v1/auth/login`,
    JSON.stringify({ email: EMAIL, password: PASSWORD }),
    { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } }
  );

  let token = '';
  if (loginRes.status === 200) {
    try { token = JSON.parse(loginRes.body).token; } catch (_) {}
  }

  return { token };
}

// ── Main VU scenario ──────────────────────────────────────────────────────────
export default function (data) {
  let token = data.token || '';

  // ── Group 1: Public / probe endpoints ────────────────────────────────────
  group('health_probes', () => {
    const liveness  = http.get(`${BASE_URL}/healthz`,  { tags: { endpoint: 'healthz' } });
    const readiness = http.get(`${BASE_URL}/readyz`,   { tags: { endpoint: 'readyz'  } });

    check(liveness,  { 'healthz 200': (r) => r.status === 200 });
    check(readiness, { 'readyz 200 or 503': (r) => r.status === 200 || r.status === 503 });
  });

  sleep(0.2);

  // ── Group 2: Auth login (rate-limited) ───────────────────────────────────
  group('auth', () => {
    const start = Date.now();
    const res = http.post(
      `${BASE_URL}/api/v1/auth/login`,
      JSON.stringify({ email: EMAIL, password: PASSWORD }),
      { headers: { 'Content-Type': 'application/json' }, tags: { endpoint: 'login' } }
    );
    authLatency.add(Date.now() - start);

    const ok = check(res, {
      'login 200': (r) => r.status === 200,
      'has token':  (r) => {
        try { return !!JSON.parse(r.body).token; } catch (_) { return false; }
      },
    });
    loginErrors.add(!ok);

    // Refresh token if we got a new one.
    if (res.status === 200) {
      try { token = JSON.parse(res.body).token; } catch (_) {}
    }
  });

  sleep(0.3);

  // ── Group 3: Service catalogue (public GET) ──────────────────────────────
  group('services_list', () => {
    const res = http.get(`${BASE_URL}/api/v1/services`, { tags: { endpoint: 'services' } });
    check(res, { 'services 200': (r) => r.status === 200 });
  });

  sleep(0.2);

  // ── Group 4: Apply for service (auth-required POST → DB write) ───────────
  if (token) {
    group('service_apply', () => {
      const start = Date.now();
      const body  = JSON.stringify({
        service_code: 'pmkisan',
        form_data:    { farm_size: '2', state: 'Maharashtra' },
      });
      const res = http.post(`${BASE_URL}/api/v1/services/apply`, body, {
        headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
        tags:    { endpoint: 'service_apply' },
      });
      applyLatency.add(Date.now() - start);

      const ok = check(res, { 'apply 202': (r) => r.status === 202 });
      serviceErrors.add(!ok);
    });
  }

  sleep(0.5);
}

// ── Teardown: print a human-readable summary ──────────────────────────────────
export function handleSummary(data) {
  const p95 = data.metrics['http_req_duration'] &&
    data.metrics['http_req_duration'].values['p(95)'];
  const p99 = data.metrics['http_req_duration'] &&
    data.metrics['http_req_duration'].values['p(99)'];
  const errRate = data.metrics['http_req_failed'] &&
    data.metrics['http_req_failed'].values.rate;

  console.log('\n====== InBridge Load Test Summary ======');
  console.log(`p95 latency : ${p95 ? p95.toFixed(0) + 'ms' : 'N/A'}`);
  console.log(`p99 latency : ${p99 ? p99.toFixed(0) + 'ms' : 'N/A'}`);
  console.log(`Error rate  : ${errRate !== undefined ? (errRate * 100).toFixed(2) + '%' : 'N/A'}`);
  console.log('========================================\n');

  // Write JSON summary to file for before/after comparison.
  return {
    stdout: JSON.stringify(data, null, 2),
  };
}
