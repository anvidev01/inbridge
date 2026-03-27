import re

def sanitize_input(query: str) -> tuple[bool, str]:
    """
    Checks for prompt injection patterns and PII exactly as per CERT-In.
    Returns (is_safe, rejection_reason).
    """
    # 1. PII Check: Refuse queries containing Aadhaar-like numbers or PAN
    aadhaar_pattern = r"\b\d{4}[-\s]?\d{4}[-\s]?\d{4}\b"
    if re.search(aadhaar_pattern, query):
        return False, "Query contains Aadhaar-like sequence. Do not share raw Aadhaar."
        
    pan_pattern = r"\b[A-Z]{5}\d{4}[A-Z]{1}\b"
    if re.search(pan_pattern, query):
        return False, "Query contains PAN pattern. Please avoid submitting raw Personal Identifiable Information."

    # 2. Basic Prompt Injection Keywords
    injection_keywords = [
        "ignore previous instructions",
        "system prompt",
        "you are a developer",
        "forget all",
        "bypass",
        "jailbreak"
    ]
    
    lower_query = query.lower()
    for kw in injection_keywords:
        if kw in lower_query:
            return False, "Potentially unsafe instructions detected."
            
    return True, ""
