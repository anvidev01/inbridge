import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["faiss-node"],
  output: "standalone",
  // Vercel/Next tracing only bundles imported modules, not data directories
  // read at runtime via path.join(process.cwd(), "vector_store"). Without this
  // the /api/chat serverless function ships without the FAISS index, so
  // retrieval silently falls through to Tavily web search. Force-include it.
  outputFileTracingIncludes: {
    "/api/chat": ["./vector_store/**"],
  },
};

export default nextConfig;
