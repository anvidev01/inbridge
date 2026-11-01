import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  // Native / large runtime packages are loaded from node_modules at runtime,
  // not bundled. The vector store runs on @huggingface/transformers, which
  // loads onnxruntime-node (native) and sharp.
  serverExternalPackages: ["faiss-node", "@huggingface/transformers", "onnxruntime-node", "sharp"],
  output: "standalone",
  // Vercel/Next tracing only bundles imported modules, not data directories
  // read at runtime via path.join(process.cwd(), ...). Force-include:
  //  - vector_store/: the FAISS index + docstore (read by src/lib/vector-search.ts)
  //  - models/: the embedding model, so Vercel never downloads it at runtime
  //  - onnxruntime's Linux x64 binary, which binding.js requires via a
  //    template-string path the tracer cannot follow
  outputFileTracingIncludes: {
    "/api/chat": [
      "./vector_store/**",
      "./models/**",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/**",
    ],
  },
  // Keep the function well under Vercel's 250 MB limit: Vercel runs linux/x64,
  // so drop onnxruntime binaries for every other platform and any GPU providers.
  outputFileTracingExcludes: {
    "/api/chat": [
      "./node_modules/onnxruntime-node/bin/napi-v3/darwin/**",
      "./node_modules/onnxruntime-node/bin/napi-v3/win32/**",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/arm64/**",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_cuda*",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_tensorrt*",
      "./node_modules/onnxruntime-web/**",
      "./node_modules/faiss-node/**",
    ],
  },
};

export default nextConfig;
