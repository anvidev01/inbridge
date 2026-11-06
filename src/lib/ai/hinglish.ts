/**
 * Search-query cleanup for Hinglish: Hindi typed in English letters.
 *
 * Retrieval runs on an English-only embedding model. A question such as
 * "PM Kisan Yojna ke liye kaise apply karein" embeds mostly as filler plus the
 * word "Yojna", which overlaps hundreds of scheme titles, so the dataset search
 * returned unrelated schemes (and "PM Kisan scheme apply" found PM-KISAN at
 * once). This turns such questions into a short English query: filler words are
 * dropped, common Hindi words are translated, and "Yojna"/"Yojana" becomes
 * "scheme".
 *
 * It is deliberately rule-based: it runs for every Hinglish question, costs no
 * network call, and cannot time out or fail like an LLM translation. Only the
 * search uses its output; the answer is still written in the user's language.
 */

/** Words that mark a sentence as Hindi written in Latin letters. */
const MARKERS = new Set([
    'kaise', 'kaisey', 'karein', 'kare', 'karna', 'karni', 'karun', 'karu', 'kya', 'kyu', 'kyun', 'kaun', 'kab', 'kahan', 'kaha', 'kitna', 'kitni',
    'hai', 'hain', 'hota', 'hoti', 'mujhe', 'mera', 'meri', 'mere', 'hum', 'humein', 'aap', 'chahiye', 'chahie', 'milega', 'milegi', 'milta', 'milti',
    'batao', 'bataiye', 'bataye', 'bataen', 'liye', 'sakta', 'sakte', 'sakti', 'jaankari', 'jankari', 'nahi', 'nahin', 'wala', 'wali', 'vala', 'vali',
    'banwana', 'banwaye', 'banwaen', 'banaye', 'banane', 'lena', 'lene', 'milna', 'dena', 'dene', 'chahta', 'chahti', 'bharna', 'bharne', 'karwana',
]);

/** Dropped: grammar and filler with no search value. */
const STOPWORDS = new Set([
    'ke', 'ka', 'ki', 'ko', 'se', 'mein', 'me', 'par', 'pe', 'aur', 'ya', 'bhi', 'to', 'toh', 'hi', 'ye', 'yeh', 'wo', 'woh', 'is', 'us', 'ek', 'koi',
    'liye', 'lie', 'hai', 'hain', 'ho', 'hoga', 'hogi', 'tha', 'thi', 'the', 'kya', 'kaun', 'kab', 'kahan', 'kaha', 'kyu', 'kyun', 'kitna', 'kitni',
    'mujhe', 'mera', 'meri', 'mere', 'main', 'mai', 'hum', 'humein', 'hamara', 'aap', 'aapko', 'apna', 'apni',
    'karein', 'kare', 'karna', 'karni', 'karun', 'karu', 'kar', 'karo', 'karke', 'karwana', 'sakta', 'sakte', 'sakti', 'chahiye', 'chahie', 'chahta', 'chahti',
    'batao', 'bataiye', 'bataye', 'bataen', 'jaankari', 'jankari', 'please', 'plz', 'pls', 'sir', 'madam', 'nahi', 'nahin', 'wala', 'wali', 'vala', 'vali',
    'milega', 'milegi', 'milta', 'milti', 'milna', 'lena', 'lene', 'dena', 'dene', 'hota', 'hoti', 'banwana', 'banwaye', 'banwaen', 'banaye',
]);

/** Hindi words worth keeping, in English. */
const GLOSSARY: Record<string, string> = {
    kaise: 'how', kaisey: 'how',
    yojna: 'scheme', yojana: 'scheme', yojnaye: 'schemes', yojanayein: 'schemes', yojnayein: 'schemes',
    paisa: 'money', paise: 'money', rupaye: 'money', rupay: 'money',
    ghar: 'house', makaan: 'house', makan: 'house', banane: 'build',
    shiksha: 'education', padhai: 'education', vidyarthi: 'student', chhatra: 'student', chhatravritti: 'scholarship', chatravritti: 'scholarship',
    naukri: 'job', rozgar: 'employment', rojgar: 'employment', kaam: 'work',
    kheti: 'farming', kisaan: 'kisan', fasal: 'crop', zameen: 'land', jamin: 'land',
    beemari: 'illness', bimari: 'illness', ilaj: 'treatment', swasthya: 'health', aspatal: 'hospital',
    vidhwa: 'widow', vriddha: 'old age', buzurg: 'elderly', budhapa: 'old age', viklang: 'disabled', divyang: 'disabled',
    beti: 'girl child', ladki: 'girl', mahila: 'women', mahilayen: 'women', garbhwati: 'pregnant', shaadi: 'marriage', vivah: 'marriage',
    aavedan: 'application', avedan: 'application', labh: 'benefit', patrata: 'eligibility', dastavez: 'documents', dastawez: 'documents', kagaz: 'documents', kagzat: 'documents',
    tareekh: 'date', tarikh: 'date', antim: 'last', sarkari: 'government', sarkar: 'government', byaj: 'interest', rin: 'loan', karz: 'loan',
    gas: 'gas', bijli: 'electricity', pani: 'water', shauchalay: 'toilet',
};

const TOKEN = /[\p{L}\p{N}][\p{L}\p{N}'’.-]*/gu;

function hasLatinLettersOnly(text: string): boolean {
    return !/[ऀ-ॿ]/.test(text) && /[A-Za-z]/.test(text);
}

/** True for Hindi typed in Latin letters: needs at least one clear Hindi function word. */
export function looksHinglish(text: string): boolean {
    if (!hasLatinLettersOnly(text)) return false;
    const words = text.toLowerCase().match(TOKEN) ?? [];
    return words.some((w) => MARKERS.has(w));
}

/**
 * English search query for a Hinglish question, or the text unchanged when it is
 * not Hinglish or cleaning would leave too little to search with.
 */
export function normalizeHinglishQuery(text: string): string {
    if (!looksHinglish(text)) return text;

    const kept: string[] = [];
    for (const raw of text.match(TOKEN) ?? []) {
        const word = raw.toLowerCase();
        const mapped = GLOSSARY[word];
        if (mapped) {
            kept.push(mapped);
        } else if (!STOPWORDS.has(word)) {
            kept.push(raw);
        }
    }
    // "how" says nothing a search can use, so it is not sent on.
    const meaningful = kept.filter((w) => w.toLowerCase() !== 'how');
    return meaningful.length >= 2 ? meaningful.join(' ') : text;
}
