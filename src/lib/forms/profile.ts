/**
 * The details a person can use to fill a form, and how a form field is matched to one.
 *
 * Privacy: this module is pure and runs in the browser. A person's values are never
 * sent anywhere; only the BLANK form's field names may go to the server (see
 * app/api/forms/map). Identity numbers (Aadhaar, PAN, bank account, phone, email)
 * are "sensitive": they are left empty unless the person switches them on.
 */

export const PROFILE_KEYS = [
    'full_name', 'first_name', 'middle_name', 'last_name', 'father_name', 'mother_name', 'spouse_name',
    'dob', 'age', 'gender', 'marital_status', 'category',
    'address', 'village_city', 'district', 'state', 'pincode',
    'occupation', 'annual_income',
    'phone', 'email', 'aadhaar', 'pan', 'bank_account', 'ifsc',
] as const;

export type ProfileKey = (typeof PROFILE_KEYS)[number];
export type Profile = Partial<Record<ProfileKey, string>>;

/** Kept off by default: the person must opt in to each. */
export const SENSITIVE_KEYS: ReadonlySet<ProfileKey> = new Set<ProfileKey>(['phone', 'email', 'aadhaar', 'pan', 'bank_account', 'ifsc']);

export const PROFILE_LABELS: Record<ProfileKey, string> = {
    full_name: 'Full name', first_name: 'First name', middle_name: 'Middle name', last_name: 'Last name',
    father_name: "Father's name", mother_name: "Mother's name", spouse_name: 'Spouse name',
    dob: 'Date of birth', age: 'Age', gender: 'Gender', marital_status: 'Marital status', category: 'Category (General/OBC/SC/ST)',
    address: 'Address', village_city: 'Village / town / city', district: 'District', state: 'State', pincode: 'PIN code',
    occupation: 'Occupation', annual_income: 'Annual income (₹)',
    phone: 'Mobile number', email: 'Email', aadhaar: 'Aadhaar number', pan: 'PAN', bank_account: 'Bank account number', ifsc: 'IFSC code',
};

/** Ordered: the first matching rule wins, so specific rules come before general ones. */
const RULES: Array<[ProfileKey, RegExp]> = [
    ['aadhaar', /aadhaar|aadhar|uidai|\buid\b|आधार/i],
    ['pan', /\bpan\b(?!\s*chayat)|permanent account/i],
    ['ifsc', /ifsc/i],
    ['bank_account', /(bank )?(a\/c|account)\s*(no|number|num)?|खाता/i],
    ['email', /e[\s-]?mail/i],
    ['phone', /mobile|phone|contact (no|number)|cell|मोबाइल/i],
    ['father_name', /father|husband.?s? name|पिता|s\/o|son of/i],
    ['mother_name', /mother|माता/i],
    ['spouse_name', /spouse|wife|husband/i],
    ['first_name', /first\s*name|given\s*name/i],
    ['middle_name', /middle\s*name/i],
    ['last_name', /last\s*name|sur\s*name|family\s*name/i],
    ['dob', /date of birth|d\.?o\.?b|birth\s*date|जन्म/i],
    ['age', /\bage\b|उम्र|आयु/i],
    ['gender', /gender|\bsex\b|लिंग/i],
    ['marital_status', /marital/i],
    ['category', /\bcategory\b|\bcaste\b|\bsc\b.*\bst\b|\bobc\b|जाति|वर्ग/i],
    ['pincode', /pin\s*-?\s*code|postal code|\bpin\b|पिन/i],
    ['district', /district|जिला/i],
    ['state', /\bstate\b|राज्य/i],
    ['village_city', /village|town|city|taluk|tehsil|post office|गांव|गाँव|शहर/i],
    ['address', /address|residence|पता/i],
    ['annual_income', /income|आय/i],
    ['occupation', /occupation|profession|employment|व्यवसाय/i],
    ['full_name', /name|नाम/i],
];

/** Which detail does this field ask for? null when none is recognised. */
export function matchField(fieldName: string): ProfileKey | null {
    const text = fieldName.replace(/[_\-.[\]()]+/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/\s+/g, ' ').trim();
    if (!text) return null;
    for (const [key, pattern] of RULES) if (pattern.test(text)) return key;
    return null;
}

const MONTHS_FIRST = /^(\d{4})-(\d{2})-(\d{2})$/;

/** dd/mm/yyyy is the usual Indian form layout. Accepts yyyy-mm-dd (the date input's format). */
export function formatDate(iso: string, pattern: 'dd/mm/yyyy' | 'dd-mm-yyyy' | 'ddmmyyyy' = 'dd/mm/yyyy'): string {
    const m = MONTHS_FIRST.exec(iso);
    if (!m) return iso;
    const sep = pattern === 'dd-mm-yyyy' ? '-' : pattern === 'ddmmyyyy' ? '' : '/';
    return `${m[3]}${sep}${m[2]}${sep}${m[1]}`;
}

/** If the field is a box-per-character date field (maxLength 8) use ddmmyyyy; 10 fits dd/mm/yyyy. */
export function dateForField(iso: string, maxLength?: number): string {
    return maxLength === 8 ? formatDate(iso, 'ddmmyyyy') : formatDate(iso);
}

/** Pick the option (of a dropdown / radio group) that matches a value, tolerating case and Hindi/English. */
export function pickOption(value: string, options: string[]): string | null {
    const v = value.trim().toLowerCase();
    if (!v) return null;
    const synonyms: Record<string, string[]> = {
        male: ['male', 'm', 'पुरुष', 'man'],
        female: ['female', 'f', 'महिला', 'woman'],
        other: ['other', 'transgender', 'third gender', 'अन्य'],
        general: ['general', 'gen', 'unreserved', 'सामान्य'],
        obc: ['obc', 'other backward'],
        sc: ['sc', 'scheduled caste'],
        st: ['st', 'scheduled tribe'],
        married: ['married', 'विवाहित'],
        unmarried: ['unmarried', 'single', 'never married', 'अविवाहित'],
        widowed: ['widow', 'widowed', 'विधवा'],
    };
    const group = Object.values(synonyms).find((g) => g.includes(v)) ?? [v];
    const exact = options.find((o) => group.includes(o.trim().toLowerCase()));
    if (exact) return exact;
    // "Female" must not be matched by the word "male" inside it.
    return options.find((o) => group.some((g) => g.length > 2 && o.trim().toLowerCase().split(/[^a-zऀ-ॿ]+/).includes(g))) ?? null;
}

/** Every key that has a value, except sensitive ones the person has not switched on. */
export function usableProfile(profile: Profile, allowSensitive: ReadonlySet<ProfileKey>): Profile {
    const out: Profile = {};
    for (const key of PROFILE_KEYS) {
        const value = profile[key]?.trim();
        if (!value) continue;
        if (SENSITIVE_KEYS.has(key) && !allowSensitive.has(key)) continue;
        out[key] = value;
    }
    return out;
}

/** Derives names the person did not type separately (first/last from full). */
export function withDerived(profile: Profile): Profile {
    const out = { ...profile };
    const parts = (out.full_name ?? '').split(/\s+/).filter(Boolean);
    if (parts.length > 0) {
        out.first_name ||= parts[0];
        if (parts.length > 1) out.last_name ||= parts[parts.length - 1];
        if (parts.length > 2) out.middle_name ||= parts.slice(1, -1).join(' ');
    }
    if (!out.age && out.dob && MONTHS_FIRST.test(out.dob)) {
        const born = new Date(out.dob);
        const now = new Date();
        let age = now.getFullYear() - born.getFullYear();
        if (now < new Date(now.getFullYear(), born.getMonth(), born.getDate())) age -= 1;
        if (age >= 0 && age < 130) out.age = String(age);
    }
    return out;
}
