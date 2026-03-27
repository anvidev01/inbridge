// src/lib/safety-check.ts

export function isTransactionalQuery(query: string): boolean {
  const lowerQuery = query.toLowerCase();
  
  // Patterns that indicate transactional/personal data requests
  const transactionalPatterns = [
    /my.*money/,
    /my.*payment/,
    /my.*status/,
    /where.*my/,
    /check.*my/,
    /track.*my/,
    /personal.*data/,
    /my.*account/,
    /my.*details/,
    /login/,
    /password/,
    /transaction/,
    /balance/,
    /refund/
  ];
  
  return transactionalPatterns.some(pattern => pattern.test(lowerQuery));
}

export function getSafetyResponse(query: string): string {
  return `🔒 **Privacy & Security Notice**

I understand you're asking about: "${query}"

For your safety and privacy, I cannot:
• Access personal account information
• Check payment status or transactions  
• View application status
• Process any financial transactions

📞 **What you can do:**
• Contact official helplines for status checks
• Visit the scheme's official website
• Use your registered mobile number for updates

🔗 I can still help you with general information about eligibility, documents, and application processes!`;
}