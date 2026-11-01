/**
 * UI copy for the answer block, in the three languages InBridge ships
 * (en / hi / hinglish). Keep every key present in all three.
 */
import type { Language, Phase } from '@/lib/chat/protocol';

export interface AnswerStrings {
    answer: string;
    sources: string;
    viewAll: (n: number) => string;
    allSources: (n: number) => string;
    official: string;
    officialHint: string;
    openSource: string;
    newTab: string;
    close: string;
    sourceN: (n: number, host: string) => string;
    phase: (phase: Phase, count?: number) => string;
    provenanceDataset: (label?: string) => string;
    provenanceLive: (when: string) => string;
    provenanceCache: (when: string) => string;
    provenanceNone: string;
    copy: string;
    copied: string;
    copyFailed: string;
    share: string;
    shareWhatsApp: string;
    shareFooter: string;
    listen: string;
    stopListening: string;
    regenerate: string;
    helpful: string;
    notHelpful: string;
    feedbackThanks: string;
    feedbackFailed: string;
    feedbackWhat: string;
    feedbackNote: string;
    feedbackSend: string;
    feedbackSkip: string;
    reasons: Record<FeedbackReason, string>;
    followUps: string;
    checklistTitle: string;
    checklistProgress: (done: number, total: number) => string;
    checklistDeviceNote: string;
    copyChecklist: string;
    draftTitle: string;
    copyDraft: string;
    openCpgrams: string;
    draftNotice: string;
    unverifiedLink: string;
    /** Marks an answer that ended early (Stop pressed or the stream broke). */
    stopped: string;
}

export const FEEDBACK_REASONS = ['wrong_info', 'outdated', 'wrong_scheme', 'broken_link', 'wrong_language'] as const;
export type FeedbackReason = (typeof FEEDBACK_REASONS)[number];

const en: AnswerStrings = {
    answer: 'Answer',
    sources: 'Sources',
    viewAll: (n) => `View all ${n}`,
    allSources: (n) => `${n} ${n === 1 ? 'source' : 'sources'}`,
    official: 'Official',
    officialHint: 'Government domain (.gov.in / .nic.in)',
    openSource: 'Open source page',
    newTab: '(opens in a new tab)',
    close: 'Close',
    sourceN: (n, host) => `Source ${n}: ${host}`,
    phase: (p, count) => {
        switch (p) {
            case 'searching-dataset': return 'Searching scheme dataset';
            case 'searching-gov': return 'Searching official government sites';
            case 'reading': return count === undefined ? 'Reading sources' : `Reading ${count} ${count === 1 ? 'source' : 'sources'}`;
            case 'writing': return 'Writing answer';
        }
    },
    provenanceDataset: (label) => (label ? `From the myScheme dataset — ${label}` : 'From the myScheme dataset'),
    provenanceLive: (when) => (when ? `From live search of official government sites · retrieved ${when}` : 'From live search of official government sites'),
    provenanceCache: (when) => (when ? `From a recent saved search · retrieved ${when}` : 'From a recent saved search'),
    provenanceNone: 'No source found — general guidance only. Verify on the official portal.',
    copy: 'Copy',
    copied: 'Copied',
    copyFailed: 'Copy failed',
    share: 'Share',
    shareWhatsApp: 'Share on WhatsApp',
    shareFooter: 'Shared from InBridge, an independent AI assistant (not a government website)',
    listen: 'Listen',
    stopListening: 'Stop',
    regenerate: 'Regenerate',
    helpful: 'Helpful',
    notHelpful: 'Not helpful',
    feedbackThanks: 'Thanks for the feedback.',
    feedbackFailed: 'Couldn’t send feedback. Please try again.',
    feedbackWhat: 'What went wrong? (optional)',
    feedbackNote: 'Add a note (optional). Don’t include personal details.',
    feedbackSend: 'Send',
    feedbackSkip: 'Skip',
    reasons: {
        wrong_info: 'Wrong info',
        outdated: 'Outdated',
        wrong_scheme: 'Wrong scheme',
        broken_link: 'Broken link',
        wrong_language: 'Wrong language',
    },
    followUps: 'Related questions',
    checklistTitle: 'Documents checklist',
    checklistProgress: (d, t) => `${d} of ${t} ready`,
    checklistDeviceNote: 'Ticks are saved only on this device.',
    copyChecklist: 'Copy list',
    draftTitle: 'Complaint draft',
    copyDraft: 'Copy draft',
    openCpgrams: 'Open CPGRAMS (pgportal.gov.in)',
    draftNotice: 'InBridge does not file complaints for you.',
    unverifiedLink: 'Link not from a government domain or a cited source',
    stopped: '(answer incomplete)',
};

const hi: AnswerStrings = {
    answer: 'उत्तर',
    sources: 'स्रोत',
    viewAll: (n) => `सभी ${n} देखें`,
    allSources: (n) => `${n} स्रोत`,
    official: 'आधिकारिक',
    officialHint: 'सरकारी डोमेन (.gov.in / .nic.in)',
    openSource: 'स्रोत पेज खोलें',
    newTab: '(नए टैब में खुलेगा)',
    close: 'बंद करें',
    sourceN: (n, host) => `स्रोत ${n}: ${host}`,
    phase: (p, count) => {
        switch (p) {
            case 'searching-dataset': return 'योजना डेटासेट में खोज रहे हैं';
            case 'searching-gov': return 'आधिकारिक सरकारी साइटों पर खोज रहे हैं';
            case 'reading': return count === undefined ? 'स्रोत पढ़ रहे हैं' : `${count} स्रोत पढ़ रहे हैं`;
            case 'writing': return 'उत्तर लिख रहे हैं';
        }
    },
    provenanceDataset: (label) => (label ? `myScheme डेटासेट से — ${label}` : 'myScheme डेटासेट से'),
    provenanceLive: (when) => (when ? `आधिकारिक सरकारी साइटों की लाइव खोज से · ${when} को प्राप्त` : 'आधिकारिक सरकारी साइटों की लाइव खोज से'),
    provenanceCache: (when) => (when ? `हाल की सहेजी गई खोज से · ${when} को प्राप्त` : 'हाल की सहेजी गई खोज से'),
    provenanceNone: 'कोई स्रोत नहीं मिला — केवल सामान्य जानकारी। आधिकारिक पोर्टल पर पुष्टि करें।',
    copy: 'कॉपी करें',
    copied: 'कॉपी हो गया',
    copyFailed: 'कॉपी नहीं हुआ',
    share: 'शेयर करें',
    shareWhatsApp: 'WhatsApp पर शेयर करें',
    shareFooter: 'InBridge से शेयर किया गया — एक स्वतंत्र AI सहायक (सरकारी वेबसाइट नहीं)',
    listen: 'सुनें',
    stopListening: 'रोकें',
    regenerate: 'फिर से लिखें',
    helpful: 'उपयोगी',
    notHelpful: 'उपयोगी नहीं',
    feedbackThanks: 'आपकी प्रतिक्रिया के लिए धन्यवाद।',
    feedbackFailed: 'प्रतिक्रिया नहीं भेजी जा सकी। फिर से कोशिश करें।',
    feedbackWhat: 'क्या गलत था? (वैकल्पिक)',
    feedbackNote: 'टिप्पणी जोड़ें (वैकल्पिक)। निजी जानकारी न लिखें।',
    feedbackSend: 'भेजें',
    feedbackSkip: 'रहने दें',
    reasons: {
        wrong_info: 'गलत जानकारी',
        outdated: 'पुरानी जानकारी',
        wrong_scheme: 'गलत योजना',
        broken_link: 'लिंक काम नहीं करता',
        wrong_language: 'गलत भाषा',
    },
    followUps: 'आगे पूछें',
    checklistTitle: 'दस्तावेज़ चेकलिस्ट',
    checklistProgress: (d, t) => `${t} में से ${d} तैयार`,
    checklistDeviceNote: 'टिक केवल इसी डिवाइस पर सहेजे जाते हैं।',
    copyChecklist: 'सूची कॉपी करें',
    draftTitle: 'शिकायत का ड्राफ्ट',
    copyDraft: 'ड्राफ्ट कॉपी करें',
    openCpgrams: 'CPGRAMS खोलें (pgportal.gov.in)',
    draftNotice: 'InBridge आपकी ओर से शिकायत दर्ज नहीं करता।',
    unverifiedLink: 'यह लिंक सरकारी डोमेन या दिए गए स्रोतों से नहीं है',
    stopped: '(उत्तर अधूरा)',
};

const hinglish: AnswerStrings = {
    answer: 'Answer',
    sources: 'Sources',
    viewAll: (n) => `Sabhi ${n} dekhein`,
    allSources: (n) => `${n} sources`,
    official: 'Official',
    officialHint: 'Government domain (.gov.in / .nic.in)',
    openSource: 'Source page kholein',
    newTab: '(naye tab mein khulega)',
    close: 'Band karein',
    sourceN: (n, host) => `Source ${n}: ${host}`,
    phase: (p, count) => {
        switch (p) {
            case 'searching-dataset': return 'Scheme dataset mein search kar rahe hain';
            case 'searching-gov': return 'Official government sites par search kar rahe hain';
            case 'reading': return count === undefined ? 'Sources padh rahe hain' : `${count} sources padh rahe hain`;
            case 'writing': return 'Answer likh rahe hain';
        }
    },
    provenanceDataset: (label) => (label ? `myScheme dataset se — ${label}` : 'myScheme dataset se'),
    provenanceLive: (when) => (when ? `Official government sites ki live search se · ${when} ko liya gaya` : 'Official government sites ki live search se'),
    provenanceCache: (when) => (when ? `Haal ki saved search se · ${when} ko liya gaya` : 'Haal ki saved search se'),
    provenanceNone: 'Koi source nahi mila — sirf general guidance. Official portal par verify karein.',
    copy: 'Copy',
    copied: 'Copy ho gaya',
    copyFailed: 'Copy nahi hua',
    share: 'Share',
    shareWhatsApp: 'WhatsApp par share karein',
    shareFooter: 'InBridge se share kiya gaya — ek independent AI assistant (government website nahi)',
    listen: 'Suniye',
    stopListening: 'Rokein',
    regenerate: 'Dobara likhein',
    helpful: 'Helpful',
    notHelpful: 'Helpful nahi',
    feedbackThanks: 'Feedback ke liye shukriya.',
    feedbackFailed: 'Feedback nahi bhej paaye. Dobara try karein.',
    feedbackWhat: 'Kya galat tha? (optional)',
    feedbackNote: 'Note add karein (optional). Personal details na likhein.',
    feedbackSend: 'Bhejein',
    feedbackSkip: 'Rehne dein',
    reasons: {
        wrong_info: 'Galat info',
        outdated: 'Purani info',
        wrong_scheme: 'Galat scheme',
        broken_link: 'Link kaam nahi karta',
        wrong_language: 'Galat language',
    },
    followUps: 'Aage poochhein',
    checklistTitle: 'Documents checklist',
    checklistProgress: (d, t) => `${t} mein se ${d} ready`,
    checklistDeviceNote: 'Ticks sirf isi device par save hote hain.',
    copyChecklist: 'List copy karein',
    draftTitle: 'Complaint draft',
    copyDraft: 'Draft copy karein',
    openCpgrams: 'CPGRAMS kholein (pgportal.gov.in)',
    draftNotice: 'InBridge aapke liye complaint file nahi karta.',
    unverifiedLink: 'Yeh link government domain ya cited source se nahi hai',
    stopped: '(answer adhoora)',
};

const STRINGS: Record<Language, AnswerStrings> = { en, hi, hinglish };

export function answerStrings(language: Language): AnswerStrings {
    return STRINGS[language] ?? en;
}
