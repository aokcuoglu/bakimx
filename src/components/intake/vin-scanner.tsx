"use client"

import { useCallback, useState } from "react"
import { CameraScanner } from "@/components/shared/camera-scanner"
import { postImageScan, ScanError, type ScanImagePayload } from "@/lib/ocr/scan-client"
import { AlertTriangle } from "lucide-react"

type Props = {
  onDetected: (vin: string) => void
  onClose: () => void
}

type VinScanResponse = { vin?: string; provider?: string; confident?: boolean }

/**
 * Şase (VIN) tarayıcı: ön camın altındaki şase plakasını kamerayla okur (#188).
 * Ortak kamera kabuğunu kullanır; rehber penceresi VIN'in tek satırlık uzun
 * şeridine göre incedir. Çekilen kare /api/vin/scan'e gider.
 *
 * Plakadan farkı: 17 hane gözle kolay karışır (5/S, 8/B) ve yanlış bir VIN sessizce
 * yanlış araca/parça kataloğuna bağlanır. Bu yüzden okuma doğrudan uygulanmaz;
 * kullanıcı önce camdaki numarayla karşılaştırıp onaylar.
 */
export function VinScanner({ onDetected, onClose }: Props) {
  const [meta, setMeta] = useState<{ demo: boolean; confident: boolean }>({ demo: false, confident: true })

  const scan = useCallback(async (payload: ScanImagePayload) => {
    const data = await postImageScan<VinScanResponse>("/api/vin/scan", payload)
    if (!data.vin) throw new ScanError("Şase numarası okunamadı.")
    setMeta({ demo: data.provider === "mock", confident: data.confident !== false })
    return data.vin
  }, [])

  return (
    <CameraScanner
      title="Şaseyi Tara"
      hint="Camdaki şase numarasını çerçeveye sığdırıp çekin"
      frameClassName="aspect-[7/1] w-[92%] max-w-lg"
      scanningLabel="Şase numarası okunuyor…"
      onScan={scan}
      onDetected={onDetected}
      onClose={onClose}
      renderConfirm={(vin) => (
        <div className="w-full space-y-2 text-left">
          <p className="text-xs font-medium uppercase tracking-wide text-white">Okunan şase numarası</p>
          <p className="break-all rounded-lg bg-white/10 px-3 py-3 text-center font-mono text-lg font-semibold tracking-[0.15em] text-white">
            {vin}
          </p>
          <p className="text-xs text-white">Camdaki numarayla karşılaştırın; farklıysa tekrar çekin.</p>
          {!meta.confident && (
            <p className="flex items-start gap-1.5 text-xs text-warning-strong">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              Bazı haneler net okunamadı — onaylamadan önce mutlaka kontrol edin.
            </p>
          )}
          {meta.demo && (
            <p className="flex items-start gap-1.5 text-xs text-warning-strong">
              <AlertTriangle className="mt-px size-3.5 shrink-0" />
              Demo modu: bu numara fotoğraftan değil, örnek veriden geldi.
            </p>
          )}
        </div>
      )}
    />
  )
}
