import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  serverExternalPackages: ["heic-convert", "tesseract.js", "sharp"],
  env: {
    // Sürüm derleme zamanında package.json'dan gömülür (tek kaynak).
    // npm_package_version env'ine bağlı değil; script dışı build'lerde de doğru çalışır.
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;