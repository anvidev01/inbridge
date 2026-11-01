/**
 * app/layout.tsx — Root layout for InBridge
 * Fonts, theme bootstrap, site-wide metadata. Each page renders its own
 * <main id="main-content"> (the skip link targets it).
 */
import type { Metadata, Viewport } from "next";
import { Inter, Noto_Sans_Devanagari, Noto_Serif_Devanagari, Source_Serif_4 } from "next/font/google";
import "./globals.css";
import { SITE_URL } from "@/lib/site";

/* Inter — clean, highly legible for low-literacy users */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

/* Devanagari glyphs for Hindi answers (Inter has none) */
const notoDeva = Noto_Sans_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-deva",
  display: "swap",
});

/* Wordmark / display serif (previously fell back to Times) */
const sourceSerif = Source_Serif_4({
  subsets: ["latin"],
  variable: "--font-source-serif",
  display: "swap",
});

const notoSerifDeva = Noto_Serif_Devanagari({
  subsets: ["devanagari"],
  variable: "--font-noto-serif-deva",
  display: "swap",
});

const DESCRIPTION =
  "InBridge is an independent AI assistant for Indian government schemes and services. " +
  "Ask in English, Hindi or Hinglish and get answers linked to official .gov.in sources.";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    default: "InBridge — answers about Indian government schemes, with official sources",
    template: "%s · InBridge",
  },
  description: DESCRIPTION,
  applicationName: "InBridge",
  keywords: ["government schemes", "Aadhaar", "PM-KISAN", "scholarship", "India", "myScheme", "AI assistant"],
  icons: {
    icon: [
      { url: "/icon.svg", type: "image/svg+xml" },
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
      { url: "/icon-512.png", sizes: "512x512", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  openGraph: {
    title: "InBridge",
    description: DESCRIPTION,
    type: "website",
    locale: "en_IN",
    siteName: "InBridge",
    url: SITE_URL,
  },
  twitter: { card: "summary_large_image", title: "InBridge", description: DESCRIPTION },
};

/* WCAG 1.4.4 — must allow zoom up to at least 200% for low-vision users */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  viewportFit: "cover",
  interactiveWidget: "resizes-content",
  themeColor: [
    { media: "(prefers-color-scheme: dark)", color: "#0a0a0a" },
    { media: "(prefers-color-scheme: light)", color: "#faf9f6" },
  ],
};

/**
 * Runs before first paint so the stored theme never flashes.
 * Default is dark (the original InBridge look); users can switch.
 * Must stay in sync with THEME_STORAGE_KEY in components/ui/ThemeToggle.tsx.
 */
const THEME_BOOTSTRAP = `(function(){document.documentElement.classList.add('js');try{var t=localStorage.getItem('inbridge_theme');document.documentElement.dataset.theme=(t==='light'||t==='dark')?t:'dark';}catch(e){document.documentElement.dataset.theme='dark';}})();`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* WCAG 3.1.1 — language of page declared; the chat updates it with the language toggle */
    <html
      lang="en-IN"
      data-theme="dark"
      suppressHydrationWarning
      className={`${inter.variable} ${notoDeva.variable} ${sourceSerif.variable} ${notoSerifDeva.variable}`}
    >
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_BOOTSTRAP }} />
      </head>
      <body className="min-h-dvh bg-bg text-fg font-sans antialiased">
        <a href="#main-content" className="skip-link">Skip to main content</a>
        {children}
      </body>
    </html>
  );
}
