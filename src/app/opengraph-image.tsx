/**
 * app/opengraph-image.tsx: 1200x630 social card (also used by X/Twitter,
 * which falls back to og:image). Purely typographic: no emblem, flag or stats.
 *
 * Fonts are fetched from Google Fonts at build time, subset to the exact text.
 * If a fetch fails the card still renders with next/og's built-in font.
 *
 * "Hindi" is written in Latin script on purpose: satori (behind next/og) does
 * not shape Devanagari, so हिंदी renders with misplaced matras and a missing
 * anusvara even with Noto Sans Devanagari loaded (checked by rendering it).
 */
import { ImageResponse } from "next/og";

export const alt = "InBridge: answers about Indian government schemes, linked to official sources";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

/* Dark theme tokens from globals.css (CSS variables are not available here) */
const BG = "#0a0a0a";
const FG = "#ededed";
const MUTED = "#a3a3a3";
const ACCENT = "#9fa8ff";

const WORDMARK = "InBridge";
const TAGLINE = "Answers about Indian government schemes, linked to official sources";
const LANG_LINE = "Independent · English · Hindi · Hinglish";
const DOMAIN = "inbridge.in";

/** Returns a TTF/OTF subset for `text`, or null on any failure. */
async function loadGoogleFont(family: string, weight: number, text: string): Promise<ArrayBuffer | null> {
  try {
    const cssUrl = `https://fonts.googleapis.com/css2?family=${family}:wght@${weight}&text=${encodeURIComponent(text)}`;
    const cssRes = await fetch(cssUrl);
    if (!cssRes.ok) return null;
    const css = await cssRes.text();
    const match = css.match(/src: url\((.+?)\) format\('(opentype|truetype)'\)/);
    if (!match) return null;
    const fontRes = await fetch(match[1]);
    if (!fontRes.ok) return null;
    return await fontRes.arrayBuffer();
  } catch {
    return null;
  }
}

export default async function OpengraphImage() {
  const [sans, serifRaw] = await Promise.all([
    // Includes the wordmark so Inter can draw it if the serif fails to load
    loadGoogleFont("Inter", 400, `${WORDMARK}${TAGLINE}${LANG_LINE}${DOMAIN}`),
    loadGoogleFont("Source+Serif+4", 600, WORDMARK),
  ]);

  // Passing `fonts` replaces next/og's built-in default font, so custom fonts
  // are only used when the body font (Inter) loaded; a serif-only subset
  // would leave the tagline without glyphs.
  const serif = sans ? serifRaw : null;

  const fonts: { name: string; data: ArrayBuffer; weight: 400 | 600; style: "normal" }[] = [];
  if (sans) fonts.push({ name: "Inter", data: sans, weight: 400, style: "normal" });
  if (serif) fonts.push({ name: "Source Serif 4", data: serif, weight: 600, style: "normal" });

  // Omit fontFamily entirely when falling back: satori throws on `undefined`
  const sansFamily = sans ? { fontFamily: "Inter" } : {};
  const serifFamily = serif ? { fontFamily: "Source Serif 4" } : sansFamily;

  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          flexDirection: "column",
          justifyContent: "space-between",
          padding: "80px 88px",
          backgroundColor: BG,
          color: FG,
          ...sansFamily,
        }}
      >
        <div style={{ display: "flex", flexDirection: "column" }}>
          <div style={{ width: 56, height: 4, backgroundColor: ACCENT, borderRadius: 2 }} />
          <div
            style={{
              marginTop: 36,
              fontSize: 112,
              lineHeight: 1,
              fontWeight: 600,
              letterSpacing: "-0.02em",
              ...serifFamily,
            }}
          >
            {WORDMARK}
          </div>
        </div>

        <div style={{ display: "flex", fontSize: 52, lineHeight: 1.25, maxWidth: 980 }}>
          {TAGLINE}
        </div>

        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-end",
            fontSize: 30,
            color: MUTED,
          }}
        >
          <div style={{ display: "flex" }}>{LANG_LINE}</div>
          <div style={{ display: "flex" }}>{DOMAIN}</div>
        </div>
      </div>
    ),
    { ...size, fonts: fonts.length ? fonts : undefined },
  );
}
