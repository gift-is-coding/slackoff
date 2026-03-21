import path from "node:path";
import { fileURLToPath } from "node:url";
import type { NextConfig } from "next";

const currentDirectory = path.dirname(fileURLToPath(import.meta.url));

const nextConfig: NextConfig = {
  // Required for `docker build` — produces a self-contained server in .next/standalone.
  output: "standalone",
  turbopack: {
    root: currentDirectory,
  },
};

export default nextConfig;
