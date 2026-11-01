/**
 * Masthead: a gutterless mosaic of four black-and-white photographs of
 * public life in India and three flat tiles (green ink, ink, a tone step),
 * then the title on the 42% axis with the standfirst beside it.
 */
import Image from 'next/image';
import Link from 'next/link';
import { LogoMark } from '@/components/site/Logo';
import { PHOTOS } from '@/lib/photos';
import { Ref } from './Ref';
import { BUTTON, MARGIN, T, TEXT_LINK } from './type';

export const HERO_PHOTOS = ['bridge-crowd', 'farmer', 'post-office', 'station'] as const;

function Photo({ k, sizes, priority = false, drift = false }: { k: (typeof HERO_PHOTOS)[number]; sizes: string; priority?: boolean; drift?: boolean }) {
    const p = PHOTOS[k];
    return (
        <Image
            src={p.src}
            alt={p.alt}
            fill
            sizes={sizes}
            priority={priority}
            className={`lp-photo ${drift ? 'lp-drift' : ''}`}
        />
    );
}

export function Hero({ total }: { total: number }) {
    const count = total.toLocaleString('en-IN');
    return (
        <section aria-labelledby="hero-heading">
            <div className="lp-mosaic">
                <div className="lp-cell-bridge">
                    <Photo k="bridge-crowd" sizes="(min-width: 768px) 34vw, 67vw" priority drift />
                </div>
                <div className="lp-cell-ink grid place-items-center bg-accent text-accent-fg">
                    <LogoMark size={64} className="w-[42%] max-w-24 h-auto" />
                </div>
                <div className="lp-cell-farm">
                    <Photo k="farmer" sizes="(min-width: 768px) 17vw, 34vw" />
                </div>
                <div className="lp-cell-paper bg-fg" />
                <div className="lp-cell-tone bg-surface-2" />
                <div className="lp-cell-station">
                    <Photo k="station" sizes="17vw" />
                </div>
                <div className="lp-cell-post">
                    <Photo k="post-office" sizes="17vw" />
                </div>
            </div>

            <div className={`${MARGIN} pt-10 md:pt-16 lg:grid lg:grid-cols-[42%_1fr] lg:items-start`}>
                <h1 id="hero-heading" className={`${T.d} md:text-[9vw] lg:text-[clamp(2.375rem,6.4vw,6.5rem)] text-fg lg:col-start-2 lg:row-start-1`}>
                    <span className="line-mask">
                        <span style={{ ['--line-i' as string]: 0 }}>Every answer</span>
                    </span>
                    <span className="line-mask">
                        <span style={{ ['--line-i' as string]: 1 }}>cites its source.</span>
                    </span>
                </h1>

                <div className="mt-8 lg:mt-3 lg:col-start-1 lg:row-start-1 lg:pr-12" data-reveal style={{ ['--reveal-i' as string]: 3 }}>
                    <p className={`${T.l} max-w-[36ch] text-fg text-pretty`}>
                        InBridge is an independent AI assistant for {count} Indian government schemes
                        <Ref to="myscheme" />: ask in English, <span lang="hi">हिन्दी</span> or Hinglish, and each
                        answer links to the official page it came from
                        <Ref to="search" />.
                    </p>
                    <div className="mt-8 flex flex-wrap items-center gap-x-6 gap-y-3">
                        <Link href="/chat" className={`${BUTTON} ${T.b}`}>
                            Ask InBridge
                        </Link>
                        <Link href="/services" className={`${T.b} ${TEXT_LINK} inline-flex min-h-11 items-center text-fg`}>
                            Browse all {count} schemes
                        </Link>
                    </div>
                </div>
            </div>
        </section>
    );
}
