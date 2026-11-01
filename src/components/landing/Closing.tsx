/**
 * "Three photographs, then a field": three black-and-white photographs butted
 * edge to edge, then a band of green ink with the closing statement, whose one
 * underlined phrase is the link to the chat. (The blueprint's small portrait
 * of "the person who will answer" is left out: no person answers, an AI does.)
 */
import Image from 'next/image';
import Link from 'next/link';
import { PHOTOS } from '@/lib/photos';
import { MARGIN, T } from './type';

export const CLOSING_PHOTOS = ['bridge-fog', 'farmer', 'village-school'] as const;

export function Closing() {
    return (
        <section aria-labelledby="closing-heading">
            <div className="grid grid-cols-2 md:grid-cols-3">
                {CLOSING_PHOTOS.map((key, i) => {
                    const p = PHOTOS[key];
                    return (
                        <div
                            key={key}
                            className={`relative overflow-hidden ${i === 0 ? 'col-span-2 aspect-[4/3] md:col-span-1 md:aspect-auto' : 'aspect-square md:aspect-auto'} md:h-[40svh]`}
                        >
                            <Image
                                src={p.src}
                                alt={p.alt}
                                fill
                                sizes={i === 0 ? '(min-width: 768px) 34vw, 100vw' : '(min-width: 768px) 34vw, 50vw'}
                                className={`lp-photo ${key === 'farmer' ? 'object-[50%_30%]' : ''}`}
                            />
                        </div>
                    );
                })}
            </div>

            <div className={`${MARGIN} bg-accent text-accent-fg py-16 md:py-24 md:min-h-[44svh] md:grid md:grid-cols-12 md:gap-x-8`}>
                <div className="md:col-span-7">
                    <h2 id="closing-heading" className={T.h} data-reveal>
                        Start with a question
                    </h2>
                    <p className={`${T.l} mt-6 max-w-[40ch]`} data-reveal style={{ ['--reveal-i' as string]: 1 }}>
                        <Link
                            href="/chat"
                            className="underline decoration-[4px] underline-offset-[6px] transition-[text-decoration-color,opacity] duration-200 hover:decoration-transparent active:opacity-70"
                        >
                            Ask about any scheme in your own words
                        </Link>
                        , in English, <span lang="hi">हिन्दी</span> or Hinglish, and read the answer next to the
                        page it came from.
                    </p>
                    <p className={`${T.b} mt-8 max-w-[52ch]`} data-reveal style={{ ['--reveal-i' as string]: 2 }}>
                        No account, and no Aadhaar number. Answers can be wrong, so confirm on the linked official page.
                    </p>
                </div>
                <p
                    lang="hi"
                    className={`${T.l} mt-12 md:mt-0 md:col-span-4 md:col-start-9 md:self-end max-w-[30ch]`}
                    data-reveal
                    style={{ ['--reveal-i' as string]: 3 }}
                >
                    किसी भी सरकारी योजना के बारे में अपने शब्दों में पूछें। हर उत्तर के साथ वह आधिकारिक पेज होगा, जहाँ से
                    जानकारी ली गई है।
                </p>
            </div>
        </section>
    );
}
