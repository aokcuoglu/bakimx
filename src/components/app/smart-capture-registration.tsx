"use client"

import { useState, useRef } from "react"
import Image from "next/image"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import Link from "next/link"
import { Camera, Upload, Loader2, CheckCircle2, AlertTriangle, ScanLine, ArrowRight, User, Car, ClipboardList } from "lucide-react"
import type { RegistrationOcrResult } from "@/lib/ocr/types"
import { prepareRegistrationImage } from "@/lib/ocr/prepare-registration-image"

type Step = "upload" | "processing" | "confirm" | "saving"

const LOADING_STEPS: Step[] = ["saving"]

type SaveResult = {
  customerId: string
  vehicleId: string
  customerCreated: boolean
  vehicleCreated: boolean
  vehicleCustomerChanged: boolean
  customerName: string
  vehicleLabel: string
  intakeUrl: string
}

export function SmartCaptureRegistration() {
  const fileInputRef = useRef<HTMLInputElement>(null)
  const [step, setStep] = useState<Step>("upload")
  const [error, setError] = useState("")
  const [imagePreview, setImagePreview] = useState<string | null>(null)
  const [ocrResult, setOcrResult] = useState<RegistrationOcrResult | null>(null)
  const [ocrLogId, setOcrLogId] = useState<string | null>(null)
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

  if (saveResult) {
    return (
      <div className="space-y-5">
        <Card className="border-emerald-200 bg-emerald-50/40">
          <CardContent className="py-8">
            <div className="mx-auto max-w-2xl text-center">
              <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-emerald-100 text-emerald-700">
                <CheckCircle2 className="size-7" />
              </div>
              <h3 className="mt-4 text-xl font-bold text-slate-900">Müşteri ve araç hazır</h3>
              <p className="mt-1 text-sm text-slate-600">
                Ruhsat bilgileri kaydedildi. Şimdi araç kabul sürecine geçebilirsiniz.
              </p>
            </div>
          </CardContent>
        </Card>

        <div className="grid gap-4 md:grid-cols-2">
          <Card>
            <CardContent className="flex items-start gap-3 py-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <User className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Müşteri</p>
                <p className="mt-1 font-semibold text-slate-900">{saveResult.customerName}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {saveResult.customerCreated ? "Müşteriler bölümüne yeni kayıt eklendi." : "Mevcut müşteri kaydı kullanıldı."}
                </p>
                <Link href={`/app/customers/${saveResult.customerId}`} className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
                  Müşteriyi görüntüle
                </Link>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardContent className="flex items-start gap-3 py-5">
              <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-600">
                <Car className="size-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-medium uppercase tracking-wide text-slate-500">Araç</p>
                <p className="mt-1 font-semibold text-slate-900">{saveResult.vehicleLabel}</p>
                <p className="mt-1 text-xs text-slate-500">
                  {saveResult.vehicleCreated
                    ? "Araçlar bölümüne yeni kayıt eklendi."
                    : saveResult.vehicleCustomerChanged
                      ? "Mevcut araç bilgileri ve müşteri bağlantısı güncellendi."
                      : "Mevcut araç bilgileri güncellendi."}
                </p>
                <Link href={`/app/vehicles/${saveResult.vehicleId}`} className="mt-3 inline-flex text-sm font-medium text-blue-600 hover:text-blue-700">
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
                <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-violet-50 text-violet-600">
                  <ClipboardList className="size-5" />
                </div>
                <div>
                  <p className="font-semibold text-slate-900">Sıradaki adım: Araç kabulü</p>
                  <p className="mt-0.5 text-sm text-slate-500">
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
            <div className="size-16 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center animate-pulse">
              <ScanLine className="size-8" />
            </div>
            <div>
              <h3 className="text-lg font-semibold text-slate-900">Ruhsat okunuyor...</h3>
              <p className="text-sm text-slate-500 mt-1">Lütfen bekleyin, fotoğraf analiz ediliyor</p>
            </div>
          </div>
        </CardContent>
      </Card>
    )
  }

  if ((step === "confirm" || step === "saving") && ocrResult) {
    return (
      <div className="space-y-5">
        <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 flex items-start gap-3">
          <AlertTriangle className="size-5 text-amber-600 shrink-0 mt-0.5" />
          <div>
            <p className="text-sm font-medium text-amber-800">
              Ruhsat okuma sonucu otomatik öneridir. Lütfen bilgileri kontrol edip onaylayın.
            </p>
            <p className="text-xs text-amber-700 mt-1">
              Hatalı alanları düzelttikten sonra &quot;Onayla ve Kaydet&quot; butonuna basın.
            </p>
          </div>
        </div>

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
                className="max-h-48 rounded-lg border border-slate-200 object-contain"
              />
            </CardContent>
          </Card>
        )}

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <CheckCircle2 className="size-4 text-blue-600" />
              Okunan Bilgiler
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="plate">Plaka *</Label>
                <Input
                  id="plate"
                  value={confirmedFields.plate || ""}
                  onChange={(e) => handleInputChange("plate", e.target.value.toUpperCase())}
                  className="uppercase"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vin">Şase No (VIN)</Label>
                <Input
                  id="vin"
                  value={confirmedFields.vin || ""}
                  onChange={(e) => handleInputChange("vin", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerName">Araç Sahibi Adı</Label>
                <Input
                  id="ownerName"
                  value={confirmedFields.ownerName || ""}
                  onChange={(e) => handleInputChange("ownerName", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="ownerSurname">Araç Sahibi Soyadı</Label>
                <Input
                  id="ownerSurname"
                  value={confirmedFields.ownerSurname || ""}
                  onChange={(e) => handleInputChange("ownerSurname", e.target.value)}
                />
              </div>
              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="phone">Müşteri Telefonu *</Label>
                <Input
                  id="phone"
                  type="tel"
                  inputMode="tel"
                  value={confirmedFields.phone || ""}
                  onChange={(e) => handleInputChange("phone", e.target.value)}
                  placeholder="0555 123 4567"
                  required
                />
                <p className="text-xs text-slate-500">
                  Mevcut müşteri bu numarayla bulunur; yoksa Müşteriler bölümünde yeni kayıt oluşturulur.
                </p>
              </div>
              <div className="space-y-2">
                <Label htmlFor="brand">Marka *</Label>
                <Input
                  id="brand"
                  value={confirmedFields.brand || ""}
                  onChange={(e) => handleInputChange("brand", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="model">Model *</Label>
                <Input
                  id="model"
                  value={confirmedFields.model || ""}
                  onChange={(e) => handleInputChange("model", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="vehicleType">Araç Tipi</Label>
                <Input
                  id="vehicleType"
                  value={confirmedFields.vehicleType || ""}
                  onChange={(e) => handleInputChange("vehicleType", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="modelYear">Model Yılı</Label>
                <Input
                  id="modelYear"
                  value={confirmedFields.modelYear || ""}
                  onChange={(e) => handleInputChange("modelYear", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="engineNo">Motor No</Label>
                <Input
                  id="engineNo"
                  value={confirmedFields.engineNo || ""}
                  onChange={(e) => handleInputChange("engineNo", e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="registrationDate">Tescil Tarihi</Label>
                <Input
                  id="registrationDate"
                  value={confirmedFields.registrationDate || ""}
                  onChange={(e) => handleInputChange("registrationDate", e.target.value)}
                />
              </div>
            </div>
          </CardContent>
        </Card>

        {error && (
          <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
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
        <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>
      )}

      <Card>
        <CardContent className="py-8">
          <div
            className="flex flex-col items-center gap-4 text-center"
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleDrop}
          >
            <div
              className="w-full max-w-md rounded-xl border-2 border-dashed border-slate-300 bg-slate-50/50 p-8 cursor-pointer hover:border-blue-400 hover:bg-blue-50/30 transition-colors"
              onClick={() => fileInputRef.current?.click()}
            >
              <div className="flex flex-col items-center gap-3">
                <div className="size-14 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center">
                  <Camera className="size-7" />
                </div>
                <div>
                  <p className="text-sm font-medium text-slate-700">Fotoğraf çekin veya yükleyin</p>
                  <p className="text-xs text-slate-500 mt-1">
                    Araç ruhsatının ön yüzünü net bir şekilde çekin
                  </p>
                </div>
              </div>
            </div>

            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/heic,image/heif,.heic,.heif"
              capture="environment"
              className="hidden"
              onChange={(e) => {
                const file = e.target.files?.[0]
                if (file) handleFileSelected(file)
              }}
            />

            <div className="flex items-center gap-3 w-full max-w-md">
              <div className="flex-1 h-px bg-slate-200" />
              <span className="text-xs text-slate-400">veya</span>
              <div className="flex-1 h-px bg-slate-200" />
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
        <CardContent className="space-y-2 text-sm text-slate-600">
          <div className="flex items-start gap-2">
            <ScanLine className="size-4 text-slate-400 mt-0.5 shrink-0" />
            <span>OCR ile ruhsat bilgileri otomatik okunur ve önerilir.</span>
          </div>
          <div className="flex items-start gap-2">
            <CheckCircle2 className="size-4 text-slate-400 mt-0.5 shrink-0" />
            <span>Okunan bilgiler kaydedilmeden önce onayınıza sunulur.</span>
          </div>
          <div className="flex items-start gap-2">
            <AlertTriangle className="size-4 text-slate-400 mt-0.5 shrink-0" />
            <span>Otomatik okuma hatalı olabilir. Lütfen tüm alanları kontrol edin.</span>
          </div>
        </CardContent>
      </Card>
    </div>
  )
}
