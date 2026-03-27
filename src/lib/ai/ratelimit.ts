// Simple in-memory rate limiter for development
// In production, this would use Redis (e.g. @upstash/redis or similar)

interface RateLimitTracker {
    count: number;
    resetAt: number;
}

const rateLimits = new Map<string, RateLimitTracker>();

export async function checkRateLimit(ip: string): Promise<{ success: boolean; limit: number; remaining: number; reset: number }> {
    const limit = parseInt(process.env.CHAT_RATE_LIMIT_PER_MIN || '20', 10);
    const now = Date.now();
    const resetTime = 60 * 1000; // 1 minute window

    let record = rateLimits.get(ip);

    if (!record || now > record.resetAt) {
        // New record or expired window
        record = {
            count: 1,
            resetAt: now + resetTime,
        };
        rateLimits.set(ip, record);
        return { success: true, limit, remaining: limit - 1, reset: record.resetAt };
    }

    // Active window
    if (record.count >= limit) {
        return { success: false, limit, remaining: 0, reset: record.resetAt };
    }

    record.count += 1;
    return { success: true, limit, remaining: limit - record.count, reset: record.resetAt };
}
