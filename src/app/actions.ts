"use server";

export async function submitApplication(serviceCode: string, formData: any) {
    try {
        const res = await fetch("http://go-api:8080/api/v1/services/apply", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                // In a real app, you would pass the auth token (JWT) from the user's cookies here
                // "Authorization": `Bearer ${token}`
            },
            body: JSON.stringify({
                service_code: serviceCode,
                form_data: formData,
            }),
        });

        if (!res.ok) {
            throw new Error(`Failed to submit: ${res.statusText}`);
        }

        const data = await res.json();
        return { success: true, arn: data.arn };
    } catch (error) {
        console.error("Submission error:", error);
        return { success: false, error: "Failed to submit application" };
    }
}
