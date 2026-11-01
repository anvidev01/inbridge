/**
 * The InBridge mark: a bridge arch whose keystone is the dot of an "i", the
 * stem standing as its pier. The arch and pier take currentColor; only the
 * keystone dot is green ink (fill-accent), matching src/app/icon.svg.
 */
export function LogoMark({ size = 22, className = '', title }: { size?: number; className?: string; title?: string }) {
    return (
        <svg
            width={size}
            height={size}
            viewBox="8 14 48 37"
            className={className}
            role={title ? 'img' : undefined}
            aria-hidden={title ? undefined : true}
            aria-label={title}
        >
            <path d="M10.5 48C11 30 18 22.5 25.5 20" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <path d="M53.5 48C53 30 46 22.5 38.5 20" fill="none" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
            <circle cx="32" cy="19" r="4.2" className="fill-accent" />
            <path d="M32 29.5V48" stroke="currentColor" strokeWidth="5" strokeLinecap="round" />
        </svg>
    );
}

/** Mark + serif wordmark, as used in headers. */
export function Logo({ className = '' }: { className?: string }) {
    return (
        <span className={`inline-flex items-center gap-2.5 ${className}`}>
            <LogoMark size={24} className="text-fg" />
            <span className="font-serif text-[1.375rem] font-semibold leading-none tracking-tight">InBridge</span>
        </span>
    );
}
