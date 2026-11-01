// Client-side helper (not a server action): the JWT lives in localStorage and the
// Go API is a separate public origin, so the browser must call it directly.
export async function submitApplication(serviceCode: string, formData: unknown) {
    const baseUrl = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8080";
    const token = typeof window !== "undefined" ? localStorage.getItem("inbridge_token") : null;
    if (!token) {
        return { success: false, error: "Please log in to submit your grievance." };
    }
    try {
        const res = await fetch(`${baseUrl}/api/v1/services/apply`, {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                Authorization: `Bearer ${token}`,
            },
            body: JSON.stringify({ service_code: serviceCode, form_data: formData }),
        });
        if (res.status === 401) {
            return { success: false, error: "Your session expired. Please log in again." };
        }
        if (!res.ok) {
            throw new Error(`Failed to submit: ${res.status}`);
        }
        const data = await res.json();
        return { success: true, arn: data.arn as string };
    } catch (error) {
        console.error("Submission error:", error);
        return { success: false, error: "Failed to submit application" };
    }
}
