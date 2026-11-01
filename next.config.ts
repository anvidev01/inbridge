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
      // Only the four files the CPU runtime loads. Never the whole folder: on
      // Vercel's linux/x64 build machine onnxruntime-node's postinstall also
      // downloads CUDA provider libraries (hundreds of MB) into it, and an
      // include wins over the excludes below (that took api/chat to 437 MB).
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/onnxruntime_binding.node",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime.so.1",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime.so.1.21.0",
      "./node_modules/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_shared.so",
    ],
  },
  // Keep the function well under Vercel's 250 MB limit. Vercel runs
  // linux/x64. onnxruntime's binding.js requires its binary through a
  // process.platform template, so the tracer pulls in EVERY platform's
  // binaries (~210 MB) unless they are excluded. The "**/" patterns also catch
  // nested copies: a stale Vercel build cache once still held
  // @xenova/transformers with its own onnxruntime-node and pushed the
  // function to 467 MB.
  outputFileTracingExcludes: {
    "/api/chat": [
      "./node_modules/**/onnxruntime-node/bin/napi-v3/darwin/**",
      "./node_modules/**/onnxruntime-node/bin/napi-v3/win32/**",
      "./node_modules/**/onnxruntime-node/bin/napi-v3/linux/arm64/**",
      "./node_modules/**/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_cuda*",
      "./node_modules/**/onnxruntime-node/bin/napi-v3/linux/x64/libonnxruntime_providers_tensorrt*",
      "./node_modules/**/onnxruntime-node/bin/napi-v3/linux/x64/libcudnn*",
      "./node_modules/**/onnxruntime-node/bin/napi-v3/linux/x64/libcublas*",
      "./node_modules/**/onnxruntime-web/**",
      "./node_modules/@xenova/**",
      "./node_modules/tesseract.js*/**",
      "./node_modules/faiss-node/**",
      // sharp is only imported by transformers.js for image pipelines, which we never run.
      "./node_modules/**/@img/sharp-libvips-darwin*/**",
      "./node_modules/**/@img/sharp-libvips-linuxmusl*/**",
      "./node_modules/**/@img/sharp-linuxmusl*/**",
      "./node_modules/**/@img/sharp-win32*/**",
    ],
  },
};

export default nextConfig;
