'use client';

import { useEffect } from 'react';

/**
 * Adds .is-visible to every [data-reveal] element as it scrolls into view
 * (once). Styles live in globals.css; without JS, or with reduced motion,
 * content is simply visible. Mount once per page.
 */
export function Reveal() {
    useEffect(() => {
        const nodes = Array.from(document.querySelectorAll<HTMLElement>('[data-reveal]:not(.is-visible)'));
        if (!('IntersectionObserver' in window)) {
            nodes.forEach((n) => n.classList.add('is-visible'));
            return;
        }
        const io = new IntersectionObserver(
            (entries) => {
                for (const e of entries) {
                    if (e.isIntersecting) {
                        e.target.classList.add('is-visible');
                        io.unobserve(e.target);
                    }
                }
            },
            { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
        );
        nodes.forEach((n) => io.observe(n));
        return () => io.disconnect();
    }, []);
    return null;
}
