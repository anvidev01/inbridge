/** Site-wide constants shared by layout, metadata routes and pages. */
export const SITE_URL = "https://inbridge.in";
export const SITE_NAME = "InBridge";

/**
 * The one-line independence disclaimer. Shown under the chat composer, in the
 * footer and on /about. InBridge is not a government website.
 */
export const DISCLAIMER = {
    en: "InBridge is an independent AI assistant, not a government website. Answers can be wrong, so confirm on the official portal linked in each answer.",
    hi: "InBridge एक स्वतंत्र AI सहायक है, कोई सरकारी वेबसाइट नहीं। उत्तर गलत हो सकते हैं, इसलिए हर उत्तर में दिए गए आधिकारिक पोर्टल पर पुष्टि करें।",
    hinglish: "InBridge ek independent AI assistant hai, government website nahi. Answers galat ho sakte hain, isliye har answer mein diye official portal par confirm karein.",
} as const;

/**
 * Width and height from a PNG's IHDR chunk, or null if the bytes are not a
 * PNG. Used to size real screenshots for next/image without hard-coding them.
 */
export function pngSize(bytes: Uint8Array): { width: number; height: number } | null {
    const SIGNATURE = [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a];
    if (bytes.length < 24 || SIGNATURE.some((b, i) => bytes[i] !== b)) return null;
    // Bytes 12-15 must spell the first chunk type, "IHDR".
    if (String.fromCharCode(bytes[12], bytes[13], bytes[14], bytes[15]) !== 'IHDR') return null;
    const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
    const width = view.getUint32(16);
    const height = view.getUint32(20);
    return width > 0 && height > 0 ? { width, height } : null;
}
