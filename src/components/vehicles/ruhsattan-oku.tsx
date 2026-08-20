"use client"

import { useRef, useState } from "react"
import { Button } from "@/components/ui/button"
import { Camera, Loader2, ScanLine, Upload } from "lucide-react"
import { RegistrationScanner } from "@/components/intake/registration-scanner"
import { prepareRegistrationImage } from "@/lib/ocr/prepare-registration-image"

// Fields the ruhsat OCR can return. Matches /api/smart-capture/ocr → RegistrationOcrResult.
// Claude Vision OCR now also reads the technical fields (D.3 / P.3 / P.1 / P.2 / Z.2).
export type RuhsattanOkuValues = {
  plate: string
  brand: string
  model: string
  vehicleType: string
  modelYear: string
  vin: string
  engineNo: string
  registrationDate: string
  commercialName: string
  fuelType: string
  engineDisplacement: string
  enginePower: string
  inspectionValidUntil: string
}

export type RuhsattanOkuResult = {
  values: RuhsattanOkuValues
  confidence: Record<keyof RuhsattanOkuValues, number | undefined>
  /**
   * Ruhsat sahibi. Kurumsal (yalnız C.1.1 Ticari Ünvan dolu, C.1.2 ADI boş) ise
   * `isCorporate` true olur ve `companyName` dolar; bireysel ise firstName/lastName.
   * `label` her iki durumda gösterime uygun tam ad. Hepsi ipucu, hazır müşteri değil.
   */
  owner: {
    isCorporate: boolean
    firstName: string
    lastName: string
    companyName: string
    label: string
  }
}

type Props = {
  /** Called once OCR succeeds, with the parsed fields, per-field confidence and an owner hint. */
  onResult: (result: RuhsattanOkuResult) => void
  /** Lets a hosting Dialog know the full-screen scanner is open (to guard outside-press/Esc dismissal). */
  onScannerOpenChange?: (open: boolean) => void
  title?: string
  description?: string
  className?: string
  /**
   * `hero`: sihirbazın ruhsat adımı için tam genişlikte, sürükle-bırak kabul eden
   * büyük yükleme alanı (#309 — dar şerit yüzünden ruhsat yükleme yeri bulunamıyordu).
   * `inline` (varsayılan): form içine sıkışan ince şerit.
   */
  variant?: "inline" | "hero"
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
  variant = "inline",
}: Props) {
  const [scannerOpen, setScannerOpen] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState("")
  const [dragging, setDragging] = useState(false)
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
        commercialName: v("commercialName"),
        fuelType: v("fuelType"),
        engineDisplacement: v("engineDisplacement"),
        enginePower: v("enginePower"),
        inspectionValidUntil: v("inspectionValidUntil"),
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
        commercialName: r.commercialName?.confidence,
        fuelType: r.fuelType?.confidence,
        engineDisplacement: r.engineDisplacement?.confidence,
        enginePower: r.enginePower?.confidence,
        inspectionValidUntil: r.inspectionValidUntil?.confidence,
      }
      // C.1.2 ADI + C.1.1 SOYADI/TİCARİ ÜNVANI. ADI boşsa sahip kurumsaldır → ünvanı şirket adı say.
      const adi = v("ownerName")
      const soyadi = v("ownerSurname")
      const isCorporate = !adi && !!soyadi
      const owner = {
        isCorporate,
        firstName: isCorporate ? "" : adi,
        lastName: isCorporate ? "" : soyadi,
        companyName: isCorporate ? soyadi : "",
        label: isCorporate ? soyadi : [adi, soyadi].filter(Boolean).join(" ").trim(),
      }
      onResult({ values, confidence, owner })
    } catch (err) {
      setError(err instanceof Error ? err.message : "Ruhsat okuma sırasında hata oluştu")
    } finally {
      setBusy(false)
    }
  }

  const fileInput = (
    <input
      ref={fileInputRef}
      type="file"
      accept={ACCEPT}
      className="hidden"
      onChange={(e) => { const f = e.target.files?.[0]; if (f) runOcr(f); e.target.value = "" }}
    />
  )

  if (variant === "hero") {
    return (
      <div
        className={`rounded-xl border-2 border-dashed p-6 text-center transition-colors sm:p-10 ${
          dragging ? "border-primary bg-primary/10" : "border-primary/30 bg-primary/5"
        } ${className}`.trim()}
        onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault()
          setDragging(false)
          const f = e.dataTransfer.files?.[0]
          if (f) runOcr(f)
        }}
      >
        {scannerOpen && (
          <RegistrationScanner
            onCapture={(file) => { openScanner(false); runOcr(file) }}
            onClose={() => openScanner(false)}
          />
        )}

        {busy ? (
          <div className="flex flex-col items-center gap-3 py-6">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-sm font-medium text-foreground">Ruhsat okunuyor…</p>
            <p className="text-xs text-muted-foreground">Alanlar otomatik dolacak, sonra kontrol edeceksiniz.</p>
          </div>
        ) : (
          <div className="flex flex-col items-center gap-4">
            <span className="flex size-16 items-center justify-center rounded-2xl bg-primary/10 text-primary-strong">
              <ScanLine className="size-8" />
            </span>
            <div className="space-y-1">
              <p className="text-base font-semibold text-foreground">{title}</p>
              <p className="text-sm text-muted-foreground">{description}</p>
            </div>
            <div className="flex w-full max-w-sm flex-col gap-2 sm:flex-row">
              <Button type="button" className="flex-1 gap-2" onClick={() => openScanner(true)}>
                <Camera className="size-4" /> Kamera ile çek
              </Button>
              <Button type="button" variant="outline" className="flex-1 gap-2" onClick={() => fileInputRef.current?.click()}>
                <Upload className="size-4" /> Dosyadan seç
              </Button>
            </div>
            <p className="hidden text-xs text-muted-foreground sm:block">
              Ruhsat fotoğrafını bu alana sürükleyip bırakabilirsiniz.
            </p>
          </div>
        )}
        {fileInput}
        {error && <p className="mt-3 text-sm text-destructive-strong">{error}</p>}
      </div>
    )
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
          {fileInput}
        </>
      )}

      {error && <p className="text-xs text-destructive-strong">{error}</p>}
    </div>
  )
}
