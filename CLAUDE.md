# InBridge — project notes & change log

Reference for future work. Add a new entry at the top of the Change Log for every change.

## Architecture
- **Frontend + AI chat**: Next.js (App Router) on Vercel at https://inbridge.in. `/api/chat` runs the LLM failover chain (Anthropic, Gemini, Groq).
- **Backend**: Go (chi) in `backend/`, deployed on Render (free tier, Singapore) as `inbridge-api` — https://inbridge-api-2gwl.onrender.com. Handles auth, citizen profiles, service applications. Defined by `render.yaml`.
- **Data**: Supabase Postgres (Mumbai) via `DATABASE_URL` (use the *Session pooler* string), Upstash Redis via `REDIS_URL` (`rediss://`).
- Frontend reaches the backend through `NEXT_PUBLIC_API_URL` (browser-side fetches; JWT in `localStorage` as `inbridge_token`).

## Health checks
- `GET /healthz` liveness, `GET /readyz` readiness (postgres, redis, LLM breakers), `GET /api/v1/health`.
- Render free tier sleeps when idle; first request can take ~15–50s. Warm it before demos.

## Known issues / ops checklist
- If login/signup return 500: check `/readyz`. `postgres: down` usually means the Supabase project is paused (restore it) or `DATABASE_URL` is not the Session pooler string.
- `www.inbridge.in` must be added under Vercel → Settings → Domains or it shows a cert error.
- The product is intentionally chat-only: `/`, `/services`, `/grievance`, `/status`, `/apply/*` all redirect to `/chat` (only `/services/<slug>` detail pages and `/chat` render). Note `curl -L` hides this — use `curl -I` when checking status codes.

## Change Log
### 2026-11-01 — Vector store (4,740 schemes) works on Vercel
- **Root cause**: `faiss-node`'s native binary isn't traced into the Vercel function (`Could not locate the bindings file`), so `FaissStore.load` always failed and every query went to Tavily.
- **Fix**: `src/lib/vector-search.ts` — pure-JS reader + brute-force L2 search over the *same* `vector_store/faiss.index` (IndexFlatL2, 4,740 × 384) and `docstore.json`; identical scores to FaissStore, ~100 ms/query. `faiss-node` is no longer loaded at runtime (still used by `scripts/generate-vector-store-faiss.js` to build the index).
- **Embedding model shipped in repo**: `models/Xenova/all-MiniLM-L6-v2/` (q8, 23 MB, sha256 matches HF). fp32 (90 MB) is too big for git; q8 query embeddings match the fp32-built index at cosine ~0.99 and retrieve the same top docs. Falls back to HF hub download into `/tmp` if `models/` is missing. **If the index is rebuilt with a different model, update `models/` too.**
- **Bundling** (`next.config.ts`): force-include `models/**` and onnxruntime's linux/x64 binary; exclude other platforms, GPU providers, onnxruntime-web, faiss-node. `/api/chat` trace ≈ 127 MB (limit 250 MB). Dockerfile copies `models/`.
- Tests: `src/lib/__tests__/vector-search.test.ts` (includes a real-index retrieval test).

### 2026-11-01 — Live government search (Tavily) actually returns results
- **Root cause (from Vercel runtime logs)**: Tavily was called on every query but returned 0 results with no error — `include_domains` was `[".gov.in", ".nic.in"]` (leading dot). Combined with the FAISS failure below, every answer had empty context and the model replied "I cannot browse the live internet".
- **Fix** (`src/lib/rag-engine.ts`): new `searchGovPortals()` — searches with `includeDomains: ["gov.in","nic.in"]`, retries unrestricted with `site:` hints if empty, and re-checks every result with `isGovUrl()` so only `.gov.in`/`.nic.in` pages reach the LLM. Logs `Tavily search completed` with raw vs gov result counts. Recency queries (`isRecencyQuery`: latest/new/2026/deadline/नवीनतम…) go to live search *before* the static vector store. Tests: `src/lib/__tests__/gov-search.test.ts`.
- **Still open**: FAISS vector store fails on Vercel — `faiss-node` native binary (`node_modules/faiss-node/build/Release/*`) isn't traced into the function bundle, and the transformers.js embedding model also needs onnxruntime + a writable cache. Until fixed, all queries are answered from live Tavily search.

### 2026-11-01 — Fix Vercel build (npm 404)
- **Fix**: `npm install` failed on Vercel with `404 Not Found` for `@tigrisdata/vector@1.1.0`. Both `@tigrisdata/core` and `@tigrisdata/vector` have been removed from the npm registry (every version 404s). Neither is imported anywhere in the code, so both were dropped from `package.json` / `package-lock.json`. Verified with a clean `npm ci` + `npm run build`.
- **Open (not fixed yet)**: live `/api/chat` returns empty sources for every query — the FAISS vector store fails to load on Vercel (see commit 788fc46) and the Tavily fallback also returns nothing. Check runtime logs for `Failed to load vector store` / `Tavily search error` after this deploy.

### 2026-11-01 — Pre-showcase audit
- **Fix**: Grievance form submitted to `http://go-api:8080` (docker-compose hostname, unreachable on Vercel) via a server action with no auth. Replaced with a client-side helper `src/lib/submit-application.ts` that calls `NEXT_PUBLIC_API_URL` with the user's JWT; shows "Please log in" when unauthenticated and handles 401. Removed `src/app/actions.ts`.
- **Correction**: `GrievanceForm` is currently unreachable (its page redirects to `/chat`), so the fix above is latent and not visible in the live site; it only matters if the grievance page is re-enabled.
- **Audit (no code change)**: `/chat` and `/services/<slug>` return 200 (other pages redirect, see above); chat streaming works; CORS allows inbridge.in with Authorization header.
- **Found, requires dashboard action**: backend postgres/redis down on Render (login 500); `www.inbridge.in` missing from Vercel domains.
