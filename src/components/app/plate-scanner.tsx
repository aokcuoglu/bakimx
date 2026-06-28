"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { Camera, X, Zap, ZapOff, RefreshCw, AlertTriangle, Upload } from "lucide-react"

const CAPTURE_JPEG_QUALITY = 0.9
const CAPTURE_LONG_EDGE = 1600

type ScannerStatus = "starting" | "ready" | "scanning" | "error" | "denied" | "unsupported"

type Props = {
  onDetected: (plate: string) => void
  onClose: () => void
}

// MediaTrackCapabilities/Constraints standart TS lib'inde torch içermez.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraints = MediaTrackConstraints & { advanced?: Array<{ torch?: boolean }> }

/**
 * Hafif plaka tarayıcı: canlı kamera + plaka oranlı rehber + manuel deklanşör.
 * Çekilen kare /api/plate/scan'e gönderilir; okunan plaka onDetected ile döner.
 * Ruhsat tarayıcısının aksine jscanify/OpenCV belge tespiti YOK (plaka kağıt değil).
 */
export function PlateScanner({ onDetected, onClose }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)

  const [status, setStatus] = useState<ScannerStatus>("starting")
  const [errorMsg, setErrorMsg] = useState("")
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  const stopStream = useCallback(() => {
    streamRef.current?.getTracks().forEach((t) => t.stop())
    streamRef.current = null
    if (videoRef.current) videoRef.current.srcObject = null
  }, [])

  useEffect(() => {
    mountedRef.current = true
    return () => {
      mountedRef.current = false
    }
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

  // Verilen JPEG data URL'yi sunucuya gönderip plakayı oku.
  const runOcr = useCallback(
    async (dataUrl: string, mimeType: string) => {
      setCapturedUrl(dataUrl)
      setErrorMsg("")
      setStatus("scanning")
      // OCR sunucuda birkaç saniye sürebilir; süresiz dönmesin diye zaman aşımı.
      const controller = new AbortController()
      const timeout = setTimeout(() => controller.abort(), 30000)
      try {
        const res = await fetch("/api/plate/scan", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ imageDataUrl: dataUrl, mimeType }),
          signal: controller.signal,
        })
        // Yanıt JSON olmayabilir (örn. proxy 502/504 HTML'i); güvenli çözümle.
        const raw = await res.text()
        let data: { plate?: string; error?: string } = {}
        try {
          data = raw ? JSON.parse(raw) : {}
        } catch {
          data = { error: res.ok ? undefined : "Sunucu beklenmedik bir yanıt döndü." }
        }
        if (!mountedRef.current) return
        if (!res.ok || !data.plate) {
          setErrorMsg(data.error || "Plaka okunamadı.")
          setStatus("error")
          return
        }
        stopStream()
        onDetected(data.plate)
      } catch (err) {
        if (!mountedRef.current) return
        const aborted = err instanceof DOMException && err.name === "AbortError"
        setErrorMsg(
          aborted
            ? "Okuma zaman aşımına uğradı. Lütfen tekrar deneyin."
            : "Bağlantı hatası. Lütfen tekrar deneyin."
        )
        setStatus("error")
      } finally {
        clearTimeout(timeout)
      }
    },
    [onDetected, stopStream]
  )

  // Canlı kareyi yakala → SADECE plaka penceresine kırp → OCR.
  // Rehber penceresi yalnızca görsel değil; OCR'a tüm sahne değil, yalnızca
  // çerçeve içindeki bölge gider. Bu hem arka planı dışlar hem okuma isabetini
  // ciddi artırır.
  const capture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return

    const srcW = video.videoWidth
    const srcH = video.videoHeight

    // Varsayılan: tüm kare (kırpma hesaplanamazsa güvenli yedek).
    let sx = 0
    let sy = 0
    let sWidth = srcW
    let sHeight = srcH

    const frame = frameRef.current
    const vrect = video.getBoundingClientRect()
    if (frame && vrect.width > 0 && vrect.height > 0) {
      const frect = frame.getBoundingClientRect()
      // Video object-cover: kaynağı kutuyu kaplayacak şekilde ölçekle, ortala,
      // taşan kenarları kırp. Ekran (CSS) koordinatını kaynak piksele çevir.
      const coverScale = Math.max(vrect.width / srcW, vrect.height / srcH)
      const offX = (vrect.width - srcW * coverScale) / 2
      const offY = (vrect.height - srcH * coverScale) / 2
      sx = (frect.left - vrect.left - offX) / coverScale
      sy = (frect.top - vrect.top - offY) / coverScale
      sWidth = frect.width / coverScale
      sHeight = frect.height / coverScale
      // Küçük hizalama payı: plaka çerçeveyi tam doldurmazsa kenarları kırpma.
      const padX = sWidth * 0.06
      const padY = sHeight * 0.12
      sx -= padX
      sy -= padY
      sWidth += padX * 2
      sHeight += padY * 2
      // Kaynak sınırlarına kıstır.
      sx = Math.max(0, Math.min(sx, srcW))
      sy = Math.max(0, Math.min(sy, srcH))
      sWidth = Math.max(1, Math.min(sWidth, srcW - sx))
      sHeight = Math.max(1, Math.min(sHeight, srcH - sy))
    }

    // Çıkış boyutu: OCR için uzun kenarı normalize et (küçük kırpıları büyüt,
    // çok büyükleri küçült). Net glyph'ler Tesseract'a yardımcı olur.
    const longEdge = Math.max(sWidth, sHeight)
    const targetLong = Math.min(CAPTURE_LONG_EDGE, Math.max(longEdge, 1200))
    const outScale = targetLong / longEdge
    canvas.width = Math.round(sWidth * outScale)
    canvas.height = Math.round(sHeight * outScale)

    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.imageSmoothingQuality = "high"
    ctx.drawImage(video, sx, sy, sWidth, sHeight, 0, 0, canvas.width, canvas.height)
    const dataUrl = canvas.toDataURL("image/jpeg", CAPTURE_JPEG_QUALITY)
    void runOcr(dataUrl, "image/jpeg")
  }, [runOcr])

  // Dosya/galeri yedeği (kamera yoksa veya izin verilmediyse).
  const onFileSelected = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        void runOcr(dataUrl, file.type || "image/jpeg")
      }
      reader.onerror = () => {
        setErrorMsg("Görsel dosyası okunamadı.")
        setStatus("error")
      }
      reader.readAsDataURL(file)
    },
    [runOcr]
  )

  const retake = useCallback(() => {
    setCapturedUrl(null)
    setErrorMsg("")
    setStatus(streamRef.current ? "ready" : "unsupported")
  }, [])

  const handleClose = useCallback(() => {
    stopStream()
    onClose()
  }, [onClose, stopStream])

  const isFallback = status === "denied" || status === "unsupported"

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Üst bar */}
      <div className="flex items-center justify-between p-4 shrink-0">
        <button onClick={handleClose} className="flex size-11 items-center justify-center rounded-full bg-white/10" aria-label="Kapat">
          <X className="size-5" />
        </button>
        <span className="text-sm font-medium">Plakayı Tara</span>
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
          className={`absolute inset-0 size-full object-cover ${status === "scanning" || status === "error" || isFallback ? "hidden" : ""}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Plaka rehber çerçevesi + odak dışını bulanıklaştıran maske */}
        {status === "ready" && (
          <>
            {/* Çerçeve dışını karartıp bulanıklaştır; yalnızca plaka penceresi net kalır */}
            <div className="pointer-events-none absolute inset-0 flex flex-col">
              <div className="flex-1 bg-black/40 backdrop-blur-md" />
              <div className="flex items-stretch">
                <div className="flex-1 bg-black/40 backdrop-blur-md" />
                {/* Net plaka penceresi (kamera buradan görünür; yakalama bu bölgeye kırpılır) */}
                <div ref={frameRef} className="relative aspect-[4.6/1] w-[86%] max-w-md shrink-0 overflow-hidden rounded-md border-2 border-white/90">
                  {/* TR mavi şeridi — Türkiye plakası göstergesi */}
                  <div className="absolute inset-y-0 left-0 flex w-[13%] min-w-7 items-center justify-center bg-[#0b4ea2]">
                    <span className="text-[0.7rem] font-bold leading-none tracking-wider text-white">TR</span>
                  </div>
                </div>
                <div className="flex-1 bg-black/40 backdrop-blur-md" />
              </div>
              <div className="flex-1 bg-black/40 backdrop-blur-md" />
            </div>
            <p className="absolute inset-x-0 top-4 text-center text-sm font-medium text-white/90">
              Plakayı çerçeveye yerleştirip çekin
            </p>
          </>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex items-center justify-center">
            <BrandSpinner size={56} label="Kamera hazırlanıyor…" className="text-white" />
          </div>
        )}

        {/* Okunuyor / hata önizlemesi */}
        {(status === "scanning" || status === "error") && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 bg-black p-4">
            {capturedUrl && (
              <Image src={capturedUrl} alt="Çekilen plaka" width={1200} height={400} unoptimized className="max-h-48 max-w-full rounded-lg object-contain" />
            )}
            {status === "scanning" && <BrandSpinner size={48} label="Plaka okunuyor…" className="text-white" />}
            {status === "error" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertTriangle className="size-8 text-warning" />
                <p className="max-w-sm text-sm text-white/90">{errorMsg}</p>
                <Button variant="outline" onClick={retake} className="gap-2 border-white/30 bg-white/10 text-white hover:bg-white/20">
                  <RefreshCw className="size-4" /> Tekrar çek
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Kamera yoksa/izin yoksa: dosyadan yükle */}
        {isFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="size-10 text-warning" />
            <p className="max-w-sm text-sm text-white/90">
              {status === "denied"
                ? "Kamera izni verilmedi. Tarayıcı ayarlarından izin verin veya dosyadan yükleyin."
                : "Bu cihaz/tarayıcı canlı kamerayı desteklemiyor. Lütfen dosyadan yükleyin."}
            </p>
            <Button onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="size-4" /> Dosyadan Yükle
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
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          if (file) onFileSelected(file)
        }}
      />
    </div>
  )
}
