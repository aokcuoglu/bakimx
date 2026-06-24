"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { Camera, X, Zap, ZapOff, RefreshCw, Check, AlertTriangle } from "lucide-react"
import {
  shouldAutoCapture,
  computeExtractSize,
  DEFAULT_AUTO_CAPTURE,
  type CornerPoints,
} from "@/lib/ocr/document-detection"
import { loadOpenCv, type OpenCvModule, type OpenCvMat } from "@/lib/ocr/opencv-loader"

const CAPTURE_JPEG_QUALITY = 0.9
const DETECT_INTERVAL_MS = 100
const DETECT_MAX_WIDTH = 480
const CAPTURE_LONG_EDGE = 1600
const COUNTDOWN_MS = 600
const HISTORY_LEN = DEFAULT_AUTO_CAPTURE.stableFrames

type ScannerStatus = "starting" | "ready" | "captured" | "denied" | "unsupported" | "error"

// jscanify's getCornerPoints can RETURN (not throw) an object whose corners are
// undefined for degenerate contours → NaN downstream. Validate before use.
function isFiniteCorner(p: { x: number; y: number } | undefined): p is { x: number; y: number } {
  return !!p && Number.isFinite(p.x) && Number.isFinite(p.y)
}
function isValidCorners(c: CornerPoints | null): c is CornerPoints {
  return !!c && isFiniteCorner(c.topLeftCorner) && isFiniteCorner(c.topRightCorner)
    && isFiniteCorner(c.bottomRightCorner) && isFiniteCorner(c.bottomLeftCorner)
}

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
  const detectCanvasRef = useRef<HTMLCanvasElement>(null)
  const overlayCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)

  const scannerRef = useRef<import("@/lib/ocr/vendor/jscanify").default | null>(null)
  const cvRef = useRef<OpenCvModule | null>(null)
  const historyRef = useRef<CornerPoints[]>([])
  const lastCornersRef = useRef<CornerPoints | null>(null)
  const readySinceRef = useRef<number | null>(null)
  const rafRef = useRef<number | null>(null)
  const detectingRef = useRef(false)

  const capturedRef = useRef<{ file: File; url: string } | null>(null)
  const mountedRef = useRef(true)

  const [status, setStatus] = useState<ScannerStatus>("starting")
  const [errorMsg, setErrorMsg] = useState("")
  const [cvFailed, setCvFailed] = useState(false)
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  const [aligned, setAligned] = useState(false)

  useEffect(() => {
    return () => {
      mountedRef.current = false
      if (capturedRef.current) {
        URL.revokeObjectURL(capturedRef.current.url)
        capturedRef.current = null
      }
    }
  }, [])

  const stopDetectLoop = useCallback(() => {
    detectingRef.current = false
    if (rafRef.current !== null) {
      clearTimeout(rafRef.current)
      rafRef.current = null
    }
  }, [])

  const stopStream = useCallback(() => {
    stopDetectLoop()
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [stopDetectLoop])

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

  // Verilen canvas'ı (tam kare ya da extractPaper çıktısı) File'a çevirip önizlemeye geç.
  const finishCapture = useCallback((canvas: HTMLCanvasElement) => {
    canvas.toBlob(
      (blob) => {
        if (!mountedRef.current) return
        if (!blob) {
          setStatus("error")
          setErrorMsg("Görüntü oluşturulamadı.")
          return
        }
        if (capturedRef.current) {
          URL.revokeObjectURL(capturedRef.current.url)
        }
        const url = URL.createObjectURL(blob)
        capturedRef.current = { file: new File([blob], "ruhsat-capture.jpg", { type: "image/jpeg" }), url }
        setCapturedUrl(url)
        setStatus("captured")
      },
      "image/jpeg",
      CAPTURE_JPEG_QUALITY,
    )
  }, [])

  // Gri tonlamada Laplacian varyansı (netlik skoru). Düşük = bulanık.
  const computeBlurScore = useCallback((cv: OpenCvModule, src: OpenCvMat): number => {
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

  // Tespit edilen köşelerden kendi poligonumuzu çiz (renk: yeşil=hazır, beyaz=arama).
  const drawOverlay = useCallback(
    (
      overlay: HTMLCanvasElement,
      video: HTMLVideoElement,
      corners: CornerPoints | null,
      dw: number,
      dh: number,
      ready: boolean,
    ) => {
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

    // Çıktı boyutları küçültülmüş köşelerden hesaplanır (oran-bağımsız, ölçek-değişmez).
    const { width, height } = computeExtractSize(corners, CAPTURE_LONG_EDGE)
    // Köşeleri tam çözünürlüğe ölçekle ve extractPaper'a ver: yeşil overlay'in
    // gösterdiği AYNI köşelerden warp edilir (gereksiz tam-çöz. yeniden tespit + leak yok).
    const cornerScale = capture.width / DETECT_MAX_WIDTH
    const scalePoint = (p: { x: number; y: number }) => ({ x: p.x * cornerScale, y: p.y * cornerScale })
    const fullResCorners = {
      topLeftCorner: scalePoint(corners.topLeftCorner),
      topRightCorner: scalePoint(corners.topRightCorner),
      bottomLeftCorner: scalePoint(corners.bottomLeftCorner),
      bottomRightCorner: scalePoint(corners.bottomRightCorner),
    }
    try {
      const extracted = scanner.extractPaper(capture, width, height, fullResCorners)
      finishCapture(extracted)
    } catch {
      // extractPaper başarısız olursa tam kareye düş.
      finishCapture(capture)
    }
  }, [finishCapture, stopDetectLoop])

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
          // Dejenere konturlarda köşeler undefined/NaN dönebilir → geçersizse at.
          if (!isValidCorners(corners)) corners = null
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
    if (mountedRef.current) setAligned(decision.ready)

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
  }, [computeBlurScore, drawOverlay, captureSmart])

  const startDetectLoop = useCallback(() => {
    if (detectingRef.current) return
    detectingRef.current = true
    const loop = () => {
      if (!detectingRef.current) return
      // Tek karelik bir OpenCV hatası döngüyü kalıcı olarak durdurmasın; bir sonraki kareyi dene.
      try {
        detectTick()
      } catch {
        // sessiz geç — geçici kare hatası
      }
      // captureSmart, detectTick içinde döngüyü durdurabilir; durdurulduysa devam etme.
      if (!detectingRef.current) return
      rafRef.current = window.setTimeout(loop, DETECT_INTERVAL_MS)
    }
    loop()
  }, [detectTick])

  // Kamera hazır olunca OpenCV + jscanify'ı lazy-load et ve tespit döngüsünü başlat.
  useEffect(() => {
    if (status !== "ready") return
    // Zaten yüklenmişse (örn. retake sonrası tekrar "ready"): döngüyü yeniden başlat.
    if (cvRef.current && scannerRef.current) {
      startDetectLoop()
      return
    }
    let cancelled = false

    async function initCv() {
      try {
        const cv = await loadOpenCv()
        if (cancelled) return
        const { default: JScanify } = await import("@/lib/ocr/vendor/jscanify")
        if (cancelled) return
        cvRef.current = cv
        scannerRef.current = new JScanify()
        startDetectLoop()
      } catch {
        // CV yüklenemezse: akıllı çekim yok, manuel çekim çalışmaya devam eder.
        if (!cancelled && mountedRef.current) {
          setErrorMsg("Otomatik tespit yüklenemedi; manuel çekebilirsiniz.")
          setCvFailed(true)
        }
      }
    }

    initCv()
    return () => {
      cancelled = true
      stopDetectLoop()
    }
    // startDetectLoop/stopDetectLoop kasıtlı olarak bağımlılık dışı (ref tabanlı, kararlı);
    // yalnızca status değişince çalışmalı, callback kimlikleri değişince değil.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [status])

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

  const retake = useCallback(() => {
    if (capturedRef.current) {
      URL.revokeObjectURL(capturedRef.current.url)
      capturedRef.current = null
    }
    setCapturedUrl(null)
    // Tespit durumunu sıfırla; döngü yalnızca CV yüklüyse yeniden başlar.
    historyRef.current = []
    lastCornersRef.current = null
    readySinceRef.current = null
    setAligned(false)
    setCvFailed(false)
    if (cvRef.current && scannerRef.current) startDetectLoop()
    setStatus("ready")
  }, [startDetectLoop])

  const usePhoto = useCallback(() => {
    const cap = capturedRef.current
    if (!cap) return
    stopStream()
    URL.revokeObjectURL(cap.url)
    capturedRef.current = null
    setCapturedUrl(null)
    onCapture(cap.file)
  }, [onCapture, stopStream])

  const handleClose = useCallback(() => {
    stopStream()
    if (capturedRef.current) {
      URL.revokeObjectURL(capturedRef.current.url)
      capturedRef.current = null
    }
    onClose()
  }, [onClose, stopStream])

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
        <canvas ref={detectCanvasRef} className="hidden" />
        {status === "ready" && (
          <canvas ref={overlayCanvasRef} className="pointer-events-none absolute inset-0 size-full" />
        )}

        {/* Rehber çerçeve (hizalamaya göre renk değişir; tespit poligonu overlay'de çizilir) */}
        {status === "ready" && (
          <div className="pointer-events-none absolute inset-0 flex items-center justify-center p-6">
            <div
              className={`aspect-[3/2] w-full max-w-2xl rounded-lg border-2 transition-colors ${aligned ? "border-green-500" : "border-white/70"}`}
            />
          </div>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <BrandSpinner size={56} label="Kamera hazırlanıyor…" className="text-white" />
          </div>
        )}

        {status === "ready" && (
          <p
            className={`absolute inset-x-0 top-4 text-center text-sm font-medium ${aligned ? "text-green-400" : "text-white/90"}`}
          >
            {aligned ? "Sabit tutun…" : "Ruhsatı açıp çerçeveye yerleştirin"}
          </p>
        )}

        {status === "ready" && cvFailed && (
          <p className="absolute inset-x-0 bottom-28 px-4 text-center text-xs text-white/60">
            Otomatik algılama kullanılamıyor — deklanşöre basarak elle çekebilirsiniz.
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
              Dosyadan Yükle&apos;ye dön
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
