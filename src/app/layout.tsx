/**
 * app/layout.tsx — Root layout for InBridge
 * GIGW 3.0 · WCAG 2.2 AA · Next.js 15 App Router
 * Includes: SkipToMain, GovHeader, GovFooter, CookieBanner
 */
import type { Metadata, Viewport } from "next";
import { Inter } from "next/font/google";
import "./globals.css";



/* Inter — clean, highly legible for low-literacy users */
const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  display: "swap",
});

export const metadata: Metadata = {
  title: "InBridge",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
      { url: "/logo.png", sizes: "192x192", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
  },
  description:
    "Public service at the speed of life. " +
    "Access Aadhaar, PAN, Passport, Ration Card, and 100+ citizen services online.",
  keywords: ["government services", "Aadhaar", "PAN", "India", "MeitY", "NIC", "citizen portal"],
  authors: [{ name: "Ministry of Electronics & Information Technology" }],
  creator: "MeitY / NIC",
  metadataBase: new URL("https://inbridge.gov.in"),
  openGraph: {
    title: "InBridge — Government Digital Services India",
    description: "Public service at the speed of life.",
    type: "website",
    locale: "en_IN",
    siteName: "InBridge",
  },
  twitter: { card: "summary_large_image" },
};

/* WCAG 1.4.4 — must allow zoom up to at least 200% for low-vision users */
/* Next.js 15: viewport is a separate named export, not part of metadata  */
export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  maximumScale: 5,
  userScalable: true,
  themeColor: "#1A237E",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    /* WCAG 3.1.1 — language of page declared */
    <html lang="en" className={inter.variable}>
      <head>
        {/* Favicon — explicit for Safari */}
        <link rel="icon" href="/favicon-32x32.png" sizes="32x32" type="image/png" />
        <link rel="icon" href="/favicon-16x16.png" sizes="16x16" type="image/png" />
        <link rel="apple-touch-icon" href="/apple-touch-icon.png" />
        {/* Preconnect for speed */}
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
      </head>

      <body className="flex flex-col min-h-screen bg-[#F5F5F5] font-sans">

        {/* ── Main content ── */}
        {/* id="main-content" is the target of the SkipToMain link */}
        <main
          id="main-content"
          className="flex-1 w-full"
          tabIndex={-1}           /* programmatically focusable but not in tab order */
        >
          {children}
        </main>
      </body>
    </html>
  );
}
