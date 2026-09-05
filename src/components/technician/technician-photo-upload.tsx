"use client"

import { useRef, useState } from "react"
import { useRouter } from "next/navigation"
import { Camera, Plus, Upload } from "lucide-react"
import { toast } from "sonner"

import { BottomSheet } from "@/components/shared/bottom-sheet"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PHOTO_PHASES, PHOTO_TYPES, type PhotoPhaseKey, type PhotoTypeKey } from "@/lib/constants"
import {
  buildPhotoFormData,
  missingRequiredPhotoTypes,
  suggestPhotoPhase,
} from "@/lib/technician/photo-upload"
import { compressImageForUpload } from "@/lib/image/compress-image"

/**
 * Teknisyen ekranında fotoğraf ekleme — iş emri ekranındaki akışın mobil
 * karşılığı. Aynı sunucu yolunu (`/api/intakes/photos` → addPhotoAction)
 * kullanır: atölye izolasyonu, denetim kaydı ve zaman çizelgesi olayı orada
 * üretilir, burada yeni bir yazma yolu açılmaz.
 */
export function TechnicianPhotoUpload({
  intakeFormId,
  orderStatus,
  existingPhotoTypes,
}: {
  intakeFormId: string
  orderStatus: string
  /** İş emrinde hâlihazırda bulunan fotoğrafların türleri (eksik rozetleri için). */
  existingPhotoTypes: string[]
}) {
  const router = useRouter()
  const defaultPhase = suggestPhotoPhase(orderStatus)

  const [open, setOpen] = useState(false)
  const [type, setType] = useState<string>("")
  const [phase, setPhase] = useState<string>(defaultPhase)
  const [note, setNote] = useState("")
  const [file, setFile] = useState<File | null>(null)
  const [previewUrl, setPreviewUrl] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [submitting, setSubmitting] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const missing = missingRequiredPhotoTypes(existingPhotoTypes)

  function resetForm() {
    setType("")
    setPhase(defaultPhase)
    setNote("")
    onPickFile(null)
    setError(null)
  }

  async function onPickFile(next: File | null) {
    if (!next) {
      setPreviewUrl((prev) => {
        if (prev) URL.revokeObjectURL(prev)
        return null
      })
      setFile(null)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    const prepared = await compressImageForUpload(next)
    if (!prepared.ok) {
      toast.error(prepared.error)
      if (fileInputRef.current) fileInputRef.current.value = ""
      return
    }

    setPreviewUrl((prev) => {
      if (prev) URL.revokeObjectURL(prev)
      return URL.createObjectURL(prepared.file)
    })
    setFile(prepared.file)
  }

  function openWith(preselectedType?: PhotoTypeKey) {
    setError(null)
    if (preselectedType) setType(preselectedType)
    setOpen(true)
  }

  async function handleSubmit() {
    if (!type) {
      setError("Fotoğraf türü seçiniz")
      return
    }
    setError(null)
    setSubmitting(true)
    try {
      const res = await fetch("/api/intakes/photos", {
        method: "POST",
        body: buildPhotoFormData({ intakeFormId, type, phase, note, file }),
      })
      const data = await res.json().catch(() => ({}))
      if (!res.ok || data?.error) {
        setError(data?.error || "Fotoğraf eklenemedi")
        return
      }
      const label = PHOTO_TYPES[type as PhotoTypeKey]?.label ?? type
      resetForm()
      setOpen(false)
      toast.success(`${label} fotoğrafı eklendi`)
      router.refresh()
    } catch {
      setError("Bağlantı hatası, lütfen tekrar deneyin")
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="mt-3 space-y-2">
      {missing.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground">Eksik:</span>
          {missing.map((key) => (
            <Button
              key={key}
              type="button"
              variant="outline"
              size="sm"
              onClick={() => openWith(key)}
              className="h-8 rounded-full border-destructive/20 bg-destructive/10 px-2 text-[11px] font-medium text-destructive-strong touch-manipulation"
            >
              <Camera className="size-3" />
              {PHOTO_TYPES[key].label}
            </Button>
          ))}
        </div>
      )}

      <Button
        type="button"
        variant="outline"
        size="lg"
        onClick={() => openWith()}
        className="w-full touch-manipulation"
      >
        <Plus className="size-4" />
        Fotoğraf Ekle
      </Button>

      <BottomSheet
        open={open}
        onOpenChange={(next) => {
          setOpen(next)
          if (!next) resetForm()
        }}
        title="Fotoğraf Ekle"
        description="Çektiğiniz fotoğrafı bu iş emrinin kanıtlarına ekleyin."
        footer={
          <div className="flex gap-2">
            <Button
              type="button"
              size="lg"
              className="flex-1 touch-manipulation"
              disabled={submitting || !type}
              onClick={handleSubmit}
            >
              {submitting ? <BrandSpinner size={16} className="!flex-row !gap-0" /> : <Upload className="size-4" />}
              {submitting ? "Yükleniyor…" : file ? "Yükle ve Kaydet" : "Kayıt Ekle"}
            </Button>
            <Button
              type="button"
              variant="outline"
              size="lg"
              className="touch-manipulation"
              disabled={submitting}
              onClick={() => {
                setOpen(false)
                resetForm()
              }}
            >
              İptal
            </Button>
          </div>
        }
      >
        <div className="space-y-3 py-1">
          {error && (
            <p className="text-sm text-destructive-strong bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-2">
              {error}
            </p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="technician-photo-type">Fotoğraf Türü *</Label>
            <Select value={type} onValueChange={(v) => setType(v)}>
              <SelectTrigger id="technician-photo-type" className="w-full">
                <SelectValue placeholder="Seçiniz..." />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PHOTO_TYPES) as PhotoTypeKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PHOTO_TYPES[key].label} {PHOTO_TYPES[key].required ? "(Zorunlu)" : "(Opsiyonel)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="technician-photo-phase">Aşama</Label>
            <Select value={phase} onValueChange={(v) => setPhase(v)}>
              <SelectTrigger id="technician-photo-phase" className="w-full">
                <SelectValue placeholder="Aşama seçin" />
              </SelectTrigger>
              <SelectContent>
                {(Object.keys(PHOTO_PHASES) as PhotoPhaseKey[]).map((key) => (
                  <SelectItem key={key} value={key}>
                    {PHOTO_PHASES[key].label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label>Fotoğraf Çek / Yükle</Label>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp"
              capture="environment"
              className="hidden"
              onChange={(e) => onPickFile(e.target.files?.[0] ?? null)}
            />
            {previewUrl ? (
              <div className="space-y-2">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img
                  src={previewUrl}
                  alt="Seçilen fotoğraf önizlemesi"
                  className="w-full max-h-48 object-contain rounded-lg border border-border bg-muted"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  className="touch-manipulation"
                  onClick={() => onPickFile(null)}
                >
                  Kaldır
                </Button>
              </div>
            ) : (
              <Button
                type="button"
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                className="h-auto w-full flex-col gap-1.5 border-dashed py-6 text-muted-foreground touch-manipulation"
              >
                <Camera className="size-6" />
                Kamera ile çek veya galeriden seç
              </Button>
            )}
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="technician-photo-note">Not</Label>
            <Input
              id="technician-photo-note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder="Fotoğraf açıklaması..."
            />
          </div>
        </div>
      </BottomSheet>
    </div>
  )
}
