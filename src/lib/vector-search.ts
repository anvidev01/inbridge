import fs from "fs/promises";
import os from "os";
import path from "path";

/**
 * Pure-JS replacement for FaissStore.load + similaritySearchWithScore.
 *
 * faiss-node is a native addon whose binary (build/Release/faiss-node.node)
 * Vercel's file tracer does not bundle, so on Vercel the vector store never
 * loaded ("Could not locate the bindings file") and every query fell through
 * to web search. The index we ship is a FAISS IndexFlatL2 ("IxF2"): a flat
 * array of float32 vectors searched by brute force. 4,740 x 384 dims is ~1.8M
 * multiply-adds per query (a few ms), so reading the same file directly gives
 * identical results with no native dependency.
 *
 * Scores are squared L2 distances, exactly what FaissStore returned, so the
 * existing cosineFromFaissScore conversion and threshold still apply.
 */

export interface StoredDoc {
    pageContent: string;
    metadata: Record<string, unknown>;
}

export interface FlatIndex {
    dim: number;
    count: number;
    vectors: Float32Array;
}

/** Parses a FAISS IndexFlat file (IxF2 = L2, IxFI = inner product). */
export function parseFlatIndex(buf: Buffer): FlatIndex {
    const fourcc = buf.toString("latin1", 0, 4);
    if (fourcc !== "IxF2" && fourcc !== "IxFI") {
        throw new Error(`Unsupported FAISS index type "${fourcc}" (expected IxF2)`);
    }
    const dim = buf.readInt32LE(4);
    const count = Number(buf.readBigInt64LE(8));
    const byteLength = dim * count * 4;
    // The float data is the tail of the file, preceded by its element count.
    const dataOffset = buf.length - byteLength;
    if (dim <= 0 || count <= 0 || dataOffset < 12) {
        throw new Error(`Corrupt FAISS index: dim=${dim} count=${count} size=${buf.length}`);
    }
    const declared = Number(buf.readBigInt64LE(dataOffset - 8));
    if (declared !== dim * count) {
        throw new Error(`Corrupt FAISS index: expected ${dim * count} floats, header says ${declared}`);
    }
    // Copy into an aligned buffer: the data starts at an odd byte offset.
    const bytes = new Uint8Array(byteLength);
    bytes.set(buf.subarray(dataOffset));
    return { dim, count, vectors: new Float32Array(bytes.buffer) };
}

/**
 * Returns the k nearest vectors as [index, squaredL2] pairs, closest first.
 * `include`, when given, restricts the search to the vectors it accepts, so a
 * filtered search returns the true top k of the filtered set (not the top k
 * overall, filtered afterwards).
 */
export function searchFlatL2(
    index: FlatIndex,
    query: ArrayLike<number>,
    k: number,
    include?: (i: number) => boolean
): Array<[number, number]> {
    const { dim, count, vectors } = index;
    if (query.length !== dim) {
        throw new Error(`Query has ${query.length} dims, index has ${dim}`);
    }
    const top: Array<[number, number]> = [];
    for (let i = 0; i < count; i++) {
        if (include && !include(i)) continue;
        let dist = 0;
        const base = i * dim;
        for (let j = 0; j < dim; j++) {
            const diff = query[j] - vectors[base + j];
            dist += diff * diff;
        }
        if (top.length < k || dist < top[top.length - 1][1]) {
            top.push([i, dist]);
            top.sort((a, b) => a[1] - b[1]);
            if (top.length > k) top.pop();
        }
    }
    return top;
}

type Extractor = (text: string, options: { pooling: "mean"; normalize: boolean }) => Promise<{ data: Float32Array }>;

const EMBEDDING_MODEL = "Xenova/all-MiniLM-L6-v2";

export class LocalVectorStore {
    private constructor(
        private index: FlatIndex,
        private docs: StoredDoc[],
        private extractor: Extractor
    ) {}

    /** Loads vector_store/{faiss.index,docstore.json} and the embedding model. */
    static async load(dir: string): Promise<LocalVectorStore> {
        const [indexBuf, docstoreRaw] = await Promise.all([
            fs.readFile(path.join(dir, "faiss.index")),
            fs.readFile(path.join(dir, "docstore.json"), "utf8"),
        ]);
        const index = parseFlatIndex(indexBuf);

        // docstore.json (LangChain FaissStore format): [[[id, doc], ...], {position: id}]
        const [entries, positions] = JSON.parse(docstoreRaw) as [Array<[string, StoredDoc]>, Record<string, string>];
        const byId = new Map(entries);
        const docs: StoredDoc[] = [];
        for (let i = 0; i < index.count; i++) {
            const doc = byId.get(positions[String(i)]);
            if (!doc) throw new Error(`docstore.json has no document for vector ${i}`);
            docs.push(doc);
        }

        return new LocalVectorStore(index, docs, await loadExtractor());
    }

    /**
     * Same shape as FaissStore.similaritySearchWithScore: [doc, squaredL2][].
     * `filter` limits the search to matching documents (e.g. one category).
     */
    async similaritySearchWithScore(
        query: string,
        k: number,
        filter?: (doc: StoredDoc) => boolean
    ): Promise<Array<[StoredDoc, number]>> {
        // Mean pooling + normalization matches how the index was built
        // (LangChain HuggingFaceTransformersEmbeddings defaults).
        const output = await this.extractor(query, { pooling: "mean", normalize: true });
        const include = filter ? (i: number) => filter(this.docs[i]) : undefined;
        return searchFlatL2(this.index, output.data, k, include).map(([i, score]) => [this.docs[i], score]);
    }
}

async function loadExtractor(): Promise<Extractor> {
    const transformers = await import("@huggingface/transformers");
    const { env, pipeline } = transformers;

    // The model ships in the repo under models/ so Vercel never downloads it.
    // If it is missing (e.g. a fresh clone without it), fall back to the
    // Hugging Face hub, caching in the only writable directory on Vercel.
    env.localModelPath = path.join(process.cwd(), "models");
    env.allowLocalModels = true;
    env.allowRemoteModels = true;
    env.cacheDir = path.join(os.tmpdir(), "transformers-cache");

    return (await pipeline("feature-extraction", EMBEDDING_MODEL, {
        dtype: EMBEDDING_DTYPE,
    })) as unknown as Extractor;
}

// q8 (23 MB) rather than fp32 (90 MB, too large to commit). The index was built
// with fp32; q8 embeddings of the same text match the stored vectors at cosine
// ~0.99, and the same top documents are retrieved for real queries.
const EMBEDDING_DTYPE = "q8";
