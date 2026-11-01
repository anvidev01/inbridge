import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import {
    ANSWER_STATE_PREFIXES,
    HISTORY_KEY,
    HISTORY_NOTE,
    MAX_THREADS,
    answerStateKeys,
    buildThread,
    deleteThread,
    deriveTitle,
    groupThreads,
    parseThreads,
    readThreads,
    removeAnswerState,
    renameThread,
    upsertThread,
    writeThreads,
    type KeyedStorageLike,
    type StorageLike,
    type Thread,
} from '../history';
import type { InBridgeUIMessage } from '../chat/protocol';

function msg(role: 'user' | 'assistant', text: string, id = `${role}-${text}`): InBridgeUIMessage {
    return { id, role, parts: [{ type: 'text', text }] };
}

function thread(id: string, updatedAt: number, title = id): Thread {
    return { id, title, createdAt: updatedAt, updatedAt, messages: [msg('user', title)] };
}

class MemoryStorage implements StorageLike {
    data = new Map<string, string>();
    constructor(private quota = Infinity) { }
    getItem(key: string) { return this.data.get(key) ?? null; }
    setItem(key: string, value: string) {
        if (value.length > this.quota) throw new Error('QuotaExceededError');
        this.data.set(key, value);
    }
    removeItem(key: string) { this.data.delete(key); }
}

describe('deriveTitle', () => {
    test('uses the first user message, collapsing whitespace', () => {
        assert.equal(deriveTitle([msg('assistant', 'hi'), msg('user', '  PM-KISAN\n status  ')]), 'PM-KISAN status');
    });

    test('truncates long questions to 60 characters with an ellipsis', () => {
        const title = deriveTitle([msg('user', 'a'.repeat(100))]);
        assert.equal(title.length, 60);
        assert.ok(title.endsWith('…'));
    });

    test('falls back when there is no user text', () => {
        assert.equal(deriveTitle([]), 'New thread');
    });
});

describe('parseThreads', () => {
    test('returns [] for missing, corrupt or non-array data', () => {
        assert.deepEqual(parseThreads(null), []);
        assert.deepEqual(parseThreads('{not json'), []);
        assert.deepEqual(parseThreads('{"a":1}'), []);
    });

    test('drops malformed threads and messages, de-duplicates and sorts newest first', () => {
        const raw = JSON.stringify([
            thread('old', 1),
            { id: 'bad', title: 'x' },
            { ...thread('new', 5), messages: [msg('user', 'ok'), { nope: true }] },
            thread('old', 3),
        ]);
        const parsed = parseThreads(raw);
        assert.deepEqual(parsed.map((t) => t.id), ['new', 'old']);
        assert.equal(parsed[0].messages.length, 1);
        assert.equal(parsed[1].updatedAt, 1); // first occurrence wins
    });
});

describe('upsert / rename / delete', () => {
    test('upsert replaces by id and moves the thread to the top', () => {
        const list = [thread('a', 2), thread('b', 1)];
        const next = upsertThread(list, { ...thread('b', 3), title: 'b2' });
        assert.deepEqual(next.map((t) => `${t.id}:${t.title}`), ['b:b2', 'a:a']);
    });

    test(`caps the list at ${MAX_THREADS}, dropping the oldest`, () => {
        let list: Thread[] = [];
        for (let i = 0; i < MAX_THREADS + 5; i++) list = upsertThread(list, thread(`t${i}`, i));
        assert.equal(list.length, MAX_THREADS);
        assert.equal(list[0].id, `t${MAX_THREADS + 4}`);
        assert.ok(!list.some((t) => t.id === 't0'));
    });

    test('rename trims, ignores blanks and keeps order', () => {
        const list = [thread('a', 2), thread('b', 1)];
        assert.equal(renameThread(list, 'b', '  My  thread ')[1].title, 'My thread');
        assert.equal(renameThread(list, 'b', '   ')[1].title, 'b');
    });

    test('delete removes only the given id', () => {
        assert.deepEqual(deleteThread([thread('a', 2), thread('b', 1)], 'a').map((t) => t.id), ['b']);
    });

    test('buildThread keeps createdAt and a user-set title', () => {
        const existing = { ...thread('a', 10), title: 'Renamed' };
        const built = buildThread(existing, 'a', [msg('user', 'q'), msg('assistant', 'ans')], 20);
        assert.equal(built.title, 'Renamed');
        assert.equal(built.createdAt, 10);
        assert.equal(built.updatedAt, 20);
        assert.equal(buildThread(undefined, 'n', [msg('user', 'Ayushman card')], 5).title, 'Ayushman card');
    });
});

describe('groupThreads', () => {
    const now = new Date(2026, 10, 15, 12, 0, 0).getTime();
    const at = (day: number, hour = 9) => new Date(2026, 10, day, hour).getTime();

    test('buckets by local day and omits empty groups', () => {
        const groups = groupThreads([
            thread('today', at(15, 1)),
            thread('yesterday', at(14, 23)),
            thread('week', at(9)),
            thread('older', at(7)),
        ], now);
        assert.deepEqual(groups.map((g) => [g.key, g.threads.map((t) => t.id)]), [
            ['today', ['today']],
            ['yesterday', ['yesterday']],
            ['week', ['week']],
            ['older', ['older']],
        ]);
        assert.deepEqual(groupThreads([thread('x', at(1))], now).map((g) => g.key), ['older']);
    });
});

describe('storage I/O', () => {
    test('round-trips through storage', () => {
        const storage = new MemoryStorage();
        writeThreads(storage, [thread('a', 1)]);
        assert.deepEqual(readThreads(storage).map((t) => t.id), ['a']);
    });

    test('removes the key when the list is empty', () => {
        const storage = new MemoryStorage();
        writeThreads(storage, [thread('a', 1)]);
        writeThreads(storage, []);
        assert.equal(storage.getItem(HISTORY_KEY), null);
    });

    test('on quota errors drops the oldest threads until it fits', () => {
        const one = JSON.stringify([thread('n', 3)]).length;
        const storage = new MemoryStorage(one * 2);
        const stored = writeThreads(storage, [thread('o', 1), thread('m', 2), thread('n', 3)]);
        assert.ok(stored && stored.length >= 1 && stored.length < 3);
        assert.equal(stored![0].id, 'n');
        assert.equal(readThreads(storage)[0].id, 'n');
    });

    test('returns null when even one thread cannot be written', () => {
        assert.equal(writeThreads(new MemoryStorage(1), [thread('a', 1)]), null);
    });

    test('reads are safe when storage throws or is absent', () => {
        const throwing: StorageLike = {
            getItem() { throw new Error('SecurityError'); },
            setItem() { throw new Error('SecurityError'); },
            removeItem() { },
        };
        assert.deepEqual(readThreads(throwing), []);
        assert.deepEqual(readThreads(null), []);
        assert.equal(writeThreads(null, [thread('a', 1)]), null);
    });
});

class KeyedMemoryStorage extends MemoryStorage implements KeyedStorageLike {
    get length() { return this.data.size; }
    key(i: number) { return [...this.data.keys()][i] ?? null; }
}

describe('answer state (feedback / checklist) clean-up', () => {
    const keys = [
        HISTORY_KEY,
        'inbridge_language',
        'inbridge_onboarding_v1',
        'inbridge_feedback:m1',
        'inbridge_checklist:m1',
        'inbridge_feedback:m2',
        'inbridge_checklist:m3',
        'other_feedback:m1',
    ];

    test('covers the keys the answer renderer writes', () => {
        assert.deepEqual([...ANSWER_STATE_PREFIXES], ['inbridge_feedback:', 'inbridge_checklist:']);
    });

    test('answerStateKeys without ids selects every feedback and checklist key, nothing else', () => {
        assert.deepEqual(answerStateKeys(keys), [
            'inbridge_feedback:m1', 'inbridge_checklist:m1', 'inbridge_feedback:m2', 'inbridge_checklist:m3',
        ]);
    });

    test('answerStateKeys with ids selects only those messages', () => {
        assert.deepEqual(answerStateKeys(keys, ['m1']), ['inbridge_feedback:m1', 'inbridge_checklist:m1']);
        assert.deepEqual(answerStateKeys(keys, []), []);
    });

    test('removeAnswerState clears answer state but keeps history, language and onboarding', () => {
        const storage = new KeyedMemoryStorage();
        for (const k of keys) storage.setItem(k, '1');
        assert.equal(removeAnswerState(storage), 4);
        assert.deepEqual([...storage.data.keys()].sort(), [HISTORY_KEY, 'inbridge_language', 'inbridge_onboarding_v1', 'other_feedback:m1'].sort());
    });

    test('removeAnswerState for one thread leaves other messages alone', () => {
        const storage = new KeyedMemoryStorage();
        for (const k of keys) storage.setItem(k, '1');
        assert.equal(removeAnswerState(storage, ['m1', 'm3']), 3);
        assert.ok(storage.data.has('inbridge_feedback:m2'));
        assert.ok(!storage.data.has('inbridge_checklist:m3'));
    });

    test('removeAnswerState never throws', () => {
        const throwing: KeyedStorageLike = {
            length: 1,
            key() { throw new Error('SecurityError'); },
            getItem() { return null; },
            setItem() { },
            removeItem() { },
        };
        assert.equal(removeAnswerState(throwing), 0);
        assert.equal(removeAnswerState(null), 0);
    });
});

describe('HISTORY_NOTE', () => {
    test('has a non-empty note for every language', () => {
        for (const lang of ['en', 'hi', 'hinglish'] as const) assert.ok(HISTORY_NOTE[lang].trim().length > 0);
        assert.equal(HISTORY_NOTE.en, 'Saved only on this device.');
    });
});
