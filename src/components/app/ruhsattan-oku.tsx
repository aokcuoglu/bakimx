"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, ScanLine, Upload } from "lucide-react"
import { RegistrationScanner } from "./registration-scanner"
import { prepareRegistrationImage } from "@/lib/ocr/prepare-registration-image"

// Fields the ruhsat OCR can return. Matches /api/smart-capture/ocr → RegistrationOcrResult.
// Note: commercialName, fuelType, engineDisplacement, enginePower and inspectionValidUntil
// are NOT read by OCR (manual only), so they are intentionally absent here.
export type RuhsattanOkuValues = {
  plate: string
  brand: string
  model: string
  vehicleType: string
  modelYear: string
  vin: string
  engineNo: string
  registrationDate: string
}

export type RuhsattanOkuResult = {
  values: RuhsattanOkuValues
  confidence: Record<keyof RuhsattanOkuValues, number | undefined>
  /** "Ad Soyad" of the ruhsat owner, when readable — a hint, not a created customer. */
  ownerName: string
}

type Props = {
  /** Called once OCR succeeds, with the parsed fields, per-field confidence and an owner hint. */
  onResult: (result: RuhsattanOkuResult) => void
  /** Lets a hosting Dialog know the full-screen scanner is open (to guard outside-press/Esc dismissal). */
  onScannerOpenChange?: (open: boolean) => void
  title?: string
  description?: string
  className?: string
}

const ACCEPT = "image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"

/**
 * Shared "Ruhsattan Oku" control: scan or upload a vehicle registration, run OCR,
 * and hand the parsed fields back to the caller. The caller decides what to do with
 * them (prefill a form, create a customer + vehicle, …) — this component owns only
 * the capture + OCR mechanics so both call sites behave identically.
 */
export function RuhsattanOku({
  onResult,
  onScannerOpenChange,
  title = "Ruhsattan otomatik doldur",
  description = "Tarayın; alanlar otomatik dolsun, sonra kontrol edin.",
  className = "",
}: Props) {
  const [scannerOpen, setScannerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const fileInputRef = useRef<HTMLInputElement>(null)

  function openScanner(open: boolean) {
    setScannerOpen(open)
    onScannerOpenChange?.(open)
  }

  async function runOcr(file: File) {
    setError("")
    setBusy(true)
    try {
      const prepared = await prepareRegistrationImage(file)
      const dataUrl = await new Promise<string>((resolve, reject) => {
        const reader = new FileReader()
        reader.onload = () => resolve(reader.result as string)
        reader.onerror = () => reject(new Error("Görsel okunamadı"))
        reader.readAsDataURL(prepared)
      })

      const res = await fetch("/api/smart-capture/ocr", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ imageDataUrl: dataUrl, mimeType: prepared.type }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "Ruhsat okunamadı")
        return
      }

      const r = data.result as Record<string, { value: string; confidence?: number }>
      const v = (k: string) => (r[k]?.value || "").trim()
      const values: RuhsattanOkuValues = {
        plate: v("plate").toUpperCase(),
        brand: v("brand"),
        model: v("model"),
        vehicleType: v("vehicleType"),
        modelYear: v("modelYear"),
        vin: v("vin").toUpperCase(),
        engineNo: v("engineNo").toUpperCase(),
        registrationDate: v("registrationDate"),
      }
      const confidence = {
        plate: r.plate?.confidence,
        brand: r.brand?.confidence,
        model: r.model?.confidence,
        vehicleType: r.vehicleType?.confidence,
        modelYear: r.modelYear?.confidence,
        vin: r.vin?.confidence,
        engineNo: r.engineNo?.confidence,
        registrationDate: r.registrationDate?.confidence,
      }
      const ownerName = [v("ownerName"), v("ownerSurname")].filter(Boolean).join(" ").trim()
      onResult({ values, confidence, ownerName })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ruhsat okuma sırasında hata oluştu")
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className={`rounded-lg border border-primary/20 bg-primary/5 p-3 space-y-2 ${className}`.trim()}>
      {scannerOpen && (
        <RegistrationScanner
          onCapture={(file) => { openScanner(false); runOcr(file) }}
          onClose={() => openScanner(false)}
        />
      )}

      <div className="flex items-center gap-2 text-sm font-medium text-primary">
        <ScanLine className="size-4" /> {title}
      </div>

      {busy ? (
        <div className="flex items-center gap-2 py-1 text-sm text-muted-foreground">
          <Loader2 className="size-4 animate-spin" /> Ruhsat okunuyor…
        </div>
      ) : (
        <>
          <p className="text-xs text-muted-foreground">{description}</p>
          <div className="flex gap-2">
            <Button type="button" size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => openScanner(true)}>
              <Camera className="size-4" /> Kamera
            </Button>
            <Button type="button" size="sm" variant="outline" className="flex-1 gap-1.5" onClick={() => fileInputRef.current?.click()}>
              <Upload className="size-4" /> Dosyadan
            </Button>
          </div>
          <input
            ref={fileInputRef}
            type="file"
            accept={ACCEPT}
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) runOcr(f); e.target.value = "" }}
          />
        </>
      )}

      {error && <p className="text-xs text-destructive">{error}</p>}
    </div>
  )
}
