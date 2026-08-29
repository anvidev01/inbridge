/**
 * Vector-store diagnostic: dumps FAISS scores for sample queries.
 *
 * This is how the distance→similarity conversion in src/lib/rag-engine.ts was
 * derived. Run it after re-generating the vector store or changing the
 * embedding model, because both change what the score means:
 *
 *   node scripts/probe-vector-store.mjs
 *
 * What to look for:
 *   - "L2 norm" of an embedding. If it is 1.0 the vectors are unit-normalised,
 *     and FAISS's IndexFlatL2 score is *squared* L2 distance, so
 *     cosine = 1 - score/2. If the norm is not 1.0, none of the closed-form
 *     conversions hold and the threshold must be recalibrated empirically.
 *   - The gap between a relevant hit and an unrelated query. The similarity
 *     threshold belongs in that gap. As of this writing: relevant matches land
 *     at ~0.65-0.67 and unrelated queries at <=0.25, so the threshold is 0.5.
 *   - cos_if_L2 going below -1 is proof the score is squared, not plain, L2:
 *     cosine cannot leave [-1, 1].
 */

import { HuggingFaceTransformersEmbeddings } from "@langchain/community/embeddings/huggingface_transformers";
import { FaissStore } from "@langchain/community/vectorstores/faiss";

const emb = new HuggingFaceTransformersEmbeddings({ model: "Xenova/all-MiniLM-L6-v2" });
const store = await FaissStore.load("vector_store", emb);

// Are the embeddings unit-normalised? That determines what the L2 score means.
const v = await emb.embedQuery("How do I apply for PM-Kisan?");
const norm = Math.sqrt(v.reduce((s, x) => s + x * x, 0));
console.log("embedding dim:", v.length, "L2 norm:", norm.toFixed(6));

const queries = [
  "How do I apply for PM-Kisan?",
  "What documents do I need for an Aadhaar update?",
  "How do I check my PAN card application status?",
  "completely unrelated question about quantum mechanics",
];

for (const q of queries) {
  const res = await store.similaritySearchWithScore(q, 3);
  console.log(`\nQ: ${q}`);
  for (const [doc, score] of res) {
    // If embeddings are unit vectors and score is squared L2:  cos = 1 - score/2
    const cosFromSquared = 1 - score / 2;
    // If score were plain L2 distance:                          cos = 1 - score^2/2
    const cosFromPlain = 1 - (score * score) / 2;
    console.log(
      `   score=${score.toFixed(4)}  (1-score)=${(1 - score).toFixed(3)}` +
      `  cos_if_sqL2=${cosFromSquared.toFixed(3)}  cos_if_L2=${cosFromPlain.toFixed(3)}` +
      `  :: ${doc.pageContent.slice(0, 55).replace(/\s+/g, " ")}`
    );
  }
}

// Ground truth: cosine similarity computed directly, no FAISS involved.
console.log("\n--- direct cosine against stored docs ---");
const docs = Object.values(store.docstore._docs ?? {});
const q = "How do I apply for PM-Kisan?";
const qv = await emb.embedQuery(q);
for (const d of docs.slice(0, 4)) {
  const dv = await emb.embedQuery(d.pageContent);
  const dot = qv.reduce((s, x, i) => s + x * dv[i], 0);
  const nq = Math.sqrt(qv.reduce((s, x) => s + x * x, 0));
  const nd = Math.sqrt(dv.reduce((s, x) => s + x * x, 0));
  console.log(`   cos=${(dot / (nq * nd)).toFixed(3)} :: ${d.pageContent.slice(0, 55).replace(/\s+/g, " ")}`);
}
