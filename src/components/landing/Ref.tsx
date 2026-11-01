/**
 * A footnote marker: a small green superscript [n] that links to the
 * numbered entry in the Sources list at the foot of the page. The link text
 * read aloud names the source, not just the number.
 */
import { SOURCES, sourceAnchor, type SourceKey } from './sources';

export function Ref({ to }: { to: SourceKey | SourceKey[] }) {
    const keys = Array.isArray(to) ? to : [to];
    return (
        <>
            {keys.map((key) => {
                const s = SOURCES[key];
                return (
                    <sup key={key} className="lp-ref">
                        <a href={`#${sourceAnchor(s.n)}`} aria-label={`Source ${s.n}: ${s.title}`}>
                            [{s.n}]
                        </a>
                    </sup>
                );
            })}
        </>
    );
}
