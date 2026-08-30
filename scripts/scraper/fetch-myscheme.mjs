/**
 * Fetches the national government-scheme catalogue from the official myScheme
 * portal API and writes a cleaned dataset to data/myscheme_schemes.json.
 *
 * Source: https://api.myscheme.gov.in/search/v6/schemes  (the same public
 * endpoint the myscheme.gov.in frontend calls to render its scheme listing).
 * The portal is a Government of India public-information service whose purpose
 * is disseminating scheme data to citizens; robots.txt permits crawling.
 *
 * Auth: the endpoint requires the portal's public frontend `x-api-key`. It is
 * NOT secret — it ships in the site's client JS and is sent by every visitor's
 * browser — but it is deliberately kept OUT of this repo. Provide it via env:
 *
 *   MYSCHEME_API_KEY=<key> node scripts/scraper/fetch-myscheme.mjs
 *
 * The script paginates politely (size 100, ~1.2s between pages) and stops on
 * the first non-200 so a rate-limit or block is respected rather than retried.
 */

import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const KEY = process.env.MYSCHEME_API_KEY;
if (!KEY) {
  console.error("MYSCHEME_API_KEY is not set. See the header of this file.");
  process.exit(1);
}

const BASE = "https://api.myscheme.gov.in/search/v6/schemes";
const SIZE = 100;
const PAGE_DELAY_MS = 1200;
const HEADERS = {
  "x-api-key": KEY,
  "User-Agent": "InBridge-scheme-indexer/1.0 (+https://inbridge.in)",
  Origin: "https://www.myscheme.gov.in",
  Referer: "https://www.myscheme.gov.in/",
};

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

function cleanRecord(f) {
  const name = (f.schemeName || "").trim();
  const slug = (f.slug || "").trim();
  const brief = (f.briefDescription || "").trim();
  if (!name || !slug || brief.length < 40) return null;

  const ministry = (f.nodalMinistryName || "").trim();
  const states = (f.beneficiaryState || []).filter(Boolean);
  const issuer = ministry
    ? ministry
    : states.length && states[0] !== "All"
      ? `Government of ${states[0]}`
      : "Government of India";

  return {
    slug,
    name,
    short: (f.schemeShortTitle || "").trim(),
    issuer,
    level: f.level || "",
    states,
    categories: (f.schemeCategory || []).filter(Boolean),
    for: f.schemeFor || "",
    brief,
    tags: (f.tags || []).filter(Boolean),
    source: `https://www.myscheme.gov.in/schemes/${slug}`,
  };
}

async function main() {
  const q = encodeURIComponent("[]");
  const first = await fetch(`${BASE}?lang=en&q=${q}&keyword=&sort=&from=0&size=1`, { headers: HEADERS });
  if (!first.ok) throw new Error(`probe failed: HTTP ${first.status}`);
  const total = (await first.json()).data.summary.total;
  console.log(`Catalogue reports ${total} schemes. Paging at size ${SIZE}...`);

  const bySlug = new Map();
  for (let from = 0; from < total; from += SIZE) {
    const res = await fetch(`${BASE}?lang=en&q=${q}&keyword=&sort=&from=${from}&size=${SIZE}`, { headers: HEADERS });
    if (!res.ok) {
      console.error(`Stopping at from=${from}: HTTP ${res.status} (respecting the server).`);
      break;
    }
    for (const it of (await res.json()).data.hits.items) {
      const c = cleanRecord(it.fields || {});
      if (c && !bySlug.has(c.slug)) bySlug.set(c.slug, c);
    }
    process.stdout.write(`\r  fetched ${Math.min(from + SIZE, total)}/${total}`);
    await sleep(PAGE_DELAY_MS);
  }
  process.stdout.write("\n");

  const out = [...bySlug.values()].sort((a, b) => a.slug.localeCompare(b.slug));
  const dir = path.join(path.dirname(fileURLToPath(import.meta.url)), "data");
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, "myscheme_schemes.json"), JSON.stringify(out, null, 0));
  console.log(`Wrote ${out.length} unique schemes to data/myscheme_schemes.json`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
