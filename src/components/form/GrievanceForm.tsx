"use client";

import { useState } from "react";
import FormField from "./FormField";
import Stepper from "./Stepper";
import { submitApplication } from "@/app/actions";

export default function GrievanceForm() {
    const [step, setStep] = useState(1);
    const [formData, setFormData] = useState({
        name: "",
        mobile: "",
        category: "",
        description: "",
        department: "",
    });

    const isStep1Valid = formData.name && formData.mobile && formData.mobile.length === 10;
    const isStep2Valid = formData.category && formData.department && formData.description.length >= 20;

    const [isSubmitting, setIsSubmitting] = useState(false);
    const [submitError, setSubmitError] = useState("");
    const [trackingId, setTrackingId] = useState("");

    const handleNext = () => setStep((s) => Math.min(s + 1, 3));
    const handlePrev = () => setStep((s) => Math.max(s - 1, 1));
    const handleSubmit = async () => {
        setIsSubmitting(true);
        setSubmitError("");
        try {
            const res = await submitApplication("GRIEVANCE", formData);
            if (res.success && res.arn) {
                setTrackingId(res.arn);
                setStep(3);
            } else {
                setSubmitError(res.error || "Failed to submit. Please try again.");
            }
        } catch (e) {
            setSubmitError("An unexpected error occurred.");
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6 md:p-8">
            <Stepper
                currentStep={step}
                steps={[
                    { label: "Personal Details", description: "Your contact info" },
                    { label: "Grievance Details", description: "Nature of complaint" },
                    { label: "Confirmation", description: "Tracking ID" },
                ]}
            />

            <div className="mt-8">
                {/* Step 1: Personal Info */}
                {step === 1 && (
                    <div className="space-y-5 animate-fadeIn">
                        <h2 className="text-xl font-bold text-[#1A237E] mb-4">Personal Information</h2>

                        <FormField
                            label="Full Name"
                            name="name"
                            value={formData.name}
                            onChange={(val) => setFormData({ ...formData, name: val })}
                            required
                            placeholder="e.g. Rahul Kumar"
                        />
                        <FormField
                            label="Mobile Number"
                            name="mobile"
                            type="tel"
                            maxLength={10}
                            value={formData.mobile}
                            onChange={(val) => setFormData({ ...formData, mobile: val.replace(/\D/g, "") })}
                            required
                            placeholder="10-digit mobile number"
                            helpText="We will send updates to this number."
                        />

                        <div className="pt-4 flex justify-end">
                            <button
                                onClick={handleNext}
                                disabled={!isStep1Valid}
                                className="px-6 py-3 bg-[#1A237E] text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-[#283593] transition-colors"
                            >
                                Continue →
                            </button>
                        </div>
                    </div>
                )}

                {/* Step 2: Grievance Info */}
                {step === 2 && (
                    <div className="space-y-5 animate-fadeIn">
                        <h2 className="text-xl font-bold text-[#1A237E] mb-4">Grievance Details</h2>

                        <FormField
                            label="Department / Ministry"
                            name="department"
                            type="select"
                            value={formData.department}
                            onChange={(val) => setFormData({ ...formData, department: val })}
                            required
                            options={[
                                { value: "telecom", label: "Telecommunications" },
                                { value: "railways", label: "Railways" },
                                { value: "panchayat", label: "Panchayati Raj" },
                                { value: "finance", label: "Finance & Taxation" },
                            ]}
                        />

                        <FormField
                            label="Grievance Category"
                            name="category"
                            type="select"
                            value={formData.category}
                            onChange={(val) => setFormData({ ...formData, category: val })}
                            required
                            options={[
                                { value: "delay", label: "Delay in service" },
                                { value: "corruption", label: "Corruption/Bribery" },
                                { value: "quality", label: "Poor quality of service" },
                                { value: "other", label: "Other" },
                            ]}
                        />

                        <FormField
                            label="Description"
                            name="description"
                            type="textarea"
                            value={formData.description}
                            onChange={(val) => setFormData({ ...formData, description: val })}
                            required
                            maxLength={1000}
                            placeholder="Describe your issue in detail (minimum 20 characters)..."
                            helpText="Please do not include sensitive personal information like bank passwords."
                            tooltip="Provide exact dates, transaction IDs, or office locations if applicable."
                        />

                        <div className="pt-4 flex justify-between items-center">
                            <button
                                onClick={handlePrev}
                                disabled={isSubmitting}
                                className="px-6 py-3 border-2 border-gray-300 text-[#616161] rounded-xl font-bold hover:bg-gray-50 transition-colors disabled:opacity-50"
                            >
                                ← Back
                            </button>
                            <div className="flex flex-col items-end">
                                {submitError && <p className="text-sm text-[#C62828] mb-2">{submitError}</p>}
                                <button
                                    onClick={handleSubmit}
                                    disabled={!isStep2Valid || isSubmitting}
                                    className="px-6 py-3 bg-[#2E7D32] text-white rounded-xl font-bold disabled:opacity-50 disabled:cursor-not-allowed hover:bg-green-700 transition-colors"
                                >
                                    {isSubmitting ? "Submitting..." : "Submit Grievance"}
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Step 3: Success */}
                {step === 3 && (
                    <div className="text-center py-6 animate-fadeIn">
                        <div className="w-20 h-20 bg-[#E8F5E9] text-[#2E7D32] rounded-full flex items-center justify-center text-4xl mx-auto mb-4">
                            ✓
                        </div>
                        <h2 className="text-2xl font-black text-[#1A237E] mb-2">Grievance Submitted!</h2>
                        <p className="text-[#616161] mb-6">
                            Your complaint has been forwarded to the {formData.department ? formData.department.toUpperCase() : "selected"} department.
                        </p>

                        <div className="bg-gray-50 p-4 rounded-xl border border-gray-200 inline-block mb-8">
                            <p className="text-xs text-[#616161] uppercase tracking-wide font-bold mb-1">Your Tracking ID</p>
                            <p className="text-xl font-mono font-bold text-[#111111]">{trackingId || "PENDING..."}</p>
                        </div>

                        <div>
                            <button
                                onClick={() => window.location.href = '/'}
                                className="px-8 py-3 bg-[#1A237E] text-white rounded-xl font-bold hover:bg-[#283593] transition-colors"
                            >
                                Return to Dashboard
                            </button>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
