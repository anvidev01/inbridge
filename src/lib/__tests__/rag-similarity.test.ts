import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { cosineFromFaissScore } from '../rag-engine';

/**
 * Scores captured from the real vector store via scripts/probe-vector-store.mjs.
 * Embeddings are unit vectors (L2 norm 1.0), so FAISS returns squared L2.
 */
const OBSERVED = {
    pmKisanQueryVsPmKisanDoc: 0.6550,
    aadhaarQueryVsAadhaarDoc: 0.7009,
    panQueryVsBestDoc: 1.5089,        // no PAN document exists in the corpus
    quantumQueryVsBestDoc: 2.0345,    // wholly unrelated
};

const THRESHOLD = 0.5;

describe('cosineFromFaissScore', () => {
    test('maps the squared-L2 range onto valid cosine values', () => {
        assert.equal(cosineFromFaissScore(0), 1, 'identical vectors');
        assert.equal(cosineFromFaissScore(2), 0, 'orthogonal vectors');
        assert.equal(cosineFromFaissScore(4), -1, 'opposite vectors');
    });

    // The regression: `1 - score` produced values below -1, which cosine cannot
    // take, and put every genuine match under the 0.7 threshold.
    test('every observed score maps into cosine range, unlike 1 - score', () => {
        for (const [name, score] of Object.entries(OBSERVED)) {
            const cos = cosineFromFaissScore(score);
            assert.ok(cos >= -1 && cos <= 1, `${name}: ${cos} is outside [-1, 1]`);
        }

        // Demonstrates why the old formula was wrong, not merely mis-tuned.
        assert.ok(1 - OBSERVED.quantumQueryVsBestDoc < -1, 'old formula left cosine range');
    });

    test('relevant documents clear the threshold', () => {
        assert.ok(cosineFromFaissScore(OBSERVED.pmKisanQueryVsPmKisanDoc) >= THRESHOLD);
        assert.ok(cosineFromFaissScore(OBSERVED.aadhaarQueryVsAadhaarDoc) >= THRESHOLD);
    });

    test('irrelevant documents are still rejected', () => {
        assert.ok(cosineFromFaissScore(OBSERVED.panQueryVsBestDoc) < THRESHOLD);
        assert.ok(cosineFromFaissScore(OBSERVED.quantumQueryVsBestDoc) < THRESHOLD);
    });

    // The threshold is only safe while there is clear air between the two
    // classes. If a corpus change closes this gap, retune rather than guess.
    test('a clear margin separates matches from non-matches', () => {
        const worstMatch = Math.min(
            cosineFromFaissScore(OBSERVED.pmKisanQueryVsPmKisanDoc),
            cosineFromFaissScore(OBSERVED.aadhaarQueryVsAadhaarDoc)
        );
        const bestNonMatch = Math.max(
            cosineFromFaissScore(OBSERVED.panQueryVsBestDoc),
            cosineFromFaissScore(OBSERVED.quantumQueryVsBestDoc)
        );

        assert.ok(
            worstMatch - bestNonMatch > 0.3,
            `margin collapsed: worst match ${worstMatch.toFixed(3)} vs best non-match ${bestNonMatch.toFixed(3)}`
        );
    });
});
