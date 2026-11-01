/** Site-wide constants shared by layout, metadata routes and pages. */
export const SITE_URL = "https://inbridge.in";
export const SITE_NAME = "InBridge";

/**
 * The one-line independence disclaimer. Shown under the chat composer, in the
 * footer and on /about. InBridge is not a government website.
 */
export const DISCLAIMER = {
    en: "InBridge is an independent AI assistant, not a government website. Answers can be wrong — confirm on the official portal linked in each answer.",
    hi: "InBridge एक स्वतंत्र AI सहायक है, कोई सरकारी वेबसाइट नहीं। उत्तर गलत हो सकते हैं — हर उत्तर में दिए गए आधिकारिक पोर्टल पर पुष्टि करें।",
    hinglish: "InBridge ek independent AI assistant hai, government website nahi. Answers galat ho sakte hain — har answer mein diye official portal par confirm karein.",
} as const;
