"use client"

import { useCallback, useRef } from "react"
import { ScanLine } from "lucide-react"
import { CameraScanner } from "@/components/shared/camera-scanner"
import { postImageScan, ScanError, type ScanImagePayload } from "@/lib/ocr/scan-client"
import {
  hasRegistrationData,
  parseRegistrationOcr,
  type RegistrationOcrFields,
  type RuhsattanOkuResult,
} from "@/lib/ocr/registration-form-values"

type Props = {
  /** Ruhsat okundu: alanlar, güven skorları ve sahip ipucu. */
  onResult: (result: RuhsattanOkuResult) => void
  onClose: () => void
  /** "El ile gir": kamera kapanır, çağıran ruhsat alanlarını elle girilecek şekilde açar. */
  onManualEntry?: () => void
}

/**
 * Tam ekran ruhsat kamerası. Araç Kabul'deki "Aracı Çek" ile AYNI kabuğu
 * (`CameraScanner`) kullanır: canlı arka kamera, ortada deklanşör, solda
 * "El ile gir", sağda "Dosyadan". Çekilen kare ruhsat OCR'ına
 * (/api/smart-capture/ocr) gider; okunan alanlar çağırana verilir ve orada
 * kontrol edilir — bu yüzden tarayıcıda ayrıca onay adımı yoktur.
 */
export function RegistrationCameraScanner({ onResult, onClose, onManualEntry }: Props) {
  // CameraScanner yalnız bir metin değeri taşır; tam okuma burada tutulur.
  const lastResult = useRef<RuhsattanOkuResult | null>(null)

  const scan = useCallback(async (payload: ScanImagePayload) => {
    lastResult.current = null
    const data = await postImageScan<{ result?: RegistrationOcrFields }>("/api/smart-capture/ocr", payload)
    const parsed = data.result ? parseRegistrationOcr(data.result) : null
    if (!parsed || !hasRegistrationData(parsed)) {
      throw new ScanError("Ruhsat okunamadı. Ruhsatın tamamı kadrajda ve yazılar net olacak şekilde tekrar çekin.")
    }
    lastResult.current = parsed
    return parsed.values.plate || "ok"
  }, [])

  return (
    <CameraScanner
      title="Ruhsatı Çek"
      guide={<RegistrationCaptureGuide />}
      scanningLabel="Ruhsat okunuyor…"
      onScan={scan}
      onDetected={() => { if (lastResult.current) onResult(lastResult.current) }}
      onClose={onClose}
      onManualEntry={onManualEntry}
    />
  )
}

/** Alt yönerge kartı — plaka tarayıcısındaki kartla aynı görünüm. */
function RegistrationCaptureGuide() {
  return (
    <div className="mx-auto max-w-md rounded-xl bg-black/70 p-3 text-white ring-1 ring-white/15 backdrop-blur-md">
      <div className="flex items-center gap-3">
        <span className="flex size-14 shrink-0 items-center justify-center rounded-md bg-white/10 ring-1 ring-white/20">
          <ScanLine className="size-7" />
        </span>
        <div className="min-w-0">
          <p className="text-lg leading-tight font-semibold">Ruhsatı çekin</p>
          <p className="mt-1 text-sm leading-snug text-white">
            Ruhsatın tamamı kadrajda, yazılar net görünsün.
          </p>
        </div>
      </div>
    </div>
  )
}
