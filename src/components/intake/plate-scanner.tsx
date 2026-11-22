"use client"

import { useCallback, useRef } from "react"
import { TriangleAlert } from "lucide-react"
import { CameraScanner } from "@/components/shared/camera-scanner"
import { postImageScan, ScanError, type ScanImagePayload } from "@/lib/ocr/scan-client"

type Props = {
  /**
   * Okunan plaka ve plakanın okunduğu kare. Kare aracın önünün fotoğrafıdır;
   * Araç Kabul bunu kabul fotoğrafı ("Ön") olarak saklar ki aynı kare ikinci
   * kez çekilmesin.
   */
  onDetected: (plate: string, image: ScanImagePayload | null) => void
  onClose: () => void
}

/**
 * Plaka tarayıcı: ortak kamera kabuğu (bkz. CameraScanner) + araç önü kadrajı.
 * Kullanıcı plakayı değil aracın önünü çeker; kare /api/plate/scan'e gönderilir,
 * plakanın yerini ve metnini sunucu bulur (Claude Vision). Plaka kısa ve tanıdık
 * bir değer olduğundan onay adımı yoktur — okunan değer doğrudan arama kutusuna
 * yazılır ve kullanıcı orada görüp düzeltebilir.
 */
export function PlateScanner({ onDetected, onClose }: Props) {
  // Okumayı başaran kare: CameraScanner yalnız okunan değeri geri verir.
  const lastFrame = useRef<ScanImagePayload | null>(null)
  const scan = useCallback(async (payload: ScanImagePayload) => {
    lastFrame.current = payload
    const data = await postImageScan<{ plate?: string }>("/api/plate/scan", payload)
    if (!data.plate) throw new ScanError("Plaka okunamadı.")
    return data.plate
  }, [])

  return (
    <CameraScanner
      title="Aracı Çek"
      guide={<PlateCaptureGuide />}
      scanningLabel="Plaka okunuyor…"
      onScan={scan}
      onDetected={(plate) => onDetected(plate, lastFrame.current)}
      onClose={onClose}
    />
  )
}

/**
 * Alt yönerge kartı: ünlem ikonu + kısa talimat.
 * Çerçeve yok — kullanıcı aracı dilediği gibi kadrajlar, plakayı sunucu bulur.
 */
function PlateCaptureGuide() {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-black/70 p-4 text-white ring-1 ring-white/15 backdrop-blur-md">
      <div className="flex items-start gap-3">
        <span className="inline-flex size-10 shrink-0 items-center justify-center rounded-full bg-warning text-warning-foreground">
          <TriangleAlert className="size-5" aria-hidden="true" />
        </span>
        <div className="min-w-0">
          <p className="text-lg leading-tight font-semibold">Aracın önünü çekin</p>
          <p className="mt-1 text-sm leading-snug text-white">
            Plaka net bir şekilde görünsün.
          </p>
        </div>
      </div>
    </div>
  )
}
