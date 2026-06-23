"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Camera, Upload, Loader2, CheckCircle2, AlertTriangle, ScanLine, ArrowRight, User, Car, ClipboardList, Info } from "lucide-react"
import type { OcrFieldConfidence, OcrProviderName } from "@/lib/ocr/types"
import { LOW_CONFIDENCE_THRESHOLD } from "@/lib/ocr/types"
import { prepareRegistrationImage } from "@/lib/ocr/prepare-registration-image"

type Step = "upload" | "processing" | "confirm" | "saving"

const LOADING_STEPS: Step[] = ["saving"]

const PROVIDER_LABELS: Record<OcrProviderName, string> = {
  mock: "Demo (Mock)",
  openai: "OpenAI Vision",
  deepseek: "Tesseract + DeepSeek",
  tesseract: "Tesseract (Yerel)",
}

type SaveResult = {
  customerId: string
  vehicleId: string
  customerCreated: boolean
  vehicleCreated: boolean
  vehicleCustomerChanged: boolean
  customerName: string
  vehicleLabel: string
  intakeUrl: string
  warnings?: string[]
}

type FieldConfig = {
  key: string
  label: string
  required?: boolean
  placeholder?: string
  uppercase?: boolean
  helperText?: string
}

const FIELD_CONFIGS: FieldConfig[] = [
  { key: "plate", label: "Plaka", required: true, uppercase: true },
  { key: "vin", label: "Şase No (VIN)" },
  { key: "ownerName", label: "Araç Sahibi Adı" },
  { key: "ownerSurname", label: "Araç Sahibi Soyadı" },
  { key: "phone", label: "Müşteri Telefonu", required: true, placeholder: "0555 123 4567", helperText: "Mevcut müşteri bu numarayla bulunur; yoksa Müşteriler bölümünde yeni kayıt oluşturulur." },
  { key: "brand", label: "Marka", required: true },
  { key: "model", label: "Model", required: true },
  { key: "vehicleType", label: "Araç Tipi" },
  { key: "modelYear", label: "Model Yılı" },
  { key: "engineNo", label: "Motor No" },
  { key: "registrationDate", label: "Tescil Tarihi" },
]

function ConfidenceIndicator({ confidence }: { confidence?: number }) {
  if (confidence === undefined || confidence === null) return null
  const isLow = confidence < LOW_CONFIDENCE_THRESHOLD
  const pct = Math.round(confidence * 100)
  return (
    <span
      className={`ml-2 inline-flex items-center gap-0.5 text-xs font-medium text-foreground`}
      title={`Güven: %${pct}`}
    >
      {isLow && <AlertTriangle className="size-3 text-warning" />}
      %{pct}
    </span>
  )
}

export function SmartCaptureRegistration() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("upload")
  const [error, setError] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<Record<string, OcrFieldConfidence> | null>(null)
  const [ocrLogId, setOcrLogId] = useState<string | null>(null)
  const [ocrProvider, setOcrProvider] = useState<OcrProviderName | null>(null)
  const [confirmedFields, setConfirmedFields] = useState<Record<string, string>>({})
  const [saveResult, setSaveResult] = useState<SaveResult | null>(null)

  async function handleFileSelected(file: File) {
    setError("")
    setStep("processing")

    let preparedFile: File
    try {
      preparedFile = await prepareRegistrationImage(file)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Görsel hazırlanamadı")
      setStep("upload")
      return
    }

    const reader = new FileReader()
    reader.onload = async () => {
      const dataUrl = reader.result as string
      if (preparedFile.type !== "image/heic" && preparedFile.type !== "image/heif") {
        setImagePreview(dataUrl)
      }

      try {
        const res = await fetch("/api/smart-capture/ocr", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            imageDataUrl: dataUrl,
            mimeType: preparedFile.type,
          }),
        })

        const data = await res.json()

        if (!res.ok) {
          setError(data.error || "OCR işlemi başarısız oldu")
          setStep("upload")
          return
        }

        setOcrResult(data.result)
        setOcrLogId(data.ocrLogId)
        setOcrProvider(data.provider || null)
        if (data.previewDataUrl) {
          setImagePreview(data.previewDataUrl)
        }
        setConfirmedFields({
          plate: data.result.plate.value,
          vin: data.result.vin.value,
          ownerName: data.result.ownerName.value,
          ownerSurname: data.result.ownerSurname.value,
          phone: "",
          brand: data.result.brand.value,
          model: data.result.model.value,
          vehicleType: data.result.vehicleType.value,
          modelYear: data.result.modelYear.value,
          engineNo: data.result.engineNo.value,
          registrationDate: data.result.registrationDate.value,
        })
        setStep("confirm")
      } catch {
        setError("Bağlantı hatası. Lütfen tekrar deneyin.")
        setStep("upload")
      }
    }
    reader.onerror = () => {
      setError("Görsel dosyası okunamadı")
      setStep("upload")
    }
    reader.readAsDataURL(preparedFile)
  }

  function handleInputChange(field: string, value: string) {
    setConfirmedFields((prev) => ({ ...prev, [field]: value }))
  }

  async function handleConfirm() {
    setStep("saving")
    setError("")

    try {
      const res = await fetch("/api/smart-capture/confirm", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ocrLogId,
          confirmedFields,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        setError(data.error || "Kayıt sırasında hata oluştu")
        setStep("confirm")
        return
      }

      setSaveResult(data)
      setStep("confirm")
    } catch {
      setError("Kayıt sırasında bağlantı hatası")
      setStep("confirm")
    }
  }

  function getFieldConfidence(key: string): number | undefined {
    if (!ocrResult || !ocrResult[key]) return undefined
    return ocrResult[key].confidence
  }

  function isLowConfidence(key: string): boolean {
    const conf = getFieldConfidence(key)
    return conf !== undefined && conf !== null && conf < LOW_CONFIDENCE_THRESHOLD
  }

  if (saveResult) {
    return (
      <div className="space-y-5">
        <Card className="border-success/20 bg-success/10">
          <CardContent className="py-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-success/10">
                <CheckCircle2 className="size-7 text-success" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-foreground">Müşteri ve araç hazır</h3>
              <p className="mt-1 text-sm text-muted-foreground">
                Ruhsat bilgileri kaydedildi. Şimdi araç kabul sürecine geçebilirsiniz.
              </p>
            </div>
          </CardContent>
        </Card>

        {saveResult.warnings && saveResult.warnings.length > 0 && (
          <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 space-y-1">
            {saveResult.warnings.map((w, i) => (
              <p key={i} className="text-sm text-foreground flex items-start gap-2">
                <AlertTriangle className="size-4 text-warning shrink-0 mt-0.5" />
                {w}
              </p>
            ))}
          </div>
        )}

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="flex items-start gap-3 py-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <User className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Müşteri</p>
                <p className="mt-1 font-semibold text-foreground">{saveResult.customerName}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {saveResult.customerCreated ? "Müşteriler bölümüne yeni kayıt eklendi." : "Mevcut müşteri kaydı kullanıldı."}
                </p>
                <Link href={`/customers/${saveResult.customerId}`} className="mt-3 inline-flex text-sm font-medium text-primary hover:text-primary/80">
                  Müşteriyi görüntüle
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 py-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                <Car className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">Araç</p>
                <p className="mt-1 font-semibold text-foreground">{saveResult.vehicleLabel}</p>
                <p className="mt-1 text-xs text-muted-foreground">
                  {saveResult.vehicleCreated
                    ? "Araçlar bölümüne yeni kayıt eklendi."
                    : saveResult.vehicleCustomerChanged
                      ? "Mevcut araç bilgileri ve müşteri bağlantısı güncellendi."
                      : "Mevcut araç bilgileri güncellendi."}
                </p>
                <Link href={`/vehicles/${saveResult.vehicleId}`} className="mt-3 inline-flex text-sm font-medium text-primary hover:text-primary/80">
                  Aracı görüntüle
                </Link>
              </div>
            </CardContent>
          </Card>
        </div>

        <Card>
          <CardContent className="py-6">
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
                  <ClipboardList className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-foreground">Sıradaki adım: Araç kabulü</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">
                    Kilometre, müşteri şikayeti, fotoğraflar, hasar ve onay bilgilerini tamamlayın.
                  </p>
                </div>
              </div>
              <Button
                nativeButton={false}
                render={<Link href={saveResult.intakeUrl} />}
                className="h-11 shrink-0 gap-2"
              >
                Araç Kabulüne Devam Et
                <ArrowRight className="size-4" />
              </Button>
            </div>
          </CardContent>
        </Card>

        <Button
          variant="outline"
          onClick={() => {
            setSaveResult(null)
            setStep("upload")
            setImagePreview(null)
            setOcrResult(null)
            setOcrLogId(null)
            setOcrProvider(null)
            setConfirmedFields({})
          }}
        >
          Yeni Ruhsat Oku
        </Button>
      </div>
    )
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault()
    const file = e.dataTransfer.files[0]
    if (file) handleFileSelected(file)
  }

  if (step === "processing") {
    return (
      <Card>
        <CardContent className="py-16">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="size-16 rounded-full bg-primary/10 text-primary flex items-center justify-center animate-pulse">
              <ScanLine className="size-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-foreground">Ruhsat okunuyor...</h3>
              <p className="text-sm text-muted-foreground mt-1">Lütfen bekleyin, fotoğraf analiz ediliyor</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if ((step === "confirm" || step === "saving") && ocrResult) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-warning/20 bg-warning/10 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-warning shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-foreground">
              Ruhsat okuma sonucu otomatik öneridir. Lütfen bilgileri kontrol edip onaylayın.
            </p>
            <p className="text-xs text-muted-foreground mt-1">
              Hatalı alanları düzelttikten sonra &quot;Onayla ve Kaydet&quot; butonuna basın.
            </p>
          </div>
        </div>

        {ocrProvider && (
          <div className="rounded-lg border border-primary/20 bg-primary/10 p-3 flex items-center gap-2 text-sm text-foreground">
            <Info className="size-4 text-primary shrink-0" />
            <span>OCR sağlayıcı: <strong>{PROVIDER_LABELS[ocrProvider] || ocrProvider}</strong></span>
          </div>
        )}

        {imagePreview && (
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Yüklenen Ruhsat</CardTitle>
            </CardHeader>
            <CardContent>
              <Image
                src={imagePreview}
                alt="Ruhsat fotoğrafı"
                width={1200}
                height={600}
                unoptimized
                className="max-h-48 rounded-lg border border-border object-contain"
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-foreground" />
              Okunan Bilgiler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              {FIELD_CONFIGS.map((field) => {
                const lowConf = isLowConfidence(field.key)
                return (
                  <div
                    key={field.key}
                    className={`space-y-2 ${field.key === "phone" ? "sm:col-span-2" : ""}`}
                  >
                    <Label htmlFor={field.key} className="flex items-center">
                      {field.label}
                      {field.required && <span className="text-foreground ml-0.5">*</span>}
                      <ConfidenceIndicator confidence={getFieldConfidence(field.key)} />
                    </Label>
                    <Input
                      id={field.key}
                      type={field.key === "phone" ? "tel" : "text"}
                      inputMode={field.key === "phone" ? "tel" : undefined}
                      value={confirmedFields[field.key] || ""}
                      onChange={(e) => handleInputChange(field.key, field.uppercase ? e.target.value.toUpperCase() : e.target.value)}
                      placeholder={field.placeholder}
                      required={field.required}
                      className={lowConf ? "border-warning/30 bg-warning/10 focus:border-warning" : ""}
                    />
                    {field.helperText && (
                      <p className="text-xs text-muted-foreground">{field.helperText}</p>
                    )}
                    {lowConf && (
                      <p className="text-xs text-foreground flex items-center gap-1">
                        <AlertTriangle className="size-3 text-warning" />
                        Düşük güven oranı — lütfen bu alanı dikkatle kontrol edin
                      </p>
                    )}
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-foreground text-sm">{error}</div>
        )}

        <div className="flex flex-col sm:flex-row gap-3">
          <Button
            onClick={handleConfirm}
            disabled={LOADING_STEPS.includes(step) || (confirmedFields.phone || "").replace(/\D/g, "").length < 10}
            className="gap-2"
          >
            {LOADING_STEPS.includes(step) ? (
              <>
                <Loader2 className="size-4 animate-spin" />
                Kaydediliyor...
              </>
            ) : (
              <>
                Onayla ve Kaydet
                <ArrowRight className="size-4" />
              </>
            )}
          </Button>
          <Button
            variant="outline"
            disabled={LOADING_STEPS.includes(step)}
            onClick={() => {
              setStep("upload")
              setImagePreview(null)
              setOcrResult(null)
            }}
          >
            Yeniden Oku
          </Button>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-5">
      {error && (
        <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-foreground text-sm">{error}</div>
      )}

      <Card>
        <CardContent className="py-8">
          <div
            className="flex flex-col items-center gap-4 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div
              className="w-full max-w-md rounded-lg border-2 border-dashed border-border bg-muted/50 p-8 cursor-pointer hover:border-primary/40 hover:bg-primary/5 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="size-14 rounded-full bg-primary/10 text-primary flex items-center justify-center">
                  <Camera className="size-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">Fotoğraf çekin veya yükleyin</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    Araç ruhsatının ön yüzünü net bir şekilde çekin
                  </p>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelected(file)
              }}
            />

            <div className="flex items-center gap-3 w-full max-w-md">
              <div className="flex-1 h-px bg-border" />
              <span className="text-xs text-muted-foreground/70">veya</span>
              <div className="flex-1 h-px bg-border" />
            </div>

            <Button
              variant="outline"
              className="gap-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="size-4" />
              Dosyadan Yükle
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-sm font-semibold">Bilgilendirme</CardTitle>
        </CardHeader>
        <CardContent className="space-y-2 text-sm text-muted-foreground">
          <div className="flex items-start gap-2">
            <ScanLine className="size-4 text-muted-foreground/70 mt-0.5 shrink-0" />
            <span>OCR ile ruhsat bilgileri otomatik okunur ve önerilir.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-muted-foreground/70 mt-0.5 shrink-0" />
            <span>Okunan bilgiler kaydedilmeden önce onayınıza sunulur.</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-muted-foreground/70 mt-0.5 shrink-0" />
            <span>Otomatik okuma hatalı olabilir. Lütfen tüm alanları kontrol edin.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}