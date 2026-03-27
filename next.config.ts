import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  serverExternalPackages: ["faiss-node"],
  output: "standalone",
};

export default nextConfig;
