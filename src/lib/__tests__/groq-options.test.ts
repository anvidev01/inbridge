import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { groqReasoningOptions } from '../ai/groq';

describe('groqReasoningOptions', () => {
    test('qwen3 models: thinking off and hidden', () => {
        for (const id of ['qwen/qwen3-32b', 'qwen/qwen3.8-27b', 'Qwen3-14B']) {
            assert.deepEqual(groqReasoningOptions(id), { reasoningFormat: 'hidden', reasoningEffort: 'none' }, id);
        }
    });

    test('qwq and deepseek-r1: hidden only', () => {
        assert.deepEqual(groqReasoningOptions('qwen-qwq-32b'), { reasoningFormat: 'hidden' });
        assert.deepEqual(groqReasoningOptions('deepseek-r1-distill-llama-70b'), { reasoningFormat: 'hidden' });
    });

    test('gpt-oss: low effort, no reasoning_format', () => {
        assert.deepEqual(groqReasoningOptions('openai/gpt-oss-120b'), { reasoningEffort: 'low' });
    });

    test('non-reasoning models get no reasoning options', () => {
        assert.equal(groqReasoningOptions('llama-3.1-8b-instant'), undefined);
        assert.equal(groqReasoningOptions('qwen-2.5-32b'), undefined);
        assert.equal(groqReasoningOptions('meta-llama/llama-4-scout-17b-16e-instruct'), undefined);
    });
});
