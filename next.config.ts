import type { NextConfig } from "next";
import pkg from "./package.json";

const nextConfig: NextConfig = {
  output: "standalone",
  // Bu repo birden fazla git worktree ile kullanılıyor; her worktree'nin kendi
  // bun.lock'ı olduğu için Next yanlış kök dizini tahmin edip uyarı veriyordu.
  // Kökü config dosyasının bulunduğu dizine sabitliyoruz (worktree-safe).
  turbopack: {
    root: __dirname,
  },
  serverExternalPackages: ["heic-convert", "tesseract.js", "sharp"],
  env: {
    // Sürüm derleme zamanında package.json'dan gömülür (tek kaynak).
    // npm_package_version env'ine bağlı değil; script dışı build'lerde de doğru çalışır.
    NEXT_PUBLIC_APP_VERSION: pkg.version,
  },
};

export default nextConfig;