import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { outcomeOfFinish, statusAnnouncement, threadToSaveOnLeave } from '../../components/chat/ChatShell';
import { FOCUS_LABELS, dictationText, joinText } from '../../components/chat/ChatInput';
import { SIDEBAR_COPY } from '../../components/chat/Sidebar';
import { THREAD_LIST_COPY } from '../../components/chat/ThreadList';
import { FOCUS_CATEGORIES, LANGUAGES } from '../chat/protocol';

const LANGS = LANGUAGES.map((l) => l.code);
const STATUS = { busy: 'busy', ready: 'ready', stopped: 'stopped' };

describe('status line', () => {
    test('a normal finish is announced as ready', () => {
        assert.equal(outcomeOfFinish({ isAbort: false, isError: false, isDisconnect: false }), 'ready');
    });

    test('Stop is announced as stopped, not ready', () => {
        assert.equal(outcomeOfFinish({ isAbort: true, isError: false, isDisconnect: false }), 'stopped');
    });

    test('errors are left to ErrorCard (no duplicate announcement)', () => {
        assert.equal(outcomeOfFinish({ isAbort: false, isError: true, isDisconnect: false }), 'none');
        assert.equal(outcomeOfFinish({ isAbort: false, isError: false, isDisconnect: true }), 'none');
    });

    test('busy wins; no outcome (e.g. a saved thread was opened) says nothing', () => {
        assert.equal(statusAnnouncement(STATUS, true, 'ready'), 'busy');
        assert.equal(statusAnnouncement(STATUS, false, 'ready'), 'ready');
        assert.equal(statusAnnouncement(STATUS, false, 'stopped'), 'stopped');
        assert.equal(statusAnnouncement(STATUS, false, 'none'), '');
    });
});

describe('threadToSaveOnLeave', () => {
    test('saves the in-flight thread when leaving normally', () => {
        assert.equal(threadToSaveOnLeave('t1', true, 2, true), 't1');
    });

    test('never saves on delete / clear all (save: false), even mid-stream', () => {
        assert.equal(threadToSaveOnLeave('t1', true, 2, false), null);
    });

    test('nothing to save when idle, detached or empty', () => {
        assert.equal(threadToSaveOnLeave('t1', false, 2, true), null);
        assert.equal(threadToSaveOnLeave(null, true, 2, true), null);
        assert.equal(threadToSaveOnLeave('t1', true, 0, true), null);
    });
});

describe('dictation text', () => {
    const results = (...parts: string[]) => {
        const list: { length: number;[i: number]: { 0: { transcript: string } } } = { length: parts.length };
        parts.forEach((p, i) => { list[i] = { 0: { transcript: p } }; });
        return list;
    };

    test('joinText adds a single space only when needed', () => {
        assert.equal(joinText('', 'hello'), 'hello');
        assert.equal(joinText('PM-KISAN', ''), 'PM-KISAN');
        assert.equal(joinText('PM-KISAN', 'status'), 'PM-KISAN status');
        assert.equal(joinText('PM-KISAN ', 'status'), 'PM-KISAN status');
    });

    test('appends all result segments to the base text', () => {
        assert.equal(dictationText('Typed', results('how do I ', 'apply ')), 'Typed how do I apply');
    });

    test('each interim result replaces the previous one rather than piling up', () => {
        const base = 'Q:';
        assert.equal(dictationText(base, results('how')), 'Q: how');
        assert.equal(dictationText(base, results('how do')), 'Q: how do');
    });
});

describe('localised shell copy', () => {
    test('every topic has a label in every language', () => {
        for (const lang of LANGS) {
            for (const c of FOCUS_CATEGORIES) assert.ok(FOCUS_LABELS[lang][c]?.trim(), `${lang}: ${c}`);
        }
    });

    test('sidebar starters exist in every language and put a question in that language', () => {
        const keys = Object.keys(SIDEBAR_COPY.en.starters).sort();
        for (const lang of LANGS) {
            assert.deepEqual(Object.keys(SIDEBAR_COPY[lang].starters).sort(), keys);
            for (const k of keys) {
                const s = SIDEBAR_COPY[lang].starters[k as keyof typeof SIDEBAR_COPY.en.starters];
                assert.ok(s.label.trim() && s.query.trim());
            }
        }
        // Hindi starters are written in Devanagari, not English.
        for (const s of Object.values(SIDEBAR_COPY.hi.starters)) assert.match(s.query, /[ऀ-ॿ]/);
    });

    test('history copy, including the save-failed note, is translated', () => {
        assert.equal(THREAD_LIST_COPY.en.saveFailed, 'Couldn’t save this conversation on this device.');
        for (const lang of LANGS) {
            const c = THREAD_LIST_COPY[lang];
            assert.ok(c.heading && c.saveFailed && c.groups.today && c.groups.older);
            assert.ok(c.rename('X').includes('X') && c.remove('X').includes('X'));
        }
        assert.match(THREAD_LIST_COPY.hi.saveFailed, /[ऀ-ॿ]/);
    });

    test('no copy calls InBridge official or government', () => {
        const all = JSON.stringify([SIDEBAR_COPY, THREAD_LIST_COPY, FOCUS_LABELS]);
        assert.doesNotMatch(all, /InBridge (is|हैं?) (an? )?(official|government)/i);
    });
});
