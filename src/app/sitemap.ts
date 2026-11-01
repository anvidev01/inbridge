/**
 * app/sitemap.ts: served as /sitemap.xml
 * Top-level routes only. The per-scheme /services/<slug> pages are reachable
 * from /services and are deliberately not enumerated here.
 * No lastModified: we have no truthful per-page date to report.
 */
import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/site";

const ROUTES = ["/", "/chat", "/services", "/about", "/privacy", "/terms"];

export default function sitemap(): MetadataRoute.Sitemap {
  return ROUTES.map((path) => ({ url: path === "/" ? SITE_URL : `${SITE_URL}${path}` }));
}
