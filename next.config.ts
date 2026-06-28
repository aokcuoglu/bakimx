import type { NextConfig } from "next";
import pkg from "./package.json";

// tesseract.js spawns a Node worker thread that does dynamic require('..') +
// require('tesseract.js-core/...'). Next's standalone file tracer can't follow
// those dynamic requires, so the worker-script tree + core were missing from the
// prod image → "Cannot find module '..'" at runtime. Force the full packages into
// the trace for the OCR routes. global.fetch is used on Node 22 so node-fetch is
// unneeded, but included defensively.
const OCR_TRACE = [
  "./node_modules/tesseract.js/**/*",
  "./node_modules/tesseract.js-core/**/*",
  "./node_modules/bmp-js/**/*",
  "./node_modules/idb-keyval/**/*",
  "./node_modules/is-url/**/*",
  "./node_modules/wasm-feature-detect/**/*",
  "./node_modules/zlibjs/**/*",
  "./node_modules/regenerator-runtime/**/*",
  // Gömülü traineddata (process.cwd() ile runtime'da okunur; import edilmediği için
  // nft buraya bakmaz) — trace'e açıkça dahil et, böylece Dockerfile COPY gerekmez.
  "./ocr-assets/**/*",
]

const nextConfig: NextConfig = {
  output: "standalone",
  outputFileTracingIncludes: {
    "/api/plate/scan": OCR_TRACE,
    "/api/smart-capture/ocr": OCR_TRACE,
    "/api/smart-capture/confirm": OCR_TRACE,
  },
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