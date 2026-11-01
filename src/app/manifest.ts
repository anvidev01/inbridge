/**
 * app/manifest.ts — served as /manifest.webmanifest
 * Colours match the dark tokens in globals.css (--bg #0a0a0a). Icon sizes are
 * the real pixel sizes of the files in public/. All icons are rendered from
 * the InBridge mark in src/app/icon.svg (an arch whose keystone is the dot of
 * an "i"); icon-maskable-512 keeps the mark inside the 80% safe zone.
 */
import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "InBridge",
    short_name: "InBridge",
    description:
      "An independent AI assistant for Indian government schemes, not a government website. " +
      "Answers link to official .gov.in sources.",
    lang: "en-IN",
    start_url: "/chat",
    scope: "/",
    display: "standalone",
    background_color: "#0a0a0a",
    theme_color: "#0a0a0a",
    icons: [
      { src: "/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
    ],
  };
}
