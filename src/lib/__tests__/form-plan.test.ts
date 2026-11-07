import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { matchFieldsToItems, planOverlay, valueFor } from '../forms/plan';
import type { ExplainItem } from '../forms/explain';
import type { Line, Word } from '../forms/layout';

function line(text: string, y: number, page = 0, x0 = 50): Line {
    const words: Word[] = [];
    let x = x0;
    for (const t of text.split(' ')) { words.push({ text: t, x, y, w: t.length * 10, h: 20 }); x += t.length * 10 + 10; }
    return { text, x: x0, y, w: x - x0, h: 20, words, page };
}
const item = (label: string, key: ExplainItem['key'], kind: ExplainItem['kind'] = 'text'): ExplainItem => ({ label, meaning: '', key, kind });

const page = {
    width: 800,
    lines: [
        line('WIDOW PENSION APPLICATION', 30),
        line('1. Name of the Applicant : ..........', 100),
        line("2. Father's Name : ..........", 140),
        line('3. Date of Birth : ..........', 180),
        line('4. Gender : Male / Female', 220),
        line('5. Ration card number : ..........', 260),
        line('Signature of applicant', 700),
    ],
};

describe('planOverlay', () => {
    const items = [
        item('Name of the Applicant', 'full_name'),
        item("Father's Name", 'father_name'),
        item('Date of Birth', 'dob'),
        item('Gender', 'gender', 'choice'),
        item('Ration card number', null),
        item('Signature of applicant', null, 'signature'),
    ];
    const chips = planOverlay(items, { full_name: 'Asha Devi', father_name: 'Ram Lal', dob: '1990-04-07', gender: 'Female' }, { 4: 'RC-1234' }, [page]);
    const byLabel = (l: string) => chips.find((c) => c.label === l)!;

    test('each answer lands on its own line, in order', () => {
        assert.deepEqual(chips.map((c) => c.label), ['Name of the Applicant', "Father's Name", 'Date of Birth', 'Gender', 'Ration card number']);
        assert.ok(byLabel('Name of the Applicant').y < byLabel("Father's Name").y);
        assert.ok(chips.every((c) => c.located));
    });
    test('date is written dd/mm/yyyy', () => assert.equal(byLabel('Date of Birth').text, '07/04/1990'));
    test('a printed choice gets a circle around the chosen word, not text', () => {
        const g = byLabel('Gender');
        const female = page.lines[4].words.find((w) => w.text === 'Female')!;
        assert.ok(g.circle, 'circled');
        assert.ok(Math.abs(g.x - female.x) < 1 && Math.abs(g.circle!.w - female.w) < 1, `x=${g.x} female=${female.x}`);
    });
    test('every answer is the same size', () => {
        assert.equal(new Set(chips.filter((c) => !c.circle).map((c) => c.size)).size, 1);
    });
    test('custom answers and no signature chip', () => {
        assert.equal(byLabel('Ration card number').text, 'RC-1234');
        assert.ok(!chips.some((c) => c.label.startsWith('Signature')));
    });
    test('a label that cannot be found becomes a chip to drag', () => {
        const out = planOverlay([item('Bank branch', null)], {}, { 0: 'Main road' }, [page]);
        assert.equal(out[0].located, false);
        assert.equal(out[0].text, 'Main road');
    });
    test('an unfound label is placed under the previous answer, not on top of the title', () => {
        const out = planOverlay([item('Name of the Applicant', 'full_name'), item('Bank branch', null)], { full_name: 'Asha' }, { 1: 'Main road' }, [page]);
        assert.equal(out[1].located, false);
        assert.ok(out[1].y > out[0].y && out[1].x === out[0].x);
    });
    test('items with no value produce nothing', () => {
        assert.deepEqual(planOverlay(items, {}, {}, [page]), []);
    });
});

describe('valueFor and field matching', () => {
    test('attachments and signatures never get a value', () => {
        assert.equal(valueFor(item('Photo', 'full_name', 'attachment'), 0, { full_name: 'A' }, {}), '');
    });
    test('PDF fields the rules cannot place are matched to explained items', () => {
        const items = [item('Name of the Applicant', 'full_name'), item('Ration card number', null)];
        const m = matchFieldsToItems(['txtApplicantName', 'rationCardNo', 'zzz'], items);
        assert.equal(m.has('txtApplicantName'), false, 'the rules already know this one');
        assert.equal(m.get('rationCardNo'), 1);
        assert.equal(m.has('zzz'), false);
    });
    test('a field cannot steal another field\'s item because both say "number"', () => {
        const items = [item('Ward Number', null), item('Plot Number', null)];
        const m = matchFieldsToItems(['Ward Number', 'Plot Number'], items);
        assert.equal(m.get('Ward Number'), 0);
        assert.equal(m.get('Plot Number'), 1);
    });
});
