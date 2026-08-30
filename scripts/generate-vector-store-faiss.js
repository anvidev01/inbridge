// scripts/generate-vector-store-faiss.js
//
// Builds the FAISS vector store InBridge's RAG pipeline retrieves from.
//
// Sources, in order of precedence:
//   1. CURATED  — a small set of hand-written, richly-detailed entries
//      (eligibility, documents, process, helpline) for the highest-traffic
//      services. These win over the scraped catalogue on slug collision.
//   2. SCRAPED  — the national scheme catalogue pulled from the official
//      myScheme portal by scripts/scraper/fetch-myscheme.mjs into
//      scripts/scraper/data/myscheme_schemes.json. Every record is traceable
//      to a live myscheme.gov.in/schemes/{slug} page.
//
// Regenerate after re-running the fetch:
//   node scripts/generate-vector-store-faiss.js

const fs = require("node:fs");
const path = require("node:path");
const { FaissStore } = require("@langchain/community/vectorstores/faiss");
const { HuggingFaceTransformersEmbeddings } = require("@langchain/community/embeddings/huggingface_transformers");

// ── 1. Curated entries ────────────────────────────────────────────────────────
// Kept deliberately rich. `id` doubles as the slug used to de-duplicate against
// the scraped catalogue.
const curated = [
  {
    pageContent: `Pradhan Mantri Kisan Samman Nidhi (PM-KISAN) provides financial assistance of ₹6,000 per year to eligible farmer families, payable in three equal installments of ₹2,000 every four months.

ELIGIBILITY:
- Small and marginal farmer families
- Cultivable landholding in the family's name
- Subject to exclusion criteria (income-tax payers, institutional landholders, etc.)
- Bank account mandatory for direct benefit transfer

REQUIRED DOCUMENTS:
- Land records / ownership proof
- Aadhaar card
- Bank account details
- Citizenship / identity proof

APPLICATION PROCESS:
1. Register at a Common Service Centre (CSC)
2. Self-register on the PM-KISAN portal
3. Contact the local agriculture / revenue office

ISSUING BODY: Ministry of Agriculture and Farmers Welfare
OFFICIAL PORTAL: https://pmkisan.gov.in
OFFICIAL PAGE: https://www.myscheme.gov.in/schemes/pm-kisan
HELPLINE: 155261 / 011-24300606`,
    metadata: {
      id: "pm-kisan",
      title: "Pradhan Mantri Kisan Samman Nidhi (PM-KISAN)",
      url: "https://www.myscheme.gov.in/schemes/pm-kisan",
      type: "welfare_scheme",
      level: "Central",
      issuer: "Ministry of Agriculture and Farmers Welfare",
      keywords: ["pmkisan", "pm-kisan", "kisan", "farmer", "agriculture", "6000"],
    },
  },
  {
    // Aadhaar is an identity SERVICE, not a welfare scheme. Retained because it
    // is a very common citizen query; counted separately from the scheme total.
    pageContent: `Aadhaar is a 12-digit unique identity number issued by UIDAI to residents of India, used for identity and address verification across government and financial services.

SERVICES AVAILABLE:
- New enrolment and registration
- Demographic updates (name, address, date of birth, mobile)
- Biometric updates
- e-Aadhaar / PVC card download

REQUIRED DOCUMENTS:
- Proof of identity (Passport, PAN, Voter ID, etc.)
- Proof of address (utility bill, bank statement, etc.)
- Date-of-birth proof

APPLICATION PROCESS:
1. Locate the nearest Aadhaar enrolment / update centre
2. Book an appointment on the UIDAI portal
3. Complete biometric capture at the centre

ISSUING BODY: Unique Identification Authority of India (UIDAI)
OFFICIAL PORTAL: https://uidai.gov.in
HELPLINE: 1947`,
    metadata: {
      id: "aadhaar",
      title: "Aadhaar (UIDAI Identity Service)",
      url: "https://uidai.gov.in",
      type: "identity_service",
      level: "Central",
      issuer: "Unique Identification Authority of India (UIDAI)",
      keywords: ["aadhaar", "uidai", "enrolment", "update", "identity"],
    },
  },
];

// ── 2. Scraped catalogue → Documents ──────────────────────────────────────────
function schemeToDocument(s) {
  const applicable =
    s.states && s.states.length && s.states[0] !== "All" ? s.states.join(", ") : "All India";
  const title = s.short ? `${s.name} (${s.short})` : s.name;

  const pageContent = [
    title,
    "",
    s.brief,
    "",
    `ISSUING BODY: ${s.issuer}`,
    `LEVEL: ${s.level}`,
    s.categories.length ? `CATEGORY: ${s.categories.join(", ")}` : null,
    applicable ? `APPLICABLE TO: ${applicable}` : null,
    s.for ? `INTENDED FOR: ${s.for}` : null,
    "",
    `OFFICIAL PAGE: ${s.source}`,
  ]
    .filter((x) => x !== null)
    .join("\n");

  const keywords = [
    s.slug,
    s.short,
    ...(s.tags || []),
    ...(s.categories || []),
  ]
    .filter(Boolean)
    .map((k) => String(k).toLowerCase());

  return {
    pageContent,
    metadata: {
      id: s.slug,
      title: s.name,
      url: s.source,
      type: "welfare_scheme",
      level: s.level,
      issuer: s.issuer,
      keywords,
    },
  };
}

function buildDocuments() {
  const dataPath = path.join(__dirname, "scraper", "data", "myscheme_schemes.json");
  const scraped = JSON.parse(fs.readFileSync(dataPath, "utf-8"));

  const curatedSlugs = new Set(curated.map((d) => d.metadata.id));
  const docs = [...curated];
  let skipped = 0;

  for (const s of scraped) {
    if (curatedSlugs.has(s.slug)) {
      skipped++; // curated entry already covers this scheme
      continue;
    }
    docs.push(schemeToDocument(s));
  }

  console.log(`Curated: ${curated.length} | scraped: ${scraped.length} | deduped against curated: ${skipped}`);
  return docs;
}

async function createVectorStore() {
  console.log("🚀 Building FAISS vector store...");
  const documents = buildDocuments();

  const embeddings = new HuggingFaceTransformersEmbeddings({
    model: "Xenova/all-MiniLM-L6-v2",
  });

  console.log(`📚 Embedding ${documents.length} documents (local, no API key)...`);
  const started = Date.now();
  const vectorStore = await FaissStore.fromDocuments(documents, embeddings);

  await vectorStore.save("./vector_store");
  console.log(`✅ Saved ${documents.length} documents to ./vector_store/ in ${((Date.now() - started) / 1000).toFixed(0)}s`);
}

createVectorStore().catch((e) => {
  console.error("❌ Error building vector store:", e);
  process.exit(1);
});
