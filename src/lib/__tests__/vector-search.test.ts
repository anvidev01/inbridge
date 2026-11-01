import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import path from 'path';
import { parseFlatIndex, searchFlatL2, LocalVectorStore } from '../vector-search';
import { cosineFromFaissScore, matchesFocus } from '../rag-engine';

/** Builds a buffer in FAISS IndexFlatL2 on-disk layout. */
function flatIndexBuffer(vectors: number[][]): Buffer {
    const dim = vectors[0].length;
    const header = Buffer.alloc(45);
    header.write('IxF2', 0, 'latin1');
    header.writeInt32LE(dim, 4);
    header.writeBigInt64LE(BigInt(vectors.length), 8);
    header.writeBigInt64LE(BigInt(1 << 20), 16);
    header.writeBigInt64LE(BigInt(1 << 20), 24);
    header.writeUInt8(1, 32);               // is_trained
    header.writeInt32LE(1, 33);             // METRIC_L2
    header.writeBigInt64LE(BigInt(dim * vectors.length), 37);
    const data = Buffer.from(new Float32Array(vectors.flat()).buffer);
    return Buffer.concat([header, data]);
}

describe('parseFlatIndex', () => {
    test('reads dimensions and vectors from an IxF2 file', () => {
        const index = parseFlatIndex(flatIndexBuffer([[1, 0, 0], [0, 1, 0]]));
        assert.equal(index.dim, 3);
        assert.equal(index.count, 2);
        assert.deepEqual(Array.from(index.vectors), [1, 0, 0, 0, 1, 0]);
    });

    test('rejects other index types and truncated files', () => {
        const buf = flatIndexBuffer([[1, 0]]);
        const wrongType = Buffer.from(buf);
        wrongType.write('IHNf', 0, 'latin1');
        assert.throws(() => parseFlatIndex(wrongType), /Unsupported FAISS index type/);
        assert.throws(() => parseFlatIndex(buf.subarray(0, buf.length - 4)), /Corrupt FAISS index/);
    });
});

describe('searchFlatL2', () => {
    const index = parseFlatIndex(flatIndexBuffer([[1, 0], [0, 1], [-1, 0], [0.8, 0.6]]));

    test('returns the k nearest vectors by squared L2, closest first', () => {
        const top = searchFlatL2(index, [1, 0], 2);
        assert.deepEqual(top.map(([i]) => i), [0, 3]);
        assert.equal(top[0][1], 0);
        assert.ok(Math.abs(top[1][1] - 0.4) < 1e-6);  // (1-0.8)^2 + 0.6^2
    });

    test('returns every vector when k exceeds the count', () => {
        assert.equal(searchFlatL2(index, [0, 1], 10).length, 4);
    });

    test('rejects a query with the wrong dimension', () => {
        assert.throws(() => searchFlatL2(index, [1, 0, 0], 1), /dims/);
    });
});

describe('LocalVectorStore (real vector_store + bundled model)', () => {
    test('retrieves the PM-KISAN scheme above the similarity threshold', async () => {
        const store = await LocalVectorStore.load(path.join(process.cwd(), 'vector_store'));
        const [[doc, score]] = await store.similaritySearchWithScore('PM-KISAN eligibility', 3);
        assert.match(doc.pageContent, /PM-KISAN/);
        assert.ok(cosineFromFaissScore(score) >= 0.35, `cosine ${cosineFromFaissScore(score)}`);
    });
});

describe('filtered search (focus)', () => {
    test('searchFlatL2 returns the top k of the filtered set only', () => {
        const index = parseFlatIndex(flatIndexBuffer([[1, 0], [0, 1], [0.9, 0.1], [0.8, 0.6]]));
        const top = searchFlatL2(index, [1, 0], 2, (i) => i !== 0 && i !== 2);
        assert.deepEqual(top.map(([i]) => i), [3, 1]);
    });

    test('a category filter on the real store keeps only that category', async () => {
        const store = await LocalVectorStore.load(path.join(process.cwd(), 'vector_store'));
        const results = await store.similaritySearchWithScore('scholarship for students', 3, (doc) =>
            matchesFocus(doc.pageContent, 'Health & Wellness')
        );
        assert.equal(results.length, 3);
        for (const [doc] of results) assert.match(doc.pageContent, /^CATEGORY: .*Health & Wellness/m);
    });
});
