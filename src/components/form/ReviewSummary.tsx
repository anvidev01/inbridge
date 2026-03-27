/**
 * ReviewSummary.tsx — Pre-submit review page with section edit links
 * WCAG 2.4.4 — edit link purpose clear from context
 * WCAG 3.3.4 — reversibility: review before submit
 */

interface SectionData {
    id: string;
    title: string;
    stepIndex: number;           /* which step to go back to */
    fields: { label: string; value: string }[];
}

interface ReviewSummaryProps {
    sections: SectionData[];
    onEdit: (stepIndex: number) => void;
}

export default function ReviewSummary({ sections, onEdit }: ReviewSummaryProps) {
    return (
        <div className="space-y-5">
            {/* Review header */}
            <div className="bg-[#E8EAF6] border border-[#1A237E]/20 rounded-xl p-4 flex items-start gap-3">
                <svg aria-hidden="true" className="shrink-0 mt-0.5 text-[#1A237E]" width="20" height="20" viewBox="0 0 20 20" fill="none">
                    <circle cx="10" cy="10" r="9" stroke="currentColor" strokeWidth="1.6" />
                    <path d="M10 6v5M10 13.5v.5" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" />
                </svg>
                <div>
                    <p className="text-sm font-bold text-[#1A237E]">
                        Please review your information before submitting
                    </p>
                    <p className="text-xs text-[#1A237E]/80 mt-0.5">
                        Check all details carefully. Use the Edit button to make changes. This cannot be undone after submission.
                    </p>
                </div>
            </div>

            {/* Section cards */}
            {sections.map((section) => (
                <div
                    key={section.id}
                    className="bg-white rounded-xl border border-gray-200 overflow-hidden"
                >
                    {/* Section header */}
                    <div className="flex items-center justify-between px-5 py-3 bg-[#F5F5F5] border-b border-gray-200">
                        <h3 className="text-sm font-bold text-[#1A237E]">{section.title}</h3>
                        <button
                            type="button"
                            onClick={() => onEdit(section.stepIndex)}
                            aria-label={`Edit ${section.title} details`}
                            className="
                touch-target flex items-center gap-1.5 px-3 py-1.5 rounded-lg
                text-xs font-semibold text-[#1A237E]
                border border-[#1A237E]/30
                hover:bg-[#1A237E] hover:text-white
                transition-all duration-150
              "
                        >
                            <svg aria-hidden="true" width="12" height="12" viewBox="0 0 12 12" fill="none">
                                <path d="M8.5 1.5l2 2-6 6H2.5v-2l6-6z" stroke="currentColor" strokeWidth="1.4" strokeLinecap="round" strokeLinejoin="round" />
                            </svg>
                            Edit
                        </button>
                    </div>

                    {/* Field rows */}
                    <dl className="divide-y divide-gray-100">
                        {section.fields.map(({ label, value }) => (
                            <div key={label} className="flex gap-4 px-5 py-3">
                                <dt className="w-40 shrink-0 text-xs font-semibold text-[#616161] leading-snug pt-0.5">
                                    {label}
                                </dt>
                                <dd className="flex-1 text-sm text-[#111111] font-medium break-all">
                                    {value || <span className="text-[#616161]/50 italic">Not provided</span>}
                                </dd>
                            </div>
                        ))}
                    </dl>
                </div>
            ))}
        </div>
    );
}
