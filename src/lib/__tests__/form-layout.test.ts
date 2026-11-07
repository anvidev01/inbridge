import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { baseFontSize, dice, findLine, labelScore, locateLabels, placeAnswer, type Line, type Word } from '../forms/layout';

/** A line of words laid out left to right at 10px per character. */
function line(text: string, y: number, page = 0, x0 = 50): Line {
    const words: Word[] = [];
    let x = x0;
    for (const t of text.split(' ')) {
        words.push({ text: t, x, y, w: t.length * 10, h: 20 });
        x += t.length * 10 + 10;
    }
    return { text, x: x0, y, w: x - x0, h: 20, words, page };
}

describe('matching labels to lines', () => {
    const lines = [
        line('APPLICATION FORM FOR WIDOW PENSION', 40),
        line('1. Name of the Applicant : ..........', 100),
        line("2. Father's / Husband's Name : ..........", 140),
        line('3. Date of Birth ..........', 180),
        line('आवेदक का नाम : ..........', 220),
    ];
    test('exact and partial labels', () => {
        assert.equal(findLine('Name of the Applicant', lines), 1);
        assert.equal(findLine("Father's / Husband's Name", lines), 2);
        assert.equal(findLine('Date of Birth', lines), 3);
    });
    test('Hindi label', () => assert.equal(findLine('आवेदक का नाम', lines), 4));
    test('OCR slips still match', () => assert.equal(findLine('Date of Brth', lines), 3));
    test('unrelated label finds nothing', () => assert.equal(findLine('Bank branch address', lines), -1));
    test('a line already given to another label is skipped', () => {
        const two = [line('Name :', 10), line('Name :', 50)];
        assert.equal(findLine('Name', two, { used: new Set([0]) }), 1);
    });
    test('scores', () => {
        assert.ok(dice('Date of Birth', 'date of birth') === 1);
        assert.ok(labelScore('Name', 'Name of the Applicant') >= 0.7);
        assert.ok(labelScore('Name', 'Bank account') < 0.3);
    });
});

describe('locating every label at once', () => {
    // As OCR really returned it: a garbled label, dots turned into junk, two fields on one line.
    const lines = [
        line('APPLICATION FORM FOR WIDOW PENSION', 30),
        line('4. Name of the AppliICANt © ..........८८८८८८८८८८८८', 100),
        line("2. Father's / Husband's Name : ..............८८८.८८८८८८", 140),
        line('6. District : ........... 7. PIN (006 : eevee', 180),
        line('Signature of the Applicant', 700),
    ];
    const labels = ['Name of the Applicant', "Father's / Husband's Name", 'District', 'PIN Code', 'Signature of the Applicant'];
    const hits = locateLabels(labels, lines);

    test('a garbled label is still found, and the signature line is not taken for it', () => {
        assert.equal(hits[0]?.line, 1);
        assert.equal(hits[4]?.line, 4);
    });
    test('two labels on one line both get their own words', () => {
        assert.equal(hits[2]?.line, 3);
        assert.equal(hits[3]?.line, 3);
    });
    test('a label OCR garbled beyond matching is read from its field number', () => {
        assert.equal(hits[3]?.line, 3);
        assert.ok(hits[3]!.start > hits[2]!.end);
    });
    test('a label that is not on the page is null', () => {
        assert.equal(locateLabels(['Bank branch address'], lines)[0], null);
    });
    test('the same words are never given to two labels', () => {
        const [a, b] = locateLabels(['Name', 'Name'], [line('Name :', 10)]);
        assert.ok(a && !b);
    });
});

describe('where the answer goes', () => {
    const at = (l: Line, label: string) => locateLabels([label], [l])[0]!;
    test('a long run of junk after the label still counts as the blank', () => {
        const l = line('4. Name of the AppliICANt © ..........८८८८८८८८८८८८८८८८०८५०८८००५पपपप पा', 100);
        const p = placeAnswer(l, at(l, 'Name of the Applicant'), 800, 20);
        assert.ok(p.y < 125, `y=${p.y}`);
    });
    test('dots read as a few wide letters still count as the blank', () => {
        const l = line('1. नाम', 100);
        l.words.push({ text: 'covers', x: l.x + l.w + 10, y: 100, w: 230, h: 20 });
        const p = placeAnswer(l, { start: 1, end: 1 }, 800, 20);
        assert.ok(p.y < 125, `y=${p.y}`);
    });
    test('after the colon, on the blank, even when OCR turned the dots into junk', () => {
        const l = line("2. Father's Name : ..............८८८.८८८८८८", 140);
        const p = placeAnswer(l, at(l, "Father's Name"), 800, 20);
        const colon = l.words.find((w) => w.text === ':')!;
        assert.ok(p.x > colon.x && p.x < colon.x + 40, `x=${p.x} colon=${colon.x}`);
        assert.ok(p.y > 140 && p.y < 165, 'on the line, not underneath');
    });
    test('right after a label with nothing following', () => {
        const l = line('Mobile Number', 300);
        const p = placeAnswer(l, at(l, 'Mobile Number'), 800, 20);
        assert.ok(p.x > l.x + l.w - 5 && p.x < l.x + l.w + 30, `x=${p.x}`);
    });
    test('the second field on a line stops at the next numbered field', () => {
        const l = line('6. District : ........... 7. PIN Code : ..........', 180);
        const pin = placeAnswer(l, at(l, 'PIN Code'), 800, 20);
        const district = placeAnswer(l, at(l, 'District'), 800, 20);
        assert.ok(pin.x > district.x + 100, `district=${district.x} pin=${pin.x}`);
        assert.equal(district.y, pin.y);
    });
    test('boxed in by another column: written underneath', () => {
        const l = line('Village Pin', 300);
        l.words.push({ text: 'District', x: l.x + l.w + 20, y: 300, w: 80, h: 20 });
        const p = placeAnswer(l, at(l, 'Village'), 800, 20);
        assert.ok(p.y > 320, `y=${p.y}`);
    });
    test('answers are one size across the page, within limits', () => {
        const same = [line('a b c d', 10), line('e f g h', 50), line('i j k l', 90)];
        assert.equal(baseFontSize(same), 20 * 0.88);
        assert.ok(baseFontSize([{ ...line('a b c', 1), h: 200 }]) <= 34);
        assert.ok(baseFontSize([{ ...line('a b c', 1), h: 2 }]) >= 12);
    });
});
