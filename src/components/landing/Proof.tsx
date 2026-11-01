/**
 * "Plain names in columns": the official websites InBridge answers link to,
 * grouped by kind. The portals are ones that came back as cited sources in
 * live answers during testing (1 November 2026). They are sites it cites, not
 * partners; none of them has endorsed InBridge.
 */
import { Ref } from './Ref';
import { MARGIN, T } from './type';

const GROUPS: { kind: string; names: { label: string; href?: string }[] }[] = [
    {
        kind: 'Scheme catalogue',
        names: [{ label: 'myscheme.gov.in', href: 'https://www.myscheme.gov.in/' }],
    },
    {
        kind: 'Portals answers have cited',
        names: [
            { label: 'uidai.gov.in', href: 'https://uidai.gov.in/' },
            { label: 'scholarships.gov.in', href: 'https://scholarships.gov.in/' },
            { label: 'pib.gov.in', href: 'https://pib.gov.in/' },
            { label: 'umang.gov.in', href: 'https://web.umang.gov.in/' },
            { label: 'scholarship.odisha.gov.in', href: 'https://scholarship.odisha.gov.in/' },
            { label: 'dag.gujarat.gov.in', href: 'https://dag.gujarat.gov.in/' },
        ],
    },
    {
        kind: 'Where complaints go',
        names: [{ label: 'pgportal.gov.in', href: 'https://pgportal.gov.in/' }],
    },
    {
        kind: 'Live search reads',
        names: [{ label: 'Any .gov.in site' }, { label: 'Any .nic.in site' }],
    },
];

export function Proof() {
    return (
        <section aria-labelledby="proof-heading" className={`${MARGIN} py-28 md:py-36 md:grid md:grid-cols-12 md:gap-x-8`}>
            <div className="md:col-span-4 lg:col-span-3">
                <h2 id="proof-heading" className={`${T.h} text-fg`} data-reveal>
                    Where answers come from
                </h2>
                <p className={`${T.b} mt-6 max-w-[34ch] text-fg`} data-reveal style={{ ['--reveal-i' as string]: 1 }}>
                    Official websites that InBridge answers link to. They are sources, not partners, and none of
                    them has endorsed InBridge
                    <Ref to="search" />.
                </p>
            </div>
            <div className="mt-14 md:mt-0 md:col-span-8 md:col-start-5 columns-2 lg:columns-4 gap-x-8" data-reveal style={{ ['--reveal-i' as string]: 2 }}>
                {GROUPS.map((g, i) => (
                    <div key={g.kind} className={`text-[1.0625rem] md:text-[1.25rem] leading-[1.5] break-inside-avoid ${i > 0 ? 'mt-8 lg:mt-0 lg:break-before-column' : ''}`}>
                        <p id={`proof-kind-${i}`} className="text-muted">{g.kind}</p>
                        <ul aria-labelledby={`proof-kind-${i}`}>
                        {g.names.map((name) => (
                            <li key={name.label} className="text-fg">
                                {name.href ? (
                                    <a
                                        href={name.href}
                                        target="_blank"
                                        rel="noopener noreferrer"
                                        className="underline decoration-transparent decoration-[0.07em] underline-offset-[0.22em] transition-[text-decoration-color,color] duration-200 hover:text-accent hover:decoration-current"
                                    >
                                        {name.label}
                                        <span className="sr-only"> (opens in a new tab)</span>
                                    </a>
                                ) : (
                                    name.label
                                )}
                            </li>
                        ))}
                        </ul>
                    </div>
                ))}
            </div>
        </section>
    );
}
