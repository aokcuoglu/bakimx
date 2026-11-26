"use client"

import { useCallback, useEffect, useRef, useState, type ReactNode } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { ScanError, type ScanImagePayload } from "@/lib/ocr/scan-client"
import { coverRegionToSource } from "@/lib/ocr/capture-crop"
import { Camera, X, Zap, ZapOff, RefreshCw, AlertTriangle, Upload, Check, Keyboard } from "lucide-react"

const CAPTURE_JPEG_QUALITY = 0.9
const CAPTURE_LONG_EDGE = 1600

type ScannerStatus = "starting" | "ready" | "scanning" | "confirm" | "error" | "denied" | "unsupported"

// MediaTrackCapabilities/Constraints standart TS lib'inde torch içermez.
type TorchCapabilities = MediaTrackCapabilities & { torch?: boolean }
type TorchConstraints = MediaTrackConstraints & { advanced?: Array<{ torch?: boolean }> }

export type CameraScannerProps = {
  /** Üst bardaki başlık, ör. "Plakayı Tara". */
  title: string
  /** Canlı görüntüde çerçevenin üstünde duran yönerge (`guide` verilmezse). */
  hint?: string
  /**
   * Rehber penceresinin oran + genişlik sınıfları, ör. "aspect-[4.6/1] w-[86%] max-w-md".
   * Verilmezse çerçeve ve maske çizilmez, yakalanan kare kırpılmaz (tam görüntü).
   */
  frameClassName?: string
  /** Verilirse canlı görüntünün altında, deklanşörün üstünde gösterilen yönerge kartı. */
  guide?: ReactNode
  /** Çerçeve içine çizilen ek işaretler (ör. plakadaki TR şeridi). */
  frameOverlay?: ReactNode
  /** Okuma sırasında gösterilen etiket, ör. "Plaka okunuyor…". */
  scanningLabel: string
  /**
   * Kırpılmış kareyi okur. Okunan değeri döndürür; okunamazsa kullanıcıya
   * gösterilecek Türkçe mesajla hata fırlatır (bkz. `postImageScan`).
   */
  onScan: (payload: ScanImagePayload) => Promise<string>
  /** Kullanıcının onayladığı (veya onay adımı yoksa doğrudan okunan) değer. */
  onDetected: (value: string) => void
  onClose: () => void
  /**
   * Verilirse okuma sonrası bir onay adımı gösterilir: kullanıcı okunan değeri
   * gözüyle karşılaştırıp "Kullan" der ya da tekrar çeker. Karışabilen uzun
   * değerlerde (VIN) zorunlu; plaka gibi kısa değerlerde gereksiz adımdır.
   */
  renderConfirm?: (value: string) => ReactNode
  /**
   * Verilirse alt çubuğun solunda "El ile gir" düğmesi çıkar: kullanıcı kamerayı
   * kapatıp değeri elle yazmayı seçer (tarayıcı kapanır, çağıran yazı alanına döner).
   */
  onManualEntry?: () => void
}

/**
 * Ortak kamera tarayıcı kabuğu: canlı arka kamera, rehber penceresine kırpan
 * deklanşör, flaş, izin/destek yoksa dosyadan yükleme yedeği ve okuma/hata/onay
 * durumları. Okumanın kendisi `onScan` ile dışarıya bırakılır — plaka tarayıcısı
 * (yerel Tesseract) ve şase tarayıcısı (#188, OCR sağlayıcısı) bu kabuğu paylaşır.
 */
export function CameraScanner({
  title,
  hint,
  frameClassName,
  frameOverlay,
  guide,
  scanningLabel,
  onScan,
  onDetected,
  onClose,
  renderConfirm,
  onManualEntry,
}: CameraScannerProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const frameRef = useRef<HTMLDivElement>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const mountedRef = useRef(true)

  const [status, setStatus] = useState<ScannerStatus>("starting")
  const [errorMsg, setErrorMsg] = useState("")
  const [capturedUrl, setCapturedUrl] = useState<string | null>(null)
  const [scannedValue, setScannedValue] = useState<string | null>(null)
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

  // Kamera izni/başlatma uzun sürerse ("starting"te takılı kalmak) kullanıcıya
  // ne beklendiğini söyle ve yeniden deneme sun. Tarayıcı izin isteği sayfa
  // açılışında (dokunuşsuz) geldiğinde adres çubuğunda kolayca gözden kaçıyor;
  // bazı tarayıcılar da dokunuşla gelmeyen isteği hiç sonuçlandırmıyor. Yeniden
  // dene düğmesi isteği bir dokunuşla tekrarlar.
  const [slowStart, setSlowStart] = useState(false)
  const [attempt, setAttempt] = useState(0)

  // Kamerayı başlat.
  useEffect(() => {
    let cancelled = false
    const slowTimer = window.setTimeout(() => {
      if (!cancelled) setSlowStart(true)
    }, 3000)

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
          // Beklenmez: play() sözü bazı tarayıcılarda ilk kare gelene dek askıda
          // kalabiliyor; "ready"yi ona bağlamak ekranı "hazırlanıyor"da bırakır.
          void video.play().catch(() => {})
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
          // "unsupported" (error değil): bu durumda tek çıkış yolu dosyadan yükleme
          // ve o düğme yalnız fallback ekranında var. "error" durumunda kullanıcı
          // "Lütfen dosyadan yükleyin" yazısını görüp yükleyecek düğmeyi bulamıyordu.
          setStatus("unsupported")
          setErrorMsg("Kamera başlatılamadı. Lütfen dosyadan yükleyin.")
        }
      }
    }

    void start().finally(() => window.clearTimeout(slowTimer))
    return () => {
      cancelled = true
      window.clearTimeout(slowTimer)
      stopStream()
    }
  }, [stopStream, attempt])

  const retryStart = useCallback(() => {
    stopStream()
    setSlowStart(false)
    setStatus("starting")
    setAttempt((n) => n + 1)
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

  // Verilen JPEG data URL'yi okuyucuya gönder.
  const runScan = useCallback(
    async (dataUrl: string, mimeType: string) => {
      setCapturedUrl(dataUrl)
      setErrorMsg("")
      setScannedValue(null)
      setStatus("scanning")
      try {
        const value = await onScan({ dataUrl, mimeType })
        if (!mountedRef.current) return
        if (renderConfirm) {
          setScannedValue(value)
          setStatus("confirm")
          return
        }
        stopStream()
        onDetected(value)
      } catch (err) {
        if (!mountedRef.current) return
        setErrorMsg(
          err instanceof ScanError || err instanceof Error
            ? err.message
            : "Bağlantı hatası. Lütfen tekrar deneyin."
        )
        setStatus("error")
      }
    },
    [onDetected, onScan, renderConfirm, stopStream]
  )

  // Canlı kareyi yakala → SADECE rehber penceresine kırp → oku.
  // Rehber penceresi yalnızca görsel değil; okuyucuya tüm sahne değil, yalnızca
  // çerçeve içindeki bölge gider. Bu hem arka planı dışlar hem okuma isabetini
  // ciddi artırır.
  const capture = useCallback(() => {
    const video = videoRef.current
    const canvas = canvasRef.current
    if (!video || !canvas || !video.videoWidth) return

    const srcW = video.videoWidth
    const srcH = video.videoHeight

    // Ekranda ne görünüyorsa o çekilir. Video `object-cover` olduğundan kaynağın
    // taşan kenarları önizlemede gizlidir (dikey telefonda yatay kameranın yalnız
    // ortası görünür); tüm kare gönderilirse kullanıcının hiç görmediği kişi/nesne
    // fotoğrafa girer. Rehber çerçevesi varsa yalnız çerçeve içi (+ hizalama payı),
    // yoksa görünen kare kırpılır.
    const frame = frameRef.current
    const vrect = video.getBoundingClientRect()
    const { sx, sy, sWidth, sHeight } = frame
      ? coverRegionToSource({ width: srcW, height: srcH }, vrect, frame.getBoundingClientRect(), { x: 0.06, y: 0.12 })
      : coverRegionToSource({ width: srcW, height: srcH }, vrect, vrect)

    // Çıkış boyutu: okuma için uzun kenarı normalize et (küçük kırpıları büyüt,
    // çok büyükleri küçült). Net glyph'ler OCR'a yardımcı olur.
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
    void runScan(dataUrl, "image/jpeg")
  }, [runScan])

  // Dosya/galeri yedeği (kamera yoksa veya izin verilmediyse).
  const onFileSelected = useCallback(
    (file: File) => {
      const reader = new FileReader()
      reader.onload = () => {
        const dataUrl = reader.result as string
        void runScan(dataUrl, file.type || "image/jpeg")
      }
      reader.onerror = () => {
        setErrorMsg("Görsel dosyası okunamadı.")
        setStatus("error")
      }
      reader.readAsDataURL(file)
    },
    [runScan]
  )

  const retake = useCallback(() => {
    setCapturedUrl(null)
    setScannedValue(null)
    setErrorMsg("")
    setStatus(streamRef.current ? "ready" : "unsupported")
  }, [])

  const accept = useCallback(() => {
    if (!scannedValue) return
    stopStream()
    onDetected(scannedValue)
  }, [onDetected, scannedValue, stopStream])

  const handleClose = useCallback(() => {
    stopStream()
    onClose()
  }, [onClose, stopStream])

  const isFallback = status === "denied" || status === "unsupported"
  const showsPreview = status === "scanning" || status === "error" || status === "confirm"

  return (
    <div className="fixed inset-0 z-50 flex flex-col bg-black text-white">
      {/* Üst bar */}
      <div className="flex items-center justify-between p-4 shrink-0">
        <Button type="button" variant="on-photo" size="icon" onClick={handleClose} aria-label="Kapat">
          <X className="size-5" />
        </Button>
        <span className="text-sm font-medium">{title}</span>
        {torchSupported && status === "ready" ? (
          <Button type="button" variant="on-photo" size="icon" onClick={toggleTorch} aria-label="Flaş">
            {torchOn ? <Zap className="size-5 text-warning-strong" /> : <ZapOff className="size-5" />}
          </Button>
        ) : (
          <span className="size-8" />
        )}
      </div>

      {/* Gövde */}
      <div className="relative flex-1 overflow-hidden">
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 size-full object-cover ${showsPreview || isFallback ? "hidden" : ""}`}
        />
        <canvas ref={canvasRef} className="hidden" />

        {/* Rehber çerçevesi + odak dışını bulanıklaştıran maske */}
        {status === "ready" && frameClassName && (
          <>
            {/* Çerçeve dışını karartıp bulanıklaştır; yalnızca hedef penceresi net kalır */}
            <div className="pointer-events-none absolute inset-0 flex flex-col">
              <div className="flex-1 bg-black/40 backdrop-blur-md" />
              <div className="flex items-stretch">
                <div className="flex-1 bg-black/40 backdrop-blur-md" />
                {/* Net pencere (kamera buradan görünür; yakalama bu bölgeye kırpılır) */}
                <div ref={frameRef} className={`relative shrink-0 overflow-hidden rounded-md border-2 border-white/90 ${frameClassName}`}>
                  {frameOverlay}
                </div>
                <div className="flex-1 bg-black/40 backdrop-blur-md" />
              </div>
              <div className="flex-1 bg-black/40 backdrop-blur-md" />
            </div>
            {!guide && hint && (
              <p className="absolute inset-x-0 top-4 text-center text-sm font-medium text-white">{hint}</p>
            )}
          </>
        )}

        {/* Çerçevesiz modda yalnız üst yönerge (kart yoksa) */}
        {status === "ready" && !frameClassName && !guide && hint && (
          <p className="absolute inset-x-0 top-4 text-center text-sm font-medium text-white">{hint}</p>
        )}

        {/* Alt yönerge kartı: görüntünün altında, deklanşörün hemen üstünde */}
        {status === "ready" && guide && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 px-4 pb-4">{guide}</div>
        )}

        {status === "starting" && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 p-6 text-center">
            <BrandSpinner size={56} label="Kamera hazırlanıyor…" className="text-white" />
            {slowStart && (
              <>
                <p className="max-w-sm text-sm text-white">
                  Kamera izni bekleniyor. Tarayıcının gösterdiği izin isteğinde &ldquo;İzin ver&rdquo;i seçin.
                </p>
                <Button variant="foreground" onClick={retryStart} className="gap-2">
                  <RefreshCw className="size-4" /> Kamerayı başlat
                </Button>
              </>
            )}
          </div>
        )}

        {/* Okunuyor / hata / onay önizlemesi */}
        {showsPreview && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 overflow-y-auto bg-black p-4">
            {capturedUrl && (
              <Image src={capturedUrl} alt="Çekilen kare" width={1200} height={400} unoptimized className={`${frameClassName ? "max-h-48" : "max-h-[55vh]"} w-auto max-w-full rounded-lg object-contain`} />
            )}
            {status === "scanning" && <BrandSpinner size={48} label={scanningLabel} className="text-white" />}
            {status === "confirm" && scannedValue && (
              <div className="flex w-full max-w-sm flex-col items-center gap-4 text-center">
                {renderConfirm?.(scannedValue)}
                <div className="flex w-full flex-col gap-2">
                  <Button variant="foreground" size="lg" onClick={accept} className="gap-2">
                    <Check className="size-4" /> Kullan
                  </Button>
                  <Button variant="on-photo" onClick={retake} className="gap-2">
                    <RefreshCw className="size-4" /> Tekrar çek
                  </Button>
                </div>
              </div>
            )}
            {status === "error" && (
              <div className="flex flex-col items-center gap-3 text-center">
                <AlertTriangle className="size-8 text-warning-strong" />
                <p className="max-w-sm text-sm text-white">{errorMsg}</p>
                <Button variant="on-photo" onClick={retake} className="gap-2">
                  <RefreshCw className="size-4" /> Tekrar çek
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Kamera yoksa/izin yoksa: dosyadan yükle */}
        {isFallback && (
          <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 p-6 text-center">
            <AlertTriangle className="size-10 text-warning-strong" />
            <p className="max-w-sm text-sm text-white">
              {status === "denied"
                ? "Kamera izni verilmedi. Tarayıcı ayarlarından izin verin veya dosyadan yükleyin."
                : errorMsg || "Bu cihaz/tarayıcı canlı kamerayı desteklemiyor. Lütfen dosyadan yükleyin."}
            </p>
            <Button variant="foreground" onClick={() => fileInputRef.current?.click()} className="gap-2">
              <Upload className="size-4" /> Dosyadan Yükle
            </Button>
          </div>
        )}
      </div>

      {/* Alt kontroller: ortada deklanşör, solda "El ile gir" (verildiyse), sağda
          dosyadan yükleme. Dosya yolu yalnız kamerasız/izinsiz durumda sunulursa
          webcam'li bir PC'de kullanıcı elindeki fotoğrafı hiç yükleyemez — o yüzden
          kamera açıkken de durur. */}
      <div className="relative flex min-h-28 items-center justify-center gap-6 p-6 shrink-0">
        {onManualEntry && (
          <Button
            type="button"
            variant="on-photo-ghost"
            onClick={onManualEntry}
            className="absolute left-6 top-1/2 h-auto -translate-y-1/2 flex-col gap-1 rounded-xl px-3 py-2 text-xs"
          >
            <Keyboard className="size-5" /> El ile gir
          </Button>
        )}
        {status === "ready" && (
          <Button
            type="button"
            variant="on-photo"
            onClick={capture}
            className="size-16 rounded-full border-4 border-white active:scale-95"
            aria-label="Çek"
          >
            <Camera className="size-7" />
          </Button>
        )}
        {/* "starting" da dahil: kamera izni beklenirken de dosya seçilebilsin. */}
        {(status === "ready" || status === "starting") && (
          <Button
            type="button"
            variant="on-photo-ghost"
            onClick={() => fileInputRef.current?.click()}
            className="absolute right-6 top-1/2 h-auto -translate-y-1/2 flex-col gap-1 rounded-xl px-3 py-2 text-xs"
          >
            <Upload className="size-5" /> Dosyadan
          </Button>
        )}
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0]
          // Aynı dosya tekrar seçilebilsin (hata sonrası yeniden deneme).
          e.target.value = ""
          if (file) onFileSelected(file)
        }}
      />
    </div>
  )
}
