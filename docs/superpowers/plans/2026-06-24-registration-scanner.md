# Ruhsat Tarayıcı — Akıllı Belge Yakalama Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** `/smart-capture/registration` ekranına banka-tarzı canlı kamera + gerçek zamanlı ruhsat-kenarı tespiti + otomatik çekim + perspektif düzeltme ekleyip, düzleştirilmiş görseli mevcut OCR akışına beslemek.

**Architecture:** Yeni saf-mantık modülü (otomatik çekim kararı, birim-test edilir) + idempotent OpenCV.js lazy-loader + tam ekran `RegistrationScanner` client bileşeni (kamera/overlay/otomatik-çekim). Bileşen `smart-capture-registration.tsx`'e "Kamera ile Tara" girişiyle bağlanır; sunucu OCR/confirm uçları **değişmez**.

**Tech Stack:** Next 16 / React 19, TypeScript (strict), Tailwind v4, `jscanify` (npm, sürüm sabit) + self-host OpenCV.js 4.7.0 WASM, Bun test runner.

**Spec:** `docs/superpowers/specs/2026-06-23-registration-scanner-design.md`

**Branch:** Tüm iş `feat/registration-scanner` dalında yapılır (main'e commit edilmez).

## Global Constraints

- **Strict TS, `any` yok** (gerekçesiz). OpenCV/jscanify için **dar arayüzler / ambient declaration** kullan.
- **Tenant izolasyonu değişmez:** yeni sunucu veri yolu yok; tek güven sınırı mevcut `/api/smart-capture/*` (auth + workshop). Bu özellik tamamen client-side görüntü yakalamadır.
- **Sunucu sözleşmesi sabit:** `/api/smart-capture/ocr` ve `/api/smart-capture/confirm` **dokunulmaz**. Çıktı mevcut `handleFileSelected` üzerinden akar.
- **Mobile-first.** Tam ekran tarayıcı, dokunmatik hedefler ≥44px.
- **Yükleme durumları `BrandSpinner` ile** (`@/components/shared/brand-spinner`), skeleton değil.
- **OpenCV.js self-host:** runtime'da 3. parti CDN yok. Dosya: `public/opencv/opencv.js` → servis: `/opencv/opencv.js`. Sürüm **4.7.0**.
- **`jscanify` npm'den, `package.json`'da sürümü sabit.** Runtime'da `await import("jscanify")` (SSR'da window'a dokunmamak için).
- **Güvenli bağlam zorunlu:** `window.isSecureContext` + `navigator.mediaDevices.getUserMedia` yoksa → dosya yükleme fallback. (Dev `localhost`, prod `app.bakimx.com` HTTPS: ✓.)
- **DB/şema değişikliği yok.**
- **WASM bellek:** her karede oluşturulan `cv.Mat` nesneleri `.delete()` edilir; unmount'ta stream durdurulur.
- **Yerel geliştirmede Docker yok.**
- **Commit stili:** conventional commits (`feat:` …). Sık, küçük commitler.
- **Tunable sabitler (varsayılan):** `fillMin=0.55`, `edgeMargin=0.015`, `stableFrames=6`, `stabilityEps=6`, `sharpMin=100`, `countdownMs=600`, `detectIntervalMs=100`, `detectMaxWidth=480`, `captureLongEdge=1600`.

---

### Task 1: Bağımlılıklar + OpenCV.js self-host

**Files:**
- Modify: `package.json` (jscanify dependency — `bun add` ile)
- Create: `public/opencv/opencv.js` (~8 MB, self-host)
- Create (koşullu): `src/types/jscanify.d.ts` (jscanify tip bildirimi yoksa)

**Interfaces:**
- Produces: `/opencv/opencv.js` statik yolu (Task 3 `loadOpenCv` bunu enjekte eder); `jscanify` modülü (Task 5 dinamik import eder).

- [ ] **Step 1: Branch oluştur**

Run:
```bash
git checkout -b feat/registration-scanner
```

- [ ] **Step 2: jscanify ekle (sürüm sabit)**

Run:
```bash
bun add jscanify
```
Expected: `package.json` `dependencies`'e `"jscanify": "x.y.z"` (caret değil sabit istiyorsak kurulan sürümü `^` olmadan sabitle). Kurulumdan sonra `package.json`'da sürümü `^` kaldırarak sabitle.

- [ ] **Step 3: OpenCV.js 4.7.0 indir (self-host)**

Run:
```bash
mkdir -p public/opencv
curl -fSL https://docs.opencv.org/4.7.0/opencv.js -o public/opencv/opencv.js
ls -la public/opencv/opencv.js
```
Expected: Dosya boyutu > 5 MB (tipik ~8–9 MB). 4.7.0 build'i tek dosyadır (WASM gömülü). Boyut çok küçükse (HTML hata sayfası inmiş olabilir) indirmeyi tekrarla.

- [ ] **Step 4: jscanify tipini doğrula**

Run:
```bash
bun run typecheck
```
Eğer `Could not find a declaration file for module 'jscanify'` hatası gelirse, `src/types/jscanify.d.ts` oluştur:

```typescript
// jscanify resmi tip bildirimi sağlamıyorsa kullandığımız yüzeyi daraltıyoruz.
declare module "jscanify" {
  type JScanifyPoint = { x: number; y: number }
  export default class jscanify {
    constructor()
    highlightPaper(
      canvas: HTMLCanvasElement | HTMLImageElement,
      options?: { color?: string; thickness?: number },
    ): HTMLCanvasElement
    findPaperContour(img: unknown): unknown | null
    getCornerPoints(contour: unknown): {
      topLeftCorner: JScanifyPoint
      topRightCorner: JScanifyPoint
      bottomLeftCorner: JScanifyPoint
      bottomRightCorner: JScanifyPoint
    }
    extractPaper(
      image: HTMLCanvasElement | HTMLImageElement,
      resultWidth: number,
      resultHeight: number,
      cornerPoints?: unknown,
    ): HTMLCanvasElement
  }
}
```
(jscanify zaten tip sağlıyorsa bu dosyayı oluşturma.) Sonra tekrar `bun run typecheck` → PASS.

- [ ] **Step 5: Commit**

```bash
git add package.json bun.lock public/opencv/opencv.js src/types/jscanify.d.ts
git commit -m "feat: self-host opencv.js and add jscanify for registration scanner"
```
(`src/types/jscanify.d.ts` oluşmadıysa add listesinden çıkar.)

---

### Task 2: Otomatik çekim karar mantığı (saf, TDD)

**Files:**
- Create: `src/lib/ocr/document-detection.ts`
- Test: `src/lib/ocr/document-detection.test.ts`

**Interfaces:**
- Produces (Task 5 tüketir):
  - `type Point = { x: number; y: number }`
  - `type CornerPoints = { topLeftCorner: Point; topRightCorner: Point; bottomRightCorner: Point; bottomLeftCorner: Point }`
  - `type AutoCaptureConstants = { fillMin: number; edgeMargin: number; stableFrames: number; stabilityEps: number; sharpMin: number }`
  - `const DEFAULT_AUTO_CAPTURE: AutoCaptureConstants`
  - `type AutoCaptureInput = { corners: CornerPoints | null; frameWidth: number; frameHeight: number; history: CornerPoints[]; blurScore: number; constants?: AutoCaptureConstants }`
  - `type AutoCaptureResult = { ready: boolean; reason: AutoCaptureReason }` where `AutoCaptureReason = "ready" | "no-document" | "too-small" | "clipped" | "blurry" | "unstable"`
  - `function quadArea(c: CornerPoints): number`
  - `function fillRatio(c: CornerPoints, frameWidth: number, frameHeight: number): number`
  - `function isWithinBounds(c: CornerPoints, frameWidth: number, frameHeight: number, margin: number): boolean`
  - `function isStable(history: CornerPoints[], stableFrames: number, eps: number): boolean`
  - `function computeExtractSize(c: CornerPoints, longEdge: number): { width: number; height: number }`
  - `function shouldAutoCapture(input: AutoCaptureInput): AutoCaptureResult`

- [ ] **Step 1: Testleri yaz (failing)**

Create `src/lib/ocr/document-detection.test.ts`:

```typescript
import { expect, test, describe } from "bun:test"
import {
  quadArea,
  fillRatio,
  isWithinBounds,
  isStable,
  computeExtractSize,
  shouldAutoCapture,
  DEFAULT_AUTO_CAPTURE,
  type CornerPoints,
} from "@/lib/ocr/document-detection"

// Eksenlere hizalı dikdörtgen köşe seti üretici.
function rect(x: number, y: number, w: number, h: number): CornerPoints {
  return {
    topLeftCorner: { x, y },
    topRightCorner: { x: x + w, y },
    bottomRightCorner: { x: x + w, y: y + h },
    bottomLeftCorner: { x, y: y + h },
  }
}

describe("geometri", () => {
  test("quadArea birim dikdörtgeni doğru hesaplar", () => {
    expect(quadArea(rect(0, 0, 100, 50))).toBe(5000)
  })

  test("fillRatio = dörtgen alanı / kare alanı", () => {
    // 200x100 dörtgen, 400x200 kare => 20000 / 80000 = 0.25
    expect(fillRatio(rect(0, 0, 200, 100), 400, 200)).toBeCloseTo(0.25, 5)
  })

  test("isWithinBounds kenara yapışık dörtgeni reddeder", () => {
    // margin %1.5 => x ekseninde izinli alan [6, 394] (400 px)
    expect(isWithinBounds(rect(10, 10, 380, 180), 400, 200, 0.015)).toBe(true)
    expect(isWithinBounds(rect(0, 10, 380, 180), 400, 200, 0.015)).toBe(false) // sol kenar 0 < 6
  })

  test("computeExtractSize oranı korur ve uzun kenarı hedefe ölçekler", () => {
    const size = computeExtractSize(rect(0, 0, 300, 150), 1600)
    expect(size.width).toBe(1600)
    expect(size.height).toBe(800)
  })
})

describe("isStable", () => {
  const stable = Array.from({ length: 6 }, () => rect(10, 10, 380, 180))

  test("yeterli sabit kare varsa true", () => {
    expect(isStable(stable, 6, 6)).toBe(true)
  })

  test("yetersiz kare sayısında false", () => {
    expect(isStable(stable.slice(0, 3), 6, 6)).toBe(false)
  })

  test("son karelerde büyük hareket varsa false", () => {
    const jittery = [...stable.slice(0, 5), rect(40, 40, 380, 180)] // son kare 30px+ kaydı
    expect(isStable(jittery, 6, 6)).toBe(false)
  })
})

describe("shouldAutoCapture", () => {
  const frameW = 480
  const frameH = 300
  // Kareyi iyi dolduran, ortalanmış, kesilmemiş dörtgen.
  const good = rect(20, 15, 440, 270) // fill ~ (440*270)/(480*300)=0.825
  const goodHistory = Array.from({ length: 6 }, () => good)

  test("belge yoksa no-document", () => {
    const r = shouldAutoCapture({ corners: null, frameWidth: frameW, frameHeight: frameH, history: [], blurScore: 500 })
    expect(r).toEqual({ ready: false, reason: "no-document" })
  })

  test("küçük belge too-small", () => {
    const small = rect(20, 15, 150, 90) // fill ~0.09
    const r = shouldAutoCapture({ corners: small, frameWidth: frameW, frameHeight: frameH, history: Array(6).fill(small), blurScore: 500 })
    expect(r.reason).toBe("too-small")
    expect(r.ready).toBe(false)
  })

  test("kenara taşan belge clipped", () => {
    const clipped = rect(0, 15, 460, 270)
    const r = shouldAutoCapture({ corners: clipped, frameWidth: frameW, frameHeight: frameH, history: Array(6).fill(clipped), blurScore: 500 })
    expect(r.reason).toBe("clipped")
  })

  test("bulanık kare blurry", () => {
    const r = shouldAutoCapture({ corners: good, frameWidth: frameW, frameHeight: frameH, history: goodHistory, blurScore: 10 })
    expect(r.reason).toBe("blurry")
  })

  test("oynak kare unstable", () => {
    const jittery = [...Array(5).fill(good), rect(60, 50, 440, 270)]
    const r = shouldAutoCapture({ corners: good, frameWidth: frameW, frameHeight: frameH, history: jittery, blurScore: 500 })
    expect(r.reason).toBe("unstable")
  })

  test("tüm koşullar sağlanınca ready", () => {
    const r = shouldAutoCapture({ corners: good, frameWidth: frameW, frameHeight: frameH, history: goodHistory, blurScore: 500 })
    expect(r).toEqual({ ready: true, reason: "ready" })
  })

  test("DEFAULT_AUTO_CAPTURE beklenen eşikleri taşır", () => {
    expect(DEFAULT_AUTO_CAPTURE.fillMin).toBe(0.55)
    expect(DEFAULT_AUTO_CAPTURE.stableFrames).toBe(6)
  })
})
```

- [ ] **Step 2: Testleri çalıştır → FAIL**

Run:
```bash
bun test src/lib/ocr/document-detection.test.ts
```
Expected: FAIL — `document-detection` modülü/exportları yok.

- [ ] **Step 3: Modülü uygula**

Create `src/lib/ocr/document-detection.ts`:

```typescript
// Ruhsat tarayıcı için saf, DOM/CV bağımsız karar mantığı.
// jscanify getCornerPoints çıktısıyla aynı köşe adlarını kullanır.

export type Point = { x: number; y: number }

export type CornerPoints = {
  topLeftCorner: Point
  topRightCorner: Point
  bottomRightCorner: Point
  bottomLeftCorner: Point
}

export type AutoCaptureConstants = {
  fillMin: number
  edgeMargin: number
  stableFrames: number
  stabilityEps: number
  sharpMin: number
}

export const DEFAULT_AUTO_CAPTURE: AutoCaptureConstants = {
  fillMin: 0.55,
  edgeMargin: 0.015,
  stableFrames: 6,
  stabilityEps: 6,
  sharpMin: 100,
}

export type AutoCaptureReason =
  | "ready"
  | "no-document"
  | "too-small"
  | "clipped"
  | "blurry"
  | "unstable"

export type AutoCaptureResult = { ready: boolean; reason: AutoCaptureReason }

export type AutoCaptureInput = {
  corners: CornerPoints | null
  frameWidth: number
  frameHeight: number
  history: CornerPoints[]
  blurScore: number
  constants?: AutoCaptureConstants
}

function cornerArray(c: CornerPoints): Point[] {
  return [c.topLeftCorner, c.topRightCorner, c.bottomRightCorner, c.bottomLeftCorner]
}

function dist(a: Point, b: Point): number {
  return Math.hypot(a.x - b.x, a.y - b.y)
}

// Shoelace formülü (TL -> TR -> BR -> BL sırası).
export function quadArea(c: CornerPoints): number {
  const pts = cornerArray(c)
  let sum = 0
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i]
    const q = pts[(i + 1) % pts.length]
    sum += p.x * q.y - q.x * p.y
  }
  return Math.abs(sum) / 2
}

export function fillRatio(c: CornerPoints, frameWidth: number, frameHeight: number): number {
  if (frameWidth <= 0 || frameHeight <= 0) return 0
  return quadArea(c) / (frameWidth * frameHeight)
}

export function isWithinBounds(
  c: CornerPoints,
  frameWidth: number,
  frameHeight: number,
  margin: number,
): boolean {
  const minX = frameWidth * margin
  const maxX = frameWidth * (1 - margin)
  const minY = frameHeight * margin
  const maxY = frameHeight * (1 - margin)
  return cornerArray(c).every(
    (p) => p.x >= minX && p.x <= maxX && p.y >= minY && p.y <= maxY,
  )
}

function maxCornerMovement(a: CornerPoints, b: CornerPoints): number {
  const pa = cornerArray(a)
  const pb = cornerArray(b)
  let max = 0
  for (let i = 0; i < pa.length; i++) {
    max = Math.max(max, dist(pa[i], pb[i]))
  }
  return max
}

// Son `stableFrames` karede ardışık köşe hareketi `eps` pikselden azsa kararlı.
export function isStable(history: CornerPoints[], stableFrames: number, eps: number): boolean {
  if (history.length < stableFrames) return false
  const recent = history.slice(history.length - stableFrames)
  for (let i = 1; i < recent.length; i++) {
    if (maxCornerMovement(recent[i - 1], recent[i]) >= eps) return false
  }
  return true
}

// Tespit edilen dörtgenin gerçek oranını koruyarak uzun kenarı `longEdge`'e ölçekler.
export function computeExtractSize(c: CornerPoints, longEdge: number): { width: number; height: number } {
  const topW = dist(c.topLeftCorner, c.topRightCorner)
  const bottomW = dist(c.bottomLeftCorner, c.bottomRightCorner)
  const leftH = dist(c.topLeftCorner, c.bottomLeftCorner)
  const rightH = dist(c.topRightCorner, c.bottomRightCorner)
  const w = (topW + bottomW) / 2
  const h = (leftH + rightH) / 2
  if (w <= 0 || h <= 0) return { width: longEdge, height: longEdge }
  const scale = longEdge / Math.max(w, h)
  return { width: Math.round(w * scale), height: Math.round(h * scale) }
}

export function shouldAutoCapture(input: AutoCaptureInput): AutoCaptureResult {
  const k = input.constants ?? DEFAULT_AUTO_CAPTURE
  const { corners, frameWidth, frameHeight, history, blurScore } = input

  if (!corners) return { ready: false, reason: "no-document" }
  if (fillRatio(corners, frameWidth, frameHeight) < k.fillMin) {
    return { ready: false, reason: "too-small" }
  }
  if (!isWithinBounds(corners, frameWidth, frameHeight, k.edgeMargin)) {
    return { ready: false, reason: "clipped" }
  }
  if (blurScore < k.sharpMin) return { ready: false, reason: "blurry" }
  if (!isStable(history, k.stableFrames, k.stabilityEps)) {
    return { ready: false, reason: "unstable" }
  }
  return { ready: true, reason: "ready" }
}
```

- [ ] **Step 4: Testleri çalıştır → PASS**

Run:
```bash
bun test src/lib/ocr/document-detection.test.ts
```
Expected: PASS (tüm testler yeşil).

- [ ] **Step 5: typecheck + lint**

Run:
```bash
bun run typecheck && bun run lint
```
Expected: hatasız.

- [ ] **Step 6: Commit**

```bash
git add src/lib/ocr/document-detection.ts src/lib/ocr/document-detection.test.ts
git commit -m "feat: add pure auto-capture decision logic for registration scanner"
```

---

### Task 3: OpenCV.js lazy-loader (idempotent singleton)

**Files:**
- Create: `src/lib/ocr/opencv-loader.ts`

**Interfaces:**
- Consumes: `/opencv/opencv.js` (Task 1).
- Produces (Task 5 tüketir):
  - `interface OpenCvMat { delete(): void }`
  - `interface OpenCvModule { imread(...): OpenCvMat; cvtColor(...): void; Laplacian(...): void; meanStdDev(...): void; Mat: new () => OpenCvMat; COLOR_RGBA2GRAY: number; CV_64F: number; onRuntimeInitialized?: () => void }`
  - `function loadOpenCv(): Promise<OpenCvModule>`

- [ ] **Step 1: Loader'ı uygula**

Create `src/lib/ocr/opencv-loader.ts`:

```typescript
// OpenCV.js (self-host /opencv/opencv.js) için idempotent, tek seferlik lazy-loader.
// docs.opencv.org 4.x build'i global `cv` sunar ve hazır olunca cv.onRuntimeInitialized çağırır.

export interface OpenCvMat {
  delete(): void
}

export interface OpenCvModule {
  imread(source: HTMLCanvasElement | HTMLImageElement | string): OpenCvMat
  cvtColor(src: OpenCvMat, dst: OpenCvMat, code: number): void
  Laplacian(src: OpenCvMat, dst: OpenCvMat, ddepth: number): void
  meanStdDev(src: OpenCvMat, mean: OpenCvMat, stddev: OpenCvMat): void
  Mat: new () => OpenCvMat & { doubleAt(row: number, col: number): number }
  COLOR_RGBA2GRAY: number
  CV_64F: number
  onRuntimeInitialized?: () => void
}

declare global {
  interface Window {
    cv?: OpenCvModule
  }
}

const OPENCV_SRC = "/opencv/opencv.js"
const LOAD_TIMEOUT_MS = 30_000

let loaderPromise: Promise<OpenCvModule> | null = null

function isReady(mod: OpenCvModule | undefined): mod is OpenCvModule {
  return !!mod && typeof mod.imread === "function"
}

export function loadOpenCv(): Promise<OpenCvModule> {
  if (loaderPromise) return loaderPromise

  loaderPromise = new Promise<OpenCvModule>((resolve, reject) => {
    if (typeof window === "undefined" || typeof document === "undefined") {
      reject(new Error("OpenCV yalnızca tarayıcıda yüklenebilir."))
      return
    }

    if (isReady(window.cv)) {
      resolve(window.cv)
      return
    }

    const timeout = setTimeout(() => {
      reject(new Error("OpenCV yüklenemedi (zaman aşımı)."))
    }, LOAD_TIMEOUT_MS)

    const settleReady = () => {
      const mod = window.cv
      if (isReady(mod)) {
        clearTimeout(timeout)
        resolve(mod)
        return true
      }
      return false
    }

    const wireRuntime = () => {
      if (settleReady()) return
      const mod = window.cv
      if (mod) {
        // WASM henüz init olmadıysa runtime callback'ine bağlan.
        mod.onRuntimeInitialized = () => settleReady()
      }
    }

    const existing = document.querySelector<HTMLScriptElement>(`script[src="${OPENCV_SRC}"]`)
    if (existing) {
      if (window.cv) wireRuntime()
      else existing.addEventListener("load", wireRuntime, { once: true })
      return
    }

    const script = document.createElement("script")
    script.src = OPENCV_SRC
    script.async = true
    script.addEventListener("load", wireRuntime, { once: true })
    script.addEventListener("error", () => {
      clearTimeout(timeout)
      reject(new Error("OpenCV betiği yüklenemedi."))
    }, { once: true })
    document.body.appendChild(script)
  })

  // Reddedilirse sonraki çağrı tekrar deneyebilsin.
  loaderPromise.catch(() => {
    loaderPromise = null
  })

  return loaderPromise
}
```

- [ ] **Step 2: typecheck + lint**

Run:
```bash
bun run typecheck && bun run lint
```
Expected: hatasız.

- [ ] **Step 3: Commit**

```bash
git add src/lib/ocr/opencv-loader.ts
git commit -m "feat: add idempotent self-hosted opencv.js loader"
```

> **Not (manuel doğrulama Task 5/7'de):** `loadOpenCv` tarayıcı/WASM gerektirdiği için Bun'da birim test edilmez; gerçek doğrulama tarayıcıda (Task 5 sonrası) yapılır.

---

### Task 4: RegistrationScanner — kamera iskeleti + manuel çekim

**Files:**
- Create: `src/components/app/registration-scanner.tsx`

**Interfaces:**
- Produces (Task 6 tüketir): `function RegistrationScanner(props: { onCapture: (file: File) => void; onClose: () => void }): JSX.Element`
- Bu görevde **OpenCV/jscanify kullanılmaz**; yalnızca getUserMedia + manuel tam-kare çekim + durum/temizlik. Akıllı tespit Task 5'te eklenir.

- [ ] **Step 1: Bileşeni oluştur (iskelet)**

Create `src/components/app/registration-scanner.tsx`:

```tsx
"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { Camera, X, Zap, ZapOff, RefreshCw, Check, AlertTriangle } from "lucide-react"

const CAPTURE_JPEG_QUALITY = 0.9

type ScannerStatus = "starting" | "ready" | "captured" | "denied" | "unsupported" | "error"

type Props = {
  onCapture: (file: File) => void
  onClose: () => void
}

// MediaTrackCapabilities/Constraints standart TS lib'inde torch içermez.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraints = MediaTrackConstraints & { advanced?: Array<{ torch?: boolean }> }

export function RegistrationScanner({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const [status, setStatus] = useState<ScannerStatus>("starting")
  const [errorMsg, setErrorMsg] = useState("")
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const capturedFileRef = useRef<File | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  // Kamerayı başlat.
  useEffect(() => {
    let cancelled = false

    async function start() {
      if (typeof window === "undefined" || !window.isSecureContext || !navigator.mediaDevices?.getUserMedia) {
        setStatus("unsupported")
        return
      }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({
          video: { facingMode: { ideal: "environment" }, width: { ideal: 1920 }, height: { ideal: 1080 } },
          audio: false,
        })
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          await video.play().catch(() => {})
        }
        const track = stream.getVideoTracks()[0]
        const caps = (track?.getCapabilities?.() ?? {}) as TorchCapabilities
        setTorchSupported(!!caps.torch)
        setStatus("ready")
      } catch (err) {
        if (cancelled) return
        const name = err instanceof DOMException ? err.name : ""
        if (name === "NotAllowedError" || name === "SecurityError") setStatus("denied")
        else {
          setStatus("error")
          setErrorMsg("Kamera başlatılamadı. Lütfen dosyadan yükleyin.")
        }
      }
    }

    start()
    return () => {
      cancelled = true
      stopStream()
    }
  }, [stopStream])

  const toggleTorch = useCallback(async () => {
    const track = streamRef.current?.getVideoTracks()[0]
    if (!track) return
    const next = !torchOn
    try {
      await track.applyConstraints({ advanced: [{ torch: next }] } as TorchConstraints)
      setTorchOn(next)
    } catch {
      // sessiz geç — bazı cihazlar torch'u reddeder
    }
  }, [torchOn])

  // Tam kareyi yakala (manuel; akıllı tespit Task 5'te override eder).
  const captureFullFrame = useCallback(() => {
    const video = videoRef.current
    const canvas = captureCanvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    finishCapture(canvas)
  }, [])

  // Verilen canvas'ı (tam kare ya da Task 5'te extractPaper çıktısı) File'a çevirip önizlemeye geç.
  const finishCapture = useCallback((canvas: HTMLCanvasElement) => {
    canvas.toBlob(
      (blob) => {
        if (!blob) {
          setStatus("error")
          setErrorMsg("Görüntü oluşturulamadı.")
          return
        }
        const file = new File([blob], "ruhsat-capture.jpg", { type: "image/jpeg" })
        capturedFileRef.current = file
        setCapturedUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev)
          return URL.createObjectURL(blob)
        })
        setStatus("captured")
      },
      "image/jpeg",
      CAPTURE_JPEG_QUALITY,
    )
  }, [])

  const retake = useCallback(() => {
    setCapturedUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return null
    })
    capturedFileRef.current = null
    setStatus("ready")
  }, [])

  const usePhoto = useCallback(() => {
    const file = capturedFileRef.current
    if (!file) return
    stopStream()
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    onCapture(file)
  }, [capturedUrl, onCapture, stopStream])

  const handleClose = useCallback(() => {
    stopStream()
    if (capturedUrl) URL.revokeObjectURL(capturedUrl)
    onClose()
  }, [capturedUrl, onClose, stopStream])

  const isFallback = status === "denied" || status === "unsupported" || status === "error"

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Üst bar */}
      <div className="flex items-center justify-between p-4 shrink-0">
        <button onClick={handleClose} className="flex size-11 items-center justify-center rounded-full bg-white/10" aria-label="Kapat">
          <X className="size-5" />
        </button>
        <span className="text-sm font-medium">Ruhsatı Tara</span>
        {torchSupported && status === "ready" ? (
          <button onClick={toggleTorch} className="flex size-11 items-center justify-center rounded-full bg-white/10" aria-label="Flaş">
            {torchOn ? <Zap className="size-5 text-warning" /> : <ZapOff className="size-5" />}
          </button>
        ) : (
          <span className="size-11" />
        )}
      </div>

      {/* Gövde */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 size-full object-cover ${status === "captured" || isFallback ? "hidden" : ""}`}
        />
        <canvas ref={captureCanvasRef} className="hidden" />

        {/* Rehber çerçeve (statik; Task 5'te tespit poligonu eklenir) */}
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className="aspect-[3/2] w-full max-w-2xl rounded-lg border-2 border-white/70" />
          </div>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <BrandSpinner size={56} label="Kamera hazırlanıyor…" className="text-white" />
          </div>
        )}

        {status === "ready" && (
          <p className="absolute inset-x-0 top-4 text-center text-sm text-white/90">
            Ruhsatı açıp çerçeveye yerleştirin
          </p>
        )}

        {/* Önizleme */}
        {status === "captured" && capturedUrl && (
          <div className="absolute inset-0 flex items-center justify-center bg-black p-4">
            <Image src={capturedUrl} alt="Çekilen ruhsat" width={1200} height={800} unoptimized className="max-h-full max-w-full rounded-lg object-contain" />
          </div>
        )}

        {/* Fallback */}
        {isFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="size-10 text-warning" />
            <p className="max-w-sm text-sm text-white/90">
              {status === "denied" && "Kamera izni verilmedi. Lütfen tarayıcı ayarlarından izin verin veya dosyadan yükleyin."}
              {status === "unsupported" && "Bu cihaz/tarayıcı canlı kamerayı desteklemiyor. Lütfen dosyadan yükleyin."}
              {status === "error" && (errorMsg || "Kamera açılamadı. Lütfen dosyadan yükleyin.")}
            </p>
            <Button variant="outline" onClick={handleClose} className="border-white/30 bg-white/10 text-white hover:bg-white/20">
              Dosyadan Yükle’ye dön
            </Button>
          </div>
        )}
      </div>

      {/* Alt kontroller */}
      <div className="flex items-center justify-center gap-6 p-6 shrink-0">
        {status === "ready" && (
          <button
            onClick={captureFullFrame}
            className="flex size-16 items-center justify-center rounded-full border-4 border-white bg-white/20 active:scale-95"
            aria-label="Çek"
          >
            <Camera className="size-7" />
          </button>
        )}
        {status === "captured" && (
          <>
            <Button variant="outline" onClick={retake} className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20">
              <RefreshCw className="size-4" />
              Tekrar çek
            </Button>
            <Button onClick={usePhoto} className="gap-2">
              <Check className="size-4" />
              Kullan
            </Button>
          </>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: typecheck + lint**

Run:
```bash
bun run typecheck && bun run lint
```
Expected: hatasız. (`useCallback` importunun `react`'tan geldiğini doğrula.)

- [ ] **Step 3: Manuel doğrulama (geçici geçiş)**

`smart-capture-registration.tsx` henüz bağlanmadı (Task 6). Geçici doğrulama için dev sunucusunu çalıştır ve bir test sayfasından mount etmek yerine, Task 6 sonrası tam akışta doğrulanacak. Şimdilik yalnızca derleme/lint yeterli.

Run:
```bash
bun run build
```
Expected: build başarılı (bileşen henüz hiçbir yerde import edilmediğinden tree-shake edilebilir; hata olmamalı).

- [ ] **Step 4: Commit**

```bash
git add src/components/app/registration-scanner.tsx
git commit -m "feat: add registration scanner camera scaffold with manual capture"
```

---

### Task 5: RegistrationScanner — akıllı tespit + otomatik çekim

**Files:**
- Modify: `src/components/app/registration-scanner.tsx`

**Interfaces:**
- Consumes: `loadOpenCv`, `OpenCvModule` (Task 3); `shouldAutoCapture`, `computeExtractSize`, `DEFAULT_AUTO_CAPTURE`, `CornerPoints` (Task 2); `jscanify` (Task 1, dinamik import).
- Produces: aynı `RegistrationScanner` prop sözleşmesi (değişmez); otomatik çekim davranışı eklenir.

- [ ] **Step 1: Importları ekle**

`registration-scanner.tsx` en üstteki import bloğuna ekle:

```tsx
import {
  shouldAutoCapture,
  computeExtractSize,
  DEFAULT_AUTO_CAPTURE,
  type CornerPoints,
} from "@/lib/ocr/document-detection"
import { loadOpenCv, type OpenCvModule } from "@/lib/ocr/opencv-loader"
```

- [ ] **Step 2: Sabitleri ve tespit ref'lerini ekle**

`CAPTURE_JPEG_QUALITY` sabitinin altına ekle:

```tsx
const DETECT_INTERVAL_MS = 100
const DETECT_MAX_WIDTH = 480
const CAPTURE_LONG_EDGE = 1600
const COUNTDOWN_MS = 600
const HISTORY_LEN = DEFAULT_AUTO_CAPTURE.stableFrames
```

`captureCanvasRef` tanımının altına yeni ref'ler ekle:

```tsx
  const detectCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const scannerRef = useRef<import("jscanify").default | null>(null)
  const cvRef = useRef<OpenCvModule | null>(null)
  const historyRef = useRef<CornerPoints[]>([])
  const lastCornersRef = useRef<CornerPoints | null>(null)
  const readySinceRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectingRef = useRef(false)
```

Ayrıca yeni durum: `status` tipine `"loading-cv"` ekle ve hizalama göstergesi için state:

```tsx
  const [aligned, setAligned] = useState(false)
```

`ScannerStatus` tipini güncelle:

```tsx
type ScannerStatus = "starting" | "loading-cv" | "ready" | "captured" | "denied" | "unsupported" | "error"
```

- [ ] **Step 3: Blur ölçümü + perspektif çekim yardımcılarını ekle**

`finishCapture` fonksiyonunun üstüne ekle:

```tsx
  // Gri tonlamada Laplacian varyansı (netlik skoru). Düşük = bulanık.
  const computeBlurScore = useCallback((cv: OpenCvModule, src: import("@/lib/ocr/opencv-loader").OpenCvMat): number => {
    const gray = new cv.Mat()
    const lap = new cv.Mat()
    const mean = new cv.Mat()
    const stddev = new cv.Mat()
    try {
      cv.cvtColor(src, gray, cv.COLOR_RGBA2GRAY)
      cv.Laplacian(gray, lap, cv.CV_64F)
      cv.meanStdDev(lap, mean, stddev)
      const sd = (stddev as unknown as { doubleAt(r: number, c: number): number }).doubleAt(0, 0)
      return sd * sd
    } finally {
      gray.delete()
      lap.delete()
      mean.delete()
      stddev.delete()
    }
  }, [])
```

- [ ] **Step 4: OpenCV + jscanify yükleme efektini ekle**

Kamera başlatma efektinin altına yeni bir efekt ekle (kamera `ready` olduğunda CV'yi yükler):

```tsx
  // Kamera hazır olunca OpenCV + jscanify'ı lazy-load et ve tespit döngüsünü başlat.
  useEffect(() => {
    if (status !== "ready") return
    let cancelled = false

    async function initCv() {
      try {
        const cv = await loadOpenCv()
        if (cancelled) return
        const { default: JScanify } = await import("jscanify")
        if (cancelled) return
        cvRef.current = cv
        scannerRef.current = new JScanify()
        startDetectLoop()
      } catch {
        // CV yüklenemezse: akıllı çekim yok, manuel çekim çalışmaya devam eder.
        if (!cancelled) setErrorMsg("Otomatik tespit yüklenemedi; manuel çekebilirsiniz.")
      }
    }

    initCv()
    return () => {
      cancelled = true
      if (rafRef.current !== null) {
        clearTimeout(rafRef.current)
        rafRef.current = null
      }
      detectingRef.current = false
    }
    // startDetectLoop kasıtlı olarak bağımlılık dışı (ref tabanlı, kararlı).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])
```

- [ ] **Step 5: Tespit döngüsü + otomatik/akıllı çekimi ekle**

`captureFullFrame` fonksiyonunun altına ekle:

```tsx
  // Tek karelik tespit + çizim + otomatik-çekim değerlendirmesi.
  const detectTick = useCallback(() => {
    const cv = cvRef.current
    const scanner = scannerRef.current
    const video = videoRef.current
    const detect = detectCanvasRef.current
    const overlay = overlayCanvasRef.current
    if (!cv || !scanner || !video || !detect || !overlay || !video.videoWidth) return

    // Küçültülmüş tespit karesi.
    const scale = DETECT_MAX_WIDTH / video.videoWidth
    const dw = DETECT_MAX_WIDTH
    const dh = Math.round(video.videoHeight * scale)
    detect.width = dw
    detect.height = dh
    const dctx = detect.getContext("2d")
    if (!dctx) return
    dctx.drawImage(video, 0, 0, dw, dh)

    let corners: CornerPoints | null = null
    let blurScore = 0
    const src = cv.imread(detect)
    try {
      blurScore = computeBlurScore(cv, src)
      const contour = scanner.findPaperContour(src) as { delete?: () => void } | null
      if (contour) {
        try {
          corners = scanner.getCornerPoints(contour) as CornerPoints
        } catch {
          corners = null
        }
        contour.delete?.()
      }
    } finally {
      src.delete()
    }

    // Geçmişi güncelle.
    if (corners) {
      historyRef.current = [...historyRef.current, corners].slice(-HISTORY_LEN)
      lastCornersRef.current = corners
    } else {
      historyRef.current = []
      lastCornersRef.current = null
    }

    // Karar.
    const decision = shouldAutoCapture({
      corners,
      frameWidth: dw,
      frameHeight: dh,
      history: historyRef.current,
      blurScore,
    })
    setAligned(decision.ready)

    // Overlay çizimi (görüntü boyutuna ölçekle).
    drawOverlay(overlay, video, corners, dw, dh, decision.ready)

    // Otomatik çekim: hazır durum COUNTDOWN_MS sürerse çek.
    const now = performance.now()
    if (decision.ready) {
      if (readySinceRef.current === null) readySinceRef.current = now
      else if (now - readySinceRef.current >= COUNTDOWN_MS) {
        captureSmart()
        return // döngü captureSmart içinde durur
      }
    } else {
      readySinceRef.current = null
    }
  }, [computeBlurScore])

  const startDetectLoop = useCallback(() => {
    if (detectingRef.current) return
    detectingRef.current = true
    const loop = () => {
      if (!detectingRef.current) return
      detectTick()
      rafRef.current = window.setTimeout(loop, DETECT_INTERVAL_MS)
    }
    loop()
  }, [detectTick])

  const stopDetectLoop = useCallback(() => {
    detectingRef.current = false
    if (rafRef.current !== null) {
      clearTimeout(rafRef.current)
      rafRef.current = null
    }
  }, [])

  // Tespit edilen köşelerden kendi poligonumuzu çiz (renk: yeşil=hazır, beyaz=arama).
  const drawOverlay = useCallback(
    (overlay: HTMLCanvasElement, video: HTMLVideoElement, corners: CornerPoints | null, dw: number, dh: number, ready: boolean) => {
      const rect = video.getBoundingClientRect()
      overlay.width = rect.width
      overlay.height = rect.height
      const ctx = overlay.getContext("2d")
      if (!ctx) return
      ctx.clearRect(0, 0, overlay.width, overlay.height)
      if (!corners) return
      // object-cover ölçeği: video kareyi kaplar → en büyük ölçek.
      const coverScale = Math.max(overlay.width / dw, overlay.height / dh)
      const offX = (overlay.width - dw * coverScale) / 2
      const offY = (overlay.height - dh * coverScale) / 2
      const map = (p: { x: number; y: number }) => ({ x: p.x * coverScale + offX, y: p.y * coverScale + offY })
      const tl = map(corners.topLeftCorner)
      const tr = map(corners.topRightCorner)
      const br = map(corners.bottomRightCorner)
      const bl = map(corners.bottomLeftCorner)
      ctx.beginPath()
      ctx.moveTo(tl.x, tl.y)
      ctx.lineTo(tr.x, tr.y)
      ctx.lineTo(br.x, br.y)
      ctx.lineTo(bl.x, bl.y)
      ctx.closePath()
      ctx.lineWidth = 4
      ctx.strokeStyle = ready ? "#22c55e" : "rgba(255,255,255,0.9)"
      ctx.fillStyle = ready ? "rgba(34,197,94,0.15)" : "rgba(255,255,255,0.08)"
      ctx.fill()
      ctx.stroke()
    },
    [],
  )

  // Akıllı çekim: tam çözünürlükte kareyi extractPaper ile düzleştir.
  const captureSmart = useCallback(() => {
    const cv = cvRef.current
    const scanner = scannerRef.current
    const video = videoRef.current
    const capture = captureCanvasRef.current
    const corners = lastCornersRef.current
    if (!cv || !scanner || !video || !capture || !corners) return
    stopDetectLoop()

    capture.width = video.videoWidth
    capture.height = video.videoHeight
    const cctx = capture.getContext("2d")
    if (!cctx) return
    cctx.drawImage(video, 0, 0, capture.width, capture.height)

    const { width, height } = computeExtractSize(corners, CAPTURE_LONG_EDGE)
    try {
      const extracted = scanner.extractPaper(capture, width, height)
      finishCapture(extracted)
    } catch {
      // extractPaper başarısız olursa tam kareye düş.
      finishCapture(capture)
    }
  }, [finishCapture, stopDetectLoop])
```

- [ ] **Step 6: `captureFullFrame`'i akıllı manuel davranışla güncelle**

Mevcut `captureFullFrame` fonksiyonunun gövdesini, tespit varsa extractPaper kullanacak şekilde değiştir:

```tsx
  // Manuel çekim: geçerli belge tespiti varsa düzleştirilmiş, yoksa tam kare.
  const captureFullFrame = useCallback(() => {
    if (lastCornersRef.current && cvRef.current && scannerRef.current) {
      captureSmart()
      return
    }
    const video = videoRef.current
    const canvas = captureCanvasRef.current
    if (!video || !canvas || !video.videoWidth) return
    canvas.width = video.videoWidth
    canvas.height = video.videoHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height)
    finishCapture(canvas)
  }, [captureSmart, finishCapture])
```

- [ ] **Step 7: `retake` ve `stopStream`'e döngü temizliğini bağla**

`retake` içinde, `setStatus("ready")` öncesine ekle (tekrar çekimde tespit yeniden başlar):

```tsx
    historyRef.current = []
    lastCornersRef.current = null
    readySinceRef.current = null
    setAligned(false)
    if (cvRef.current && scannerRef.current) startDetectLoop()
```

`stopStream` içinde, stream durdurmadan önce `stopDetectLoop()` çağır:

```tsx
  const stopStream = useCallback(() => {
    stopDetectLoop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [stopDetectLoop])
```

- [ ] **Step 8: JSX'e overlay canvas, gizli detect canvas ve hizalama ipucunu ekle**

Gövde bölümünde `<canvas ref={captureCanvasRef} className="hidden" />` satırının altına ekle:

```tsx
        <canvas ref={detectCanvasRef} className="hidden" />
        {(status === "ready") && (
          <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 size-full" />
        )}
```

Talimat metnini hizalama durumuna göre güncelle (mevcut "Ruhsatı açıp çerçeveye yerleştirin" paragrafını değiştir):

```tsx
        {status === "ready" && (
          <p className={`absolute inset-x-0 top-4 text-center text-sm font-medium ${aligned ? "text-green-400" : "text-white/90"}`}>
            {aligned ? "Sabit tutun…" : "Ruhsatı açıp çerçeveye yerleştirin"}
          </p>
        )}
```

Rehber çerçevenin rengini hizalamaya göre değiştir (statik çerçeve div'i):

```tsx
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div className={`aspect-[3/2] w-full max-w-2xl rounded-lg border-2 transition-colors ${aligned ? "border-green-500" : "border-white/70"}`} />
          </div>
        )}
```

- [ ] **Step 9: typecheck + lint + test + build**

Run:
```bash
bun run typecheck && bun run lint && bun test && bun run build
```
Expected: hepsi yeşil. `any` uyarısı yok (jscanify/cv dar tiplerle).

- [ ] **Step 10: Commit**

```bash
git add src/components/app/registration-scanner.tsx
git commit -m "feat: add real-time document detection and auto-capture to scanner"
```

---

### Task 6: Ruhsat ekranına "Kamera ile Tara" girişini bağla

**Files:**
- Modify: `src/components/app/smart-capture-registration.tsx`

**Interfaces:**
- Consumes: `RegistrationScanner` (Task 4/5); mevcut `handleFileSelected` (aynı dosyada).

- [ ] **Step 1: Import ve state ekle**

`smart-capture-registration.tsx` üst importlara ekle:

```tsx
import { RegistrationScanner } from "@/components/app/registration-scanner"
```

`lucide-react` importuna `ScanLine` zaten var; `Camera` zaten var. Bileşen gövdesinde diğer `useState`'lerin yanına ekle:

```tsx
  const [scannerOpen, setScannerOpen] = useState(false)
```

- [ ] **Step 2: Scanner'ı render et (tam ekran, en üstte)**

`return` edilen `upload` ekranının (en alttaki `return (<div className="space-y-5">…`) hemen içine, ilk child olarak ekle:

```tsx
      {scannerOpen && (
        <RegistrationScanner
          onCapture={(file) => {
            setScannerOpen(false)
            handleFileSelected(file)
          }}
          onClose={() => setScannerOpen(false)}
        />
      )}
```

- [ ] **Step 3: "Kamera ile Tara" birincil butonunu ekle**

Upload kartında, mevcut "Fotoğraf çekin veya yükleyin" sürükle-bırak alanının **üstüne** birincil aksiyon ekle. `<div className="flex flex-col items-center gap-4 text-center" …>` içindeki ilk child olarak:

```tsx
            <Button
              type="button"
              size="lg"
              className="h-12 w-full max-w-md gap-2 text-base"
              onClick={() => setScannerOpen(true)}
            >
              <Camera className="size-5" />
              Kamera ile Tara
            </Button>
            <div className="flex items-center gap-3 w-full max-w-md">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground/70">veya dosyadan</span>
              <div className="flex-1 h-px bg-border" />
            </div>
```

(Mevcut sürükle-bırak alanı ve "Dosyadan Yükle" butonu **fallback olarak korunur.**)

- [ ] **Step 4: Bilgilendirme metnini güncelle**

"Bilgilendirme" kartındaki ilk maddeyi, kamera akışını yansıtacak şekilde güncelle:

```tsx
          <div className="flex items-start gap-2">
            <ScanLine className="size-4 text-muted-foreground/70 mt-0.5 shrink-0" />
            <span>Kamera ile tarayın: ruhsat otomatik algılanıp çerçeveye oturunca çekilir. Dilerseniz dosyadan da yükleyebilirsiniz.</span>
          </div>
```

- [ ] **Step 5: typecheck + lint + build**

Run:
```bash
bun run typecheck && bun run lint && bun run build
```
Expected: hepsi yeşil.

- [ ] **Step 6: Commit**

```bash
git add src/components/app/smart-capture-registration.tsx
git commit -m "feat: add camera scan entry to registration capture screen"
```

---

### Task 7: Tam doğrulama + manuel QA

**Files:** (yok — doğrulama)

- [ ] **Step 1: Tüm kontroller**

Run:
```bash
bun run typecheck && bun run lint && bun test && bun run build
```
Expected: hepsi yeşil.

- [ ] **Step 2: Manuel QA (dev, HTTPS/localhost)**

Run:
```bash
bun run dev
```
`http://localhost:3000/smart-capture/registration` adresinde doğrula:
- [ ] "Kamera ile Tara" → izin istenir; verilince canlı görüntü gelir, BrandSpinner "Kamera hazırlanıyor…" sonra kaybolur.
- [ ] Örnek ruhsatı (açık iki sayfa) çerçeveye getir → kenar poligonu çizilir; doldurup sabit tutunca **yeşile** döner, "Sabit tutun…" → ~0.6 sn sonra otomatik çeker.
- [ ] Önizlemede düzleştirilmiş/kırpılmış görüntü görünür; "Kullan" → mevcut OCR akışı (processing → confirm) çalışır, alanlar okunur.
- [ ] "Tekrar çek" taramaya döner.
- [ ] Manuel deklanşör: belge yokken tam kare; belge varken düzleştirilmiş çeker.
- [ ] Torch düğmesi (destekleyen cihazda) açık/kapalı çalışır.
- [ ] **Fallback:** izni reddet → "Dosyadan Yükle’ye dön" mesajı; "Dosyadan Yükle" akışı eskisi gibi çalışır.
- [ ] Masaüstü/kamerasız tarayıcı → "unsupported" mesajı + dosya yükleme.
- [ ] Tarayıcıyı kapat (X) → kamera ışığı söner (stream durur), sayfaya dönülür.
- [ ] Performans: tarayıcı birkaç dakika açık kalınca takılma/aşırı ısınma yok (Mat `.delete()` sızıntı yok).

- [ ] **Step 3: bakimx-release-check (öneri)**

Commit/PR öncesi `bakimx-release-check` skill'ini çalıştırıp build/lint/typecheck/env/QA özetini doğrula.

- [ ] **Step 4: Final commit (gerekirse) ve PR**

Kalan değişiklik yoksa atla. PR açılışını kullanıcıyla onayla (harness kuralı: commit/push yalnızca istenince).

---

## Self-Review (yazar kontrolü)

**1. Spec coverage:**
- Canlı kamera + overlay → Task 4 (iskelet) + Task 5 (tespit poligonu). ✓
- Gerçek zamanlı tespit + otomatik çekim → Task 5 (`detectTick`, `shouldAutoCapture`, `captureSmart`). ✓
- Perspektif düzeltme (extractPaper) → Task 5 `captureSmart` + `computeExtractSize`. ✓
- Manuel deklanşör + dosya fallback → Task 4 (manuel), Task 6 (dosya korunur), Task 4/5 fallback durumları. ✓
- Saf karar mantığı, birim test → Task 2 (TDD). ✓
- jscanify + self-host OpenCV lazy-load → Task 1 (deps), Task 3 (loader), Task 5 (kullanım). ✓
- Mevcut OCR/confirm değişmez → Task 6 yalnızca `handleFileSelected`'a File verir. ✓
- Hata/fallback zinciri, secure context → Task 4 (`unsupported`/`denied`/`error`), Task 5 (CV yüklenemezse manuel). ✓
- Performans (downscale, throttle, Mat delete, cleanup) → Task 5 `detectTick`/`computeBlurScore`/`stopStream`. ✓
- BrandSpinner, mobile-first → Task 4. ✓

**2. Placeholder scan:** "TBD/TODO" yok; her kod adımı tam içerik taşıyor. jscanify tip dosyası koşullu ama tam kod verildi. ✓

**3. Type consistency:** `CornerPoints` (TL/TR/BR/BL) Task 2'de tanımlı, Task 5'te aynı alan adlarıyla tüketiliyor; `loadOpenCv`/`OpenCvModule`/`OpenCvMat` Task 3↔Task 5 tutarlı; `RegistrationScanner` prop'ları Task 4↔Task 6 tutarlı; `shouldAutoCapture`/`computeExtractSize`/`DEFAULT_AUTO_CAPTURE` imzaları eşleşiyor. ✓
