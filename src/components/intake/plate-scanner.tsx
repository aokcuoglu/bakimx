"use client"

import { useCallback } from "react"
import { CameraScanner } from "@/components/shared/camera-scanner"
import { postImageScan, ScanError, type ScanImagePayload } from "@/lib/ocr/scan-client"

type Props = {
  onDetected: (plate: string) => void
  onClose: () => void
}

/**
 * Plaka tarayıcı: ortak kamera kabuğu (bkz. CameraScanner) + plaka oranlı rehber.
 * Çekilen kare /api/plate/scan'e gönderilir; okunan plaka onDetected ile döner.
 * Ruhsat tarayıcısının aksine jscanify/OpenCV belge tespiti YOK (plaka kağıt değil).
 * Plaka kısa ve tanıdık bir değer olduğundan onay adımı yoktur — okunan değer
 * doğrudan arama kutusuna yazılır ve kullanıcı orada görüp düzeltebilir.
 */
export function PlateScanner({ onDetected, onClose }: Props) {
  const scan = useCallback(async (payload: ScanImagePayload) => {
    const data = await postImageScan<{ plate?: string }>("/api/plate/scan", payload)
    if (!data.plate) throw new ScanError("Plaka okunamadı.")
    return data.plate
  }, [])

  return (
    <CameraScanner
      title="Plakayı Tara"
      hint="Plakayı çerçeveye yerleştirip çekin"
      frameClassName="aspect-[4.6/1] w-[86%] max-w-md"
      frameOverlay={
        // TR mavi şeridi — Türkiye plakası göstergesi
        <div className="absolute inset-y-0 left-0 flex w-[13%] min-w-7 items-center justify-center bg-primary">
          <span className="text-[0.7rem] font-bold leading-none tracking-wider text-primary-foreground">TR</span>
        </div>
      }
      scanningLabel="Plaka okunuyor…"
      onScan={scan}
      onDetected={onDetected}
      onClose={onClose}
    />
  )
}
