import type { NextConfig } from "next";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["heic-convert", "tesseract.js"],
};

export default nextConfig;