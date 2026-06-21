import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["heic-convert", "tesseract.js", "sharp"],
  env: {
    NEXT_PUBLIC_APP_VERSION: process.env.npm_package_version || "0.0.0",
  },
};

export default nextConfig;