/**
 * app/services/[slug]/page.tsx — Service Detail Page
 * GIGW 3.0 · WCAG 2.2 AA
 * Shows eligibility, required documents, steps, and CTA.
 */
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";

/* ── Static service catalogue ─────────────────────────────── */
const SERVICES: Record<string, {
    title: string; subtitle: string; icon: string; category: string;
    description: string; eligibility: string[]; documents: string[];
    steps: string[]; fee: string; timeline: string; slug: string;
}> = {
    "aadhaar": {
        slug: "aadhaar", icon: "🪪",
        title: "Apply for Aadhaar Card",
        subtitle: "Unique Biometric Identity · UIDAI",
        category: "personal",
        description: "Aadhaar is your 12-digit unique biometric identity issued by UIDAI. It is accepted as proof of identity and address across India for all government and private services.",
        eligibility: ["Any resident of India (citizen or non-citizen)", "Infants and children can also enrol", "No age limit"],
        documents: ["Proof of Identity (Passport / Driving Licence / Voter ID)", "Proof of Address (Utility bill / Bank statement)", "Date of Birth proof (Birth Certificate / School certificate)"],
        steps: ["Book an appointment at nearest Aadhaar Enrolment Centre", "Visit centre with original documents", "Biometric capture (fingerprint + iris + photo)", "Receive Enrolment ID via SMS", "Download e-Aadhaar or receive physical card by post"],
        fee: "Free",
        timeline: "90 days",
    },
    "pan": {
        slug: "pan", icon: "💳",
        title: "Update PAN Card Details",
        subtitle: "Permanent Account Number · Income Tax Dept",
        category: "personal",
        description: "Update your PAN card details like name, date of birth, or address. Required for all financial transactions above ₹50,000.",
        eligibility: ["Existing PAN card holders", "Indian citizens and foreign nationals"],
        documents: ["Existing PAN card", "Identity proof", "Address proof", "Date of birth proof"],
        steps: ["Fill online correction form (49-A or 49-AA)", "Upload self-attested documents", "Pay processing fee", "Verify via Aadhaar OTP or digital signature", "Receive updated PAN card within 15 days"],
        fee: "₹107 (Indian address) / ₹1,017 (Foreign address)",
        timeline: "15 working days",
    },
    "pm-kisan": {
        slug: "pm-kisan", icon: "🌾",
        title: "PM-KISAN Status",
        subtitle: "Pradhan Mantri Kisan Samman Nidhi",
        category: "financial",
        description: "Check the status of your PM-KISAN benefit of ₹6,000 per year paid in three equal instalments directly to farmer bank accounts.",
        eligibility: ["Small and marginal farmers", "Land holding families with cultivable land"],
        documents: ["Aadhaar card", "Bank account number linked to Aadhaar", "Land records"],
        steps: ["Enter Aadhaar number or mobile number", "View instalment payment history", "Check pending KYC status", "Download payment receipt"],
        fee: "Free",
        timeline: "Instant status check",
    },
};

interface PageProps {
    params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
    const { slug } = await params;
    const service = SERVICES[slug];
    if (!service) return { title: "Service Not Found" };
    return {
        title: service.title,
        description: service.description,
    };
}

export default async function ServiceDetailPage({ params }: PageProps) {
    const { slug } = await params;
    const service = SERVICES[slug];
    if (!service) notFound();

    return (
        <div className="max-w-screen-lg mx-auto px-4 py-8">
            {/* Breadcrumb */}
            <nav aria-label="Breadcrumb" className="mb-6">
                <ol className="flex items-center gap-2 text-sm text-[#616161]">
                    <li><Link href="/" className="hover:text-[#1A237E] hover:underline">Home</Link></li>
                    <li aria-hidden="true">›</li>
                    <li><Link href="/services" className="hover:text-[#1A237E] hover:underline">Services</Link></li>
                    <li aria-hidden="true">›</li>
                    <li className="font-semibold text-[#1A237E]" aria-current="page">{service.title}</li>
                </ol>
            </nav>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Main content */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Service header */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <div className="flex items-center gap-4 mb-4">
                            <div
                                className="w-16 h-16 rounded-2xl bg-[#E8EAF6] flex items-center justify-center text-3xl"
                                aria-hidden="true"
                            >
                                {service.icon}
                            </div>
                            <div>
                                <h1 className="text-xl font-black text-[#1A237E] leading-tight">{service.title}</h1>
                                <p className="text-sm text-[#616161] mt-1">{service.subtitle}</p>
                            </div>
                        </div>
                        <p className="text-sm text-[#111111] leading-relaxed">{service.description}</p>

                        {/* Fee + Timeline chips */}
                        <div className="flex flex-wrap gap-3 mt-4">
                            <div className="flex items-center gap-1.5 bg-[#E8F5E9] text-[#2E7D32] text-xs font-bold px-3 py-1.5 rounded-full">
                                <svg aria-hidden="true" width="12" height="12" fill="none" viewBox="0 0 12 12">
                                    <circle cx="6" cy="6" r="5" stroke="currentColor" strokeWidth="1.4" />
                                    <path d="M6 3v3.5l2 1" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" />
                                </svg>
                                Timeline: {service.timeline}
                            </div>
                            <div className="flex items-center gap-1.5 bg-[#E8EAF6] text-[#1A237E] text-xs font-bold px-3 py-1.5 rounded-full">
                                💰 Fee: {service.fee}
                            </div>
                        </div>
                    </div>

                    {/* How to Apply */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h2 className="text-base font-bold text-[#1A237E] mb-4">How to Apply</h2>
                        <ol className="space-y-3">
                            {service.steps.map((step, idx) => (
                                <li key={idx} className="flex items-start gap-3">
                                    <span
                                        aria-hidden="true"
                                        className="shrink-0 w-7 h-7 rounded-full bg-[#1A237E] text-white text-xs font-bold flex items-center justify-center mt-0.5"
                                    >
                                        {idx + 1}
                                    </span>
                                    <p className="text-sm text-[#111111] leading-relaxed pt-0.5">{step}</p>
                                </li>
                            ))}
                        </ol>
                    </div>

                    {/* Documents Required */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h2 className="text-base font-bold text-[#1A237E] mb-3">Documents Required</h2>
                        <ul className="space-y-2" aria-label="Required documents">
                            {service.documents.map((doc) => (
                                <li key={doc} className="flex items-start gap-2 text-sm text-[#111111]">
                                    <svg aria-hidden="true" className="shrink-0 mt-0.5 text-[#2E7D32]" width="16" height="16" fill="none" viewBox="0 0 16 16">
                                        <circle cx="8" cy="8" r="7" fill="#E8F5E9" />
                                        <path d="M5 8l2 2 4-3.5" stroke="#2E7D32" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
                                    </svg>
                                    {doc}
                                </li>
                            ))}
                        </ul>
                    </div>

                    {/* Eligibility */}
                    <div className="bg-white rounded-2xl p-6 border border-gray-100 shadow-sm">
                        <h2 className="text-base font-bold text-[#1A237E] mb-3">Who Can Apply</h2>
                        <ul className="space-y-2" aria-label="Eligibility criteria">
                            {service.eligibility.map((item) => (
                                <li key={item} className="flex items-start gap-2 text-sm text-[#111111]">
                                    <span aria-hidden="true" className="text-[#1A237E] mt-0.5">▶</span>
                                    {item}
                                </li>
                            ))}
                        </ul>
                    </div>
                </div>

                {/* Sidebar CTA */}
                <aside aria-label="Apply for this service">
                    <div className="sticky top-6 bg-white rounded-2xl p-6 border border-[#1A237E]/15 shadow-sm space-y-4">
                        <h2 className="text-base font-bold text-[#1A237E]">Ready to Apply?</h2>
                        <p className="text-sm text-[#616161] leading-relaxed">
                            Complete your application in under 10 minutes with documents ready.
                        </p>

                        <Link
                            href={`/apply/${slug}`}
                            className="
                block w-full text-center
                touch-target py-3.5 rounded-xl
                bg-[#2E7D32] text-white font-bold text-sm
                hover:bg-green-700 active:scale-95
                transition-all duration-150
              "
                            aria-label={`Start your ${service.title} application`}
                        >
                            Start Application →
                        </Link>

                        <Link
                            href="/status"
                            className="
                block w-full text-center
                touch-target py-3 rounded-xl
                border-2 border-[#1A237E] text-[#1A237E] font-semibold text-sm
                hover:bg-[#1A237E] hover:text-white
                transition-all duration-150
              "
                        >
                            Check Existing Status
                        </Link>

                        {/* Helpline */}
                        <p className="text-xs text-[#616161] text-center pt-2">
                            Need help?{" "}
                            <a href="tel:1800111555" className="text-[#1A237E] font-semibold underline">
                                1800-111-555
                            </a>{" "}
                            (Toll-free, 24×7)
                        </p>
                    </div>
                </aside>
            </div>
        </div>
    );
}

/* Static params for build-time generation */
export function generateStaticParams() {
    return Object.keys(SERVICES).map((slug) => ({ slug }));
}
