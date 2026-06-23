// OpenCV.js (self-host /opencv/opencv.js) için idempotent, tek seferlik lazy-loader.
// Hazırlık durumu polling ile tespit edilir; load/onRuntimeInitialized yarış koşullarından etkilenmez.

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
const POLL_INTERVAL_MS = 50

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

    let settled = false
    // timeout/pollId are assigned before any async callback can fire; eslint-disable
    // is required because they must be declared before the finish closure that references them.
    // eslint-disable-next-line prefer-const
    let timeout: ReturnType<typeof setTimeout>
    // eslint-disable-next-line prefer-const
    let pollId: ReturnType<typeof setInterval>

    const finish = (fn: () => void) => {
      if (settled) return
      settled = true
      clearInterval(pollId)
      clearTimeout(timeout)
      fn()
    }

    timeout = setTimeout(
      () => finish(() => reject(new Error("OpenCV yüklenemedi (zaman aşımı)."))),
      LOAD_TIMEOUT_MS,
    )

    // Hazırlık durumunu polling ile izle — script load / onRuntimeInitialized yarış koşullarına karşı sağlam.
    pollId = setInterval(() => {
      if (isReady(window.cv)) finish(() => resolve(window.cv as OpenCvModule))
    }, POLL_INTERVAL_MS)

    // Betiği yalnızca bir kez enjekte et; hata durumunda hızlı başarısız ol.
    const existing = document.querySelector<HTMLScriptElement>(`script[src="${OPENCV_SRC}"]`)
    if (!existing) {
      const script = document.createElement("script")
      script.src = OPENCV_SRC
      script.async = true
      script.addEventListener(
        "error",
        () => finish(() => reject(new Error("OpenCV betiği yüklenemedi."))),
        { once: true },
      )
      document.body.appendChild(script)
    }
  })

  // Reddedilirse sonraki çağrı tekrar deneyebilsin.
  loaderPromise.catch(() => {
    loaderPromise = null
  })

  return loaderPromise
}
