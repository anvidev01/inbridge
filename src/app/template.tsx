/**
 * Re-mounts on every navigation (unlike layout.tsx), so each page eases in
 * instead of snapping. The animation lives in globals.css (.page-enter) and
 * is disabled under prefers-reduced-motion.
 */
export default function Template({ children }: { children: React.ReactNode }) {
    return <div className="page-enter">{children}</div>;
}
