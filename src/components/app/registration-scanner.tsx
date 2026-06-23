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

  const capturedRef = useRef<{ file: File; url: string } | null>(null)
  const mountedRef = useRef(true)

  const [status, setStatus] = useState<ScannerStatus>("starting")
  const [errorMsg, setErrorMsg] = useState("")
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [torchOn, setTorchOn] = useState(false)
  const [torchSupported, setTorchSupported] = useState(false)

  useEffect(() => {
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

  // Verilen canvas'ı (tam kare ya da Task 5'te extractPaper çıktısı) File'a çevirip önizlemeye geç.
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
  }, [finishCapture])

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
