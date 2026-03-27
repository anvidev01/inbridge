/**
 * Stepper.tsx — Multi-step form progress indicator
 * Step N of 4; completed steps show ✓ in #2E7D32
 * WCAG 1.3.1 — progress conveyed via aria-label, not just colour
 */

interface Step {
    label: string;
    description?: string;
}

interface StepperProps {
    steps: Step[];
    currentStep: number; /* 1-based */
}

export default function Stepper({ steps, currentStep }: StepperProps) {
    return (
        <div
            aria-label={`Form progress: Step ${currentStep} of ${steps.length} — ${steps[currentStep - 1]?.label}`}
        >
            {/* Mobile: compact text indicator */}
            <p className="sm:hidden text-sm font-semibold text-[#1A237E] mb-4" aria-hidden="true">
                Step {currentStep} of {steps.length} — {steps[currentStep - 1]?.label}
            </p>

            {/* Desktop: full stepper bar */}
            <ol
                className="hidden sm:flex items-start gap-0 mb-8 w-full"
                aria-label="Application form steps"
            >
                {steps.map((step, idx) => {
                    const stepNum = idx + 1;
                    const isComplete = stepNum < currentStep;
                    const isCurrent = stepNum === currentStep;
                    const isPending = stepNum > currentStep;

                    return (
                        <li
                            key={step.label}
                            className="flex-1 flex items-start relative"
                            aria-current={isCurrent ? "step" : undefined}
                        >
                            {/* Connector line (not before first item) */}
                            {idx > 0 && (
                                <div
                                    aria-hidden="true"
                                    className={`
                    absolute left-0 top-5 -translate-x-1/2 h-0.5 w-full
                    ${isComplete ? "bg-[#2E7D32]" : "bg-gray-200"}
                    transition-colors duration-300
                  `}
                                />
                            )}

                            <div className="flex flex-col items-center gap-2 w-full z-10">
                                {/* Step circle */}
                                <div
                                    aria-hidden="true"
                                    className={`
                    w-10 h-10 rounded-full flex items-center justify-center
                    text-sm font-bold border-2 transition-all duration-300
                    ${isComplete
                                            ? "bg-[#2E7D32] border-[#2E7D32] text-white"
                                            : isCurrent
                                                ? "bg-[#1A237E] border-[#1A237E] text-white shadow-lg scale-110"
                                                : "bg-white border-gray-300 text-[#616161]"
                                        }
                  `}
                                >
                                    {isComplete ? (
                                        /* Checkmark for completed steps */
                                        <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-label="Completed">
                                            <path d="M3 8l3.5 3.5 6.5-7" stroke="white" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" />
                                        </svg>
                                    ) : (
                                        stepNum
                                    )}
                                </div>

                                {/* Step label */}
                                <div className="text-center px-2">
                                    <p
                                        className={`text-xs font-semibold leading-snug
                      ${isCurrent ? "text-[#1A237E]" : isComplete ? "text-[#2E7D32]" : "text-[#616161]"}
                    `}
                                    >
                                        {step.label}
                                    </p>
                                    {step.description && (
                                        <p className="text-[10px] text-[#616161]/70 mt-0.5 hidden lg:block">
                                            {step.description}
                                        </p>
                                    )}
                                </div>
                            </div>
                        </li>
                    );
                })}
            </ol>

            {/* Mobile progress bar (visual complement) */}
            <div className="sm:hidden w-full bg-gray-200 rounded-full h-1.5 mb-6">
                <div
                    aria-hidden="true"
                    className="bg-[#1A237E] h-1.5 rounded-full transition-all duration-500"
                    style={{ width: `${((currentStep - 1) / (steps.length - 1)) * 100}%` }}
                />
            </div>
        </div>
    );
}
