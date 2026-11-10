"use client"

import { AlertTriangle, Camera, CheckCircle2, Images, Link2, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"

type PhotoCompletionBarProps = {
  percentage: number
  requiredCompleted: number
  required: number
  total: number
  completed: number
  missing: string[]
  missingLabels: string[]
  onMissingClick?: (key: string) => void
}

export function PhotoCompletionBar({
  percentage,
  requiredCompleted,
  required,
  total,
  completed,
  missing,
  missingLabels,
  onMissingClick,
}: PhotoCompletionBarProps) {
  const isComplete = requiredCompleted === required

  return (
    <section aria-label="Fotoğraf durumu" className="min-w-0 space-y-4">
      <div className="flex items-start justify-between gap-4">
        <div className="space-y-1">
          <p className="text-sm font-medium text-foreground">Zorunlu fotoğraflar</p>
          <p className="text-xs text-muted-foreground">
            {requiredCompleted}/{required} zorunlu açı · Toplam {completed}/{total} fotoğraf
          </p>
        </div>
        <span className="text-xl font-semibold tabular-nums text-foreground">{percentage}%</span>
      </div>

      <div
        role="progressbar"
        aria-label="Zorunlu fotoğraf tamamlanma oranı"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percentage}
        className="h-1.5 overflow-hidden rounded-full bg-muted"
      >
        <div
          className={`h-full rounded-full ${isComplete ? "bg-success" : "bg-primary"}`}
          style={{ width: `${percentage}%` }}
        />
      </div>

      {missingLabels.length > 0 ? (
        <div className="space-y-2">
          <p className="flex items-center gap-1.5 text-xs text-warning-strong">
            <AlertTriangle className="size-3.5" aria-hidden="true" />
            Eksik açıları ekleyin
          </p>
          <div className="flex flex-wrap gap-2">
            {missingLabels.map((label, index) => (
              <Button
                key={missing[index]}
                type="button"
                variant="outline"
                size="xs"
                onClick={() => onMissingClick?.(missing[index])}
                aria-label={`${label} fotoğrafını ekle`}
              >
                <Camera className="size-3" aria-hidden="true" />
                {label}
              </Button>
            ))}
          </div>
        </div>
      ) : (
        <p className="flex items-center gap-1.5 text-xs text-success-strong">
          <CheckCircle2 className="size-3.5" aria-hidden="true" />
          Tüm zorunlu açılar tamamlandı
        </p>
      )}
    </section>
  )
}

type IntakeEvidenceSummaryProps = {
  photoCompletion: Omit<PhotoCompletionBarProps, "onMissingClick">
  damageCount: number
  approvalStatus: "none" | "pending" | "verified"
  publicLinkStatus: "none" | "active" | "expired"
  onMissingPhotoClick?: (key: string) => void
}

export function IntakeEvidenceSummary({
  photoCompletion,
  damageCount,
  approvalStatus,
  publicLinkStatus,
  onMissingPhotoClick,
}: IntakeEvidenceSummaryProps) {
  const approvalText = approvalStatus === "verified" ? "Onaylandı" : approvalStatus === "pending" ? "Bekleniyor" : "Henüz yok"
  const linkText = publicLinkStatus === "active" ? "Aktif" : publicLinkStatus === "expired" ? "Süresi doldu" : "Oluşturulmadı"

  return (
    <div className="grid gap-5 lg:grid-cols-[minmax(0,1.2fr)_minmax(220px,1fr)] lg:gap-6">
      <PhotoCompletionBar {...photoCompletion} onMissingClick={onMissingPhotoClick} />

      <dl className="divide-y divide-border border-t border-border lg:border-t-0 lg:border-l lg:pl-6">
        <div className="flex items-center justify-between gap-4 py-2 first:pt-0">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <Images className="size-3.5" aria-hidden="true" />
            Hasar fotoğrafı
          </dt>
          <dd className="text-sm font-medium tabular-nums text-foreground">{damageCount} kayıt</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <ShieldCheck className="size-3.5" aria-hidden="true" />
            Müşteri onayı
          </dt>
          <dd className="text-sm font-medium text-foreground">{approvalText}</dd>
        </div>
        <div className="flex items-center justify-between gap-4 py-2 last:pb-0">
          <dt className="flex items-center gap-2 text-xs text-muted-foreground">
            <Link2 className="size-3.5" aria-hidden="true" />
            Müşteri bağlantısı
          </dt>
          <dd className="text-sm font-medium text-foreground">{linkText}</dd>
        </div>
      </dl>
    </div>
  )
}
