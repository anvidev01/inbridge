import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { PDFDocument } from 'pdf-lib';
import { autoAssign, fillForm, readForm } from '../forms/pdf';
import { usableProfile, withDerived } from '../forms/profile';
import { cleanLabels, parseMapping } from '../../app/api/forms/map/route';

/** A small fillable form like the ones on government sites. */
async function sampleForm(): Promise<ArrayBuffer> {
    const doc = await PDFDocument.create();
    const page = doc.addPage([400, 600]);
    const form = doc.getForm();
    let y = 560;
    const text = (name: string, max?: number) => {
        const f = form.createTextField(name);
        if (max) f.setMaxLength(max);
        f.addToPage(page, { x: 20, y, width: 200, height: 20 });
        y -= 30;
    };
    text('Applicant Name');
    text('Father Name');
    text('Date of Birth', 10);
    text('Aadhaar Number');
    text('Mobile No');
    text('Office use only');
    const gender = form.createRadioGroup('Gender');
    gender.addOptionToPage('Male', page, { x: 20, y, width: 12, height: 12 });
    gender.addOptionToPage('Female', page, { x: 60, y, width: 12, height: 12 });
    y -= 30;
    form.createCheckBox('I declare the above is true').addToPage(page, { x: 20, y, width: 12, height: 12 });
    const bytes = await doc.save();
    return bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer;
}

async function valuesOf(bytes: Uint8Array) {
    const form = (await PDFDocument.load(bytes)).getForm();
    return {
        text: (n: string) => form.getTextField(n).getText(),
        gender: form.getRadioGroup('Gender').getSelected(),
        declared: form.getCheckBox('I declare the above is true').isChecked(),
    };
}

describe('filling a real fillable PDF', () => {
    test('fields are found and matched by rule', async () => {
        const { fields } = await readForm(await sampleForm());
        assert.equal(fields.length, 8);
        const { assignment, unmatched } = autoAssign(fields);
        assert.equal(assignment['Applicant Name'], 'full_name');
        assert.equal(assignment['Date of Birth'], 'dob');
        assert.deepEqual(unmatched, ['Office use only']);
    });

    test('fills names, date and gender; leaves identity numbers and the declaration empty by default', async () => {
        const src = await sampleForm();
        const { fields } = await readForm(src);
        const { assignment } = autoAssign(fields);
        const profile = withDerived(usableProfile({
            full_name: 'Asha Devi', father_name: 'Ram Lal', dob: '1990-04-07', gender: 'Female',
            aadhaar: '123412341234', phone: '9876543210',
        }, new Set()));
        const out = await fillForm(src, assignment, profile);
        const v = await valuesOf(out.bytes);
        assert.equal(v.text('Applicant Name'), 'Asha Devi');
        assert.equal(v.text('Father Name'), 'Ram Lal');
        assert.equal(v.text('Date of Birth'), '07/04/1990');
        assert.equal(v.gender, 'Female');
        assert.equal(v.text('Aadhaar Number'), undefined, 'Aadhaar must stay empty unless switched on');
        assert.equal(v.text('Mobile No'), undefined);
        assert.equal(v.declared, false, 'declarations are never ticked');
        assert.equal(v.text('Office use only'), undefined);
    });

    test('sensitive fields are filled only when switched on', async () => {
        const src = await sampleForm();
        const { fields } = await readForm(src);
        const { assignment } = autoAssign(fields);
        const profile = usableProfile({ full_name: 'Asha Devi', phone: '9876543210', aadhaar: '123412341234' }, new Set(['phone'] as const));
        const v = await valuesOf((await fillForm(src, assignment, profile)).bytes);
        assert.equal(v.text('Mobile No'), '9876543210');
        assert.equal(v.text('Aadhaar Number'), undefined);
    });

    test("the person's edits win over the matched value", async () => {
        const src = await sampleForm();
        const { fields } = await readForm(src);
        const { assignment } = autoAssign(fields);
        const out = await fillForm(src, assignment, { full_name: 'Asha Devi' }, { 'Applicant Name': 'Asha K Devi' });
        assert.equal((await valuesOf(out.bytes)).text('Applicant Name'), 'Asha K Devi');
    });

    test('a PDF without form fields reports zero fields', async () => {
        const doc = await PDFDocument.create();
        doc.addPage();
        const bytes = await doc.save();
        const { fields } = await readForm(bytes.buffer.slice(bytes.byteOffset, bytes.byteOffset + bytes.byteLength) as ArrayBuffer);
        assert.equal(fields.length, 0);
    });

    test('garbage is rejected', async () => {
        await assert.rejects(readForm(new TextEncoder().encode('not a pdf').buffer as ArrayBuffer));
    });
});

describe('the label-mapping route accepts labels only', () => {
    test('rejects non-strings, empty, oversized and too many labels', () => {
        assert.equal(cleanLabels(undefined), null);
        assert.equal(cleanLabels([]), null);
        assert.equal(cleanLabels([1]), null);
        assert.equal(cleanLabels(['x'.repeat(121)]), null);
        assert.equal(cleanLabels(Array.from({ length: 61 }, (_, i) => `f${i}`)), null);
        assert.deepEqual(cleanLabels([' Name ', 'Name', 'Age']), ['Name', 'Age']);
    });

    test('only known keys survive from the model reply', () => {
        const raw = '<think>hm</think>```json\n{"Office use": null, "Ward": "district", "Hack": "password", "Name": "full_name"}\n```';
        assert.deepEqual(parseMapping(raw, ['Office use', 'Ward', 'Hack']), { 'Office use': null, Ward: 'district', Hack: null });
        assert.deepEqual(parseMapping('nonsense', ['A']), { A: null });
    });
});
