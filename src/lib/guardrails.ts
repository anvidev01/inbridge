
// Basic in-memory rate limiter: Map<IP, timestamp[]>
const rateLimitMap = new Map<string, number[]>();
const RATE_LIMIT_WINDOW = 60 * 1000; // 1 minute
const MAX_REQUESTS_PER_WINDOW = 10;

interface ValidationResult {
    valid: boolean;
    error?: string;
    sanitizedText?: string;
}

export function validateRequest(text: string, ip: string = 'unknown'): ValidationResult {
    // 1. Rate Limiting
    const now = Date.now();
    const userRequests = rateLimitMap.get(ip) || [];

    // Filter out old requests
    const recentRequests = userRequests.filter(time => now - time < RATE_LIMIT_WINDOW);

    if (recentRequests.length >= MAX_REQUESTS_PER_WINDOW) {
        return {
            valid: false,
            error: "Too many requests. Please try again in a minute. (कृपया थोड़ी देर बाद पुनः प्रयास करें।)"
        };
    }

    // Update rate limit map
    recentRequests.push(now);
    rateLimitMap.set(ip, recentRequests);

    // 2. Sanitization (Remove HTML/Scripts)
    // Simple regex to strip HTML tags
    const sanitizedText = text.replace(/<[^>]*>?/gm, '');

    // 3. PII Detection

    // Aadhaar: 12 digits, often spaced 4-4-4
    const aadhaarRegex = /\b\d{4}\s?\d{4}\s?\d{4}\b/;
    if (aadhaarRegex.test(sanitizedText)) {
        return {
            valid: false,
            error: "Security Alert: Please do not share Aadhaar numbers. (सुरक्षा चेतावनी: कृपया आधार नंबर साझा न करें।)"
        };
    }

    // PAN Card: 5 letters, 4 digits, 1 letter (ABCDE1234F)
    const panRegex = /[A-Z]{5}[0-9]{4}[A-Z]{1}/i;
    if (panRegex.test(sanitizedText)) {
        return {
            valid: false,
            error: "Security Alert: Please do not share PAN card details. (सुरक्षा चेतावनी: कृपया पैन कार्ड विवरण साझा न करें।)"
        };
    }

    // Phone Number: Indian mobile numbers (6-9 followed by 9 digits), optional +91
    const phoneRegex = /(\+91[\-\s]?)?[6-9]\d{9}\b/;
    if (phoneRegex.test(sanitizedText)) {
        return {
            valid: false,
            error: "Security Alert: Please do not share phone numbers. (सुरक्षा चेतावनी: कृपया फोन नंबर साझा न करें।)"
        };
    }

    return {
        valid: true,
        sanitizedText: sanitizedText
    };
}
