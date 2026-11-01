/**
 * app/manifest.ts — served as /manifest.webmanifest
 * Colours match the dark tokens in globals.css (--bg #0a0a0a). Icon sizes are
 * the real pixel sizes of the files in public/ (logo.png is 605x592, not square).
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
      { src: "/apple-touch-icon.png", sizes: "180x180", type: "image/png" },
      { src: "/logo.png", sizes: "605x592", type: "image/png" },
    ],
  };
}
