"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { createPortal } from "react-dom"
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

// Basit, güvenilir "dokun-çek" ruhsat kamerası. Canlı OpenCV/jscanify otomatik
// kenar tespiti + otomatik-çekim döngüsü KALDIRILDI: o döngü ana iş parçacığını
// doyurup arayüzü donduruyordu (deklanşöre/kapat'a dokunuş kaydolmuyordu). Kullanıcı
// çerçeveye yerleştirip deklanşöre basar; tam kare yakalanır ve OCR'a verilir
// (prepareRegistrationImage zaten normalize/küçültme yapıyor).
export function RegistrationScanner({ onCapture, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const captureCanvasRef = useRef<HTMLCanvasElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const capturedRef = useRef<{ file: File; url: string } | null>(null)
  const mountedRef = useRef(true)
  // Gövde (video alanı) konteyneri — yakalama penceresi geometrisi ve kırpma bunun boyutuna göre.
  const bodyRef = useRef<HTMLDivElement>(null)

  const [status, setStatus] = useState<ScannerStatus>("starting")
  const [errorMsg, setErrorMsg] = useState("")
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)
  // Yakalama penceresi (rehber dikdörtgen) gövde-konteyner koordinatlarında. Görsel blur
  // çerçevesi VE kırpma AYNI geometriyi kullanır → görünen alan ile çekilen birebir aynıdır.
  const [win, setWin] = useState<{ x: number; y: number; w: number; h: number } | null>(null)

  useEffect(() => {
    // StrictMode (dev) effect'leri setup→cleanup→setup çalıştırır. İlk cleanup mountedRef'i
    // false yapar; setup'ta tekrar true'ya çekmezsek false kalır → capture()'ın toBlob
    // callback'i `if (!mountedRef.current) return` ile SESSİZCE erken döner: foto çekilir
    // ama önizlemeye geçilmez ("deklanşör çalışmıyor" görünür). Üretimde StrictMode yok,
    // bu yüzden yalnızca dev'de görülür. Setup'ta mounted'ı true'ya sıfırla.
    mountedRef.current = true
    return () => {
      mountedRef.current = false
      if (capturedRef.current) {
        URL.revokeObjectURL(capturedRef.current.url)
        capturedRef.current = null
      }
    }
  }, [])

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
          // Metadata yüklenene kadar bekle: aksi halde play() çözülse de videoWidth
          // 0 kalabiliyor (masaüstü) → deklanşör sessizce hiçbir şey yapmıyordu.
          if (!(video.readyState >= 1 && video.videoWidth)) {
            await new Promise<void>((res) => {
              const onMeta = () => { video.removeEventListener("loadedmetadata", onMeta); res() }
              video.addEventListener("loadedmetadata", onMeta)
            })
          }
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
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

  // Rehber dikdörtgen geometrisini gövde boyutundan hesapla (ortalı, 3:2, kenar boşluklu).
  // ResizeObserver pencere/rotasyon değişiminde günceller; çekim de aynı geometriyi kullanır.
  useEffect(() => {
    if (status !== "ready") return
    const el = bodyRef.current
    if (!el) return
    const compute = () => {
      const cw = el.clientWidth
      const ch = el.clientHeight
      if (!cw || !ch) return
      const margin = 24 // p-6
      const maxW = 672 // ~max-w-2xl
      const aspect = 3 / 2
      let w = Math.min(cw - margin * 2, maxW)
      let h = w / aspect
      if (h > ch - margin * 2) {
        h = Math.max(0, ch - margin * 2)
        w = h * aspect
      }
      setWin({ x: (cw - w) / 2, y: (ch - h) / 2, w, h })
    }
    compute()
    const ro = new ResizeObserver(compute)
    ro.observe(el)
    return () => ro.disconnect()
  }, [status])

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

  // Yakalama penceresini (rehber dikdörtgen) kırp → File → önizleme.
  const capture = useCallback(() => {
    const video = videoRef.current
    const canvas = captureCanvasRef.current
    const body = bodyRef.current
    if (!video || !canvas) return
    const vw = video.videoWidth
    const vh = video.videoHeight
    if (!vw || !vh) {
      // Kare henüz hazır değil: sessiz kalma, kullanıcıyı bilgilendir.
      setErrorMsg("Kamera görüntüsü henüz hazır değil, bir an bekleyip tekrar deneyin.")
      setStatus("error")
      return
    }
    // Varsayılan tam kare; pencere + gövde ölçülebiliyorsa SADECE pencere bölgesini kırp.
    // Ekran (gövde) koordinatlarını object-cover dönüşümüyle video piksellerine çevir →
    // görünen yeşil/beyaz dikdörtgenle çekilen birebir aynı olur.
    let sx = 0, sy = 0, sw = vw, sh = vh
    if (win && body && body.clientWidth && body.clientHeight) {
      const cw = body.clientWidth
      const ch = body.clientHeight
      const scale = Math.max(cw / vw, ch / vh) // object-cover
      const offX = (cw - vw * scale) / 2
      const offY = (ch - vh * scale) / 2
      const clamp = (v: number, max: number) => Math.max(0, Math.min(max, v))
      const x1 = clamp((win.x - offX) / scale, vw)
      const y1 = clamp((win.y - offY) / scale, vh)
      const x2 = clamp((win.x + win.w - offX) / scale, vw)
      const y2 = clamp((win.y + win.h - offY) / scale, vh)
      sx = x1
      sy = y1
      sw = Math.max(1, x2 - x1)
      sh = Math.max(1, y2 - y1)
    }
    canvas.width = Math.round(sw)
    canvas.height = Math.round(sh)
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(video, sx, sy, sw, sh, 0, 0, canvas.width, canvas.height)
    canvas.toBlob(
      (blob) => {
        if (!mountedRef.current) return
        if (!blob) {
          setStatus("error")
          setErrorMsg("Görüntü oluşturulamadı.")
          return
        }
        if (capturedRef.current) URL.revokeObjectURL(capturedRef.current.url)
        const url = URL.createObjectURL(blob)
        capturedRef.current = { file: new File([blob], "ruhsat-capture.jpg", { type: "image/jpeg" }), url }
        setCapturedUrl(url)
        setStatus("captured")
      },
      "image/jpeg",
      CAPTURE_JPEG_QUALITY,
    )
  }, [win])

  const retake = useCallback(() => {
    if (capturedRef.current) {
      URL.revokeObjectURL(capturedRef.current.url)
      capturedRef.current = null
    }
    setCapturedUrl(null)
    setStatus("ready")
  }, [])

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

  // Yalnızca istemcide (scannerOpen tetikli) render olur; SSR'da body yok.
  if (typeof document === "undefined") return null

  // document.body'ye portal: Base UI Dialog'un transform'lu/overflow'lu kutusu fixed
  // alt öğeyi hapsediyordu (kontroller kırpılıp tıklanamaz hale geliyordu) ve
  // modal body'ye pointer-events:none koyuyor. Portal + pointer-events-auto + z-[60]
  // ile tam-ekran tarayıcı modalın üstünde gerçekten tıklanabilir olur.
  return createPortal(
    <div className="pointer-events-auto fixed inset-0 z-[60] flex flex-col bg-black text-white">
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
      <div ref={bodyRef} className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 size-full object-cover ${status === "captured" || isFallback ? "hidden" : ""}`}
        />
        <canvas ref={captureCanvasRef} className="hidden" />

        {/* Pencere dışı blur + yakalama penceresi: yalnızca bu dikdörtgen net görünür ve
            çekilir. 4 şerit pencere dışını bulanıklaştırıp hafifçe karartır (köşeler üst/alt
            şeritlerce kaplanır → boşluk yok). */}
        {status === "ready" && win && (
          <div className="pointer-events-none absolute inset-0">
            <div className="absolute bg-black/40 backdrop-blur-md" style={{ left: 0, top: 0, width: "100%", height: win.y }} />
            <div className="absolute bg-black/40 backdrop-blur-md" style={{ left: 0, top: win.y + win.h, width: "100%", bottom: 0 }} />
            <div className="absolute bg-black/40 backdrop-blur-md" style={{ left: 0, top: win.y, width: win.x, height: win.h }} />
            <div className="absolute bg-black/40 backdrop-blur-md" style={{ left: win.x + win.w, top: win.y, right: 0, height: win.h }} />
            <div className="absolute rounded-lg border-2 border-white/80" style={{ left: win.x, top: win.y, width: win.w, height: win.h }} />
          </div>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <BrandSpinner size={56} label="Kamera hazırlanıyor…" className="text-white" />
          </div>
        )}

        {status === "ready" && (
          <p className="absolute inset-x-0 top-4 text-center text-sm font-medium text-white/90">
            Ruhsatı açıp çerçeveye yerleştirin, deklanşöre basın
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
            onClick={capture}
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
    </div>,
    document.body,
  )
}
