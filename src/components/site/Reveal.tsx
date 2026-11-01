'use client';

import { useEffect } from 'react';

/**
 * Adds .is-visible to every [data-reveal] element as it scrolls into view
 * (once). Styles live in globals.css; without JS, or with reduced motion,
 * content is simply visible. Mount once per page.
 *
 * Client-side navigation can render new [data-reveal] nodes while this stays
 * mounted (e.g. /services "Next page" re-renders the results), so a
 * MutationObserver picks those up too; otherwise they would stay at opacity 0.
 */
export function Reveal() {
    useEffect(() => {
        const reveal = (el: Element) => el.classList.add('is-visible');
        const io = 'IntersectionObserver' in window
            ? new IntersectionObserver(
                (entries) => {
                    for (const e of entries) {
                        if (e.isIntersecting) {
                            reveal(e.target);
                            io?.unobserve(e.target);
                        }
                    }
                },
                { rootMargin: '0px 0px -8% 0px', threshold: 0.08 }
            )
            : null;

        const watch = (root: ParentNode) => {
            root.querySelectorAll('[data-reveal]:not(.is-visible)').forEach((el) => {
                if (io) io.observe(el);
                else reveal(el);
            });
        };
        watch(document);

        const mo = new MutationObserver((records) => {
            for (const r of records) {
                r.addedNodes.forEach((node) => {
                    if (!(node instanceof Element)) return;
                    if (node.matches('[data-reveal]:not(.is-visible)')) {
                        if (io) io.observe(node);
                        else reveal(node);
                    }
                    watch(node);
                });
            }
        });
        mo.observe(document.body, { childList: true, subtree: true });

        return () => {
            io?.disconnect();
            mo.disconnect();
        };
    }, []);
    return null;
}
