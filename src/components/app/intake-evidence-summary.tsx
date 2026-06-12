"use client"

import { Camera, CheckCircle2, AlertTriangle, XCircle, BarChart3 } from "lucide-react"

type PhotoCompletionBarProps = {
  percentage: number
  requiredCompleted: number
  required: number
  total: number
  completed: number
  missingLabels: string[]
}

export function PhotoCompletionBar({
  percentage,
  requiredCompleted,
  required,
  total,
  completed,
  missingLabels,
}: PhotoCompletionBarProps) {
  const isComplete = percentage === 100
  const colorClass = isComplete
    ? "bg-emerald-500"
    : percentage >= 60
      ? "bg-amber-500"
      : "bg-rose-500"

  const textColorClass = isComplete
    ? "text-emerald-700"
    : percentage >= 60
      ? "text-amber-700"
      : "text-rose-700"

  return (
    <div className="space-y-2">
      <div className="flex items-center justify-between text-sm">
        <span className="font-medium">Fotoğraf Tamamlanma</span>
        <span className={`font-bold ${textColorClass}`}>{percentage}%</span>
      </div>
      <div className="w-full h-2.5 bg-muted rounded-full overflow-hidden">
        <div
          className={`h-full rounded-full transition-all duration-500 ${colorClass}`}
          style={{ width: `${percentage}%` }}
        />
      </div>
      <div className="flex items-center justify-between text-xs text-muted-foreground">
        <span>
          Zorunlu: {requiredCompleted}/{required}
        </span>
        <span>
          Toplam: {completed}/{total}
        </span>
      </div>
      {missingLabels.length > 0 && (
        <div className="space-y-1 pt-1">
          <p className="text-xs font-medium text-rose-600 flex items-center gap-1">
            <AlertTriangle className="size-3" />
            Eksik zorunlu fotoğraflar
          </p>
          <div className="flex flex-wrap gap-1">
            {missingLabels.map((label) => (
              <span
                key={label}
                className="inline-flex items-center gap-1 text-xs bg-rose-50 text-rose-700 px-2 py-0.5 rounded-full border border-rose-200"
              >
                <XCircle className="size-3" />
                {label}
              </span>
            ))}
          </div>
        </div>
      )}
      {isComplete && (
        <div className="flex items-center gap-1 text-xs text-emerald-600">
          <CheckCircle2 className="size-3.5" />
          <span>Tüm zorunlu fotoğraflar tamamlandı</span>
        </div>
      )}
    </div>
  )
}

type IntakeEvidenceSummaryProps = {
  photoCompletion: {
    percentage: number
    requiredCompleted: number
    required: number
    total: number
    completed: number
    missingLabels: string[]
  }
  damageCount: number
  approvalStatus: "none" | "pending" | "verified"
  publicLinkStatus: "none" | "active" | "expired"
}

export function IntakeEvidenceSummary({
  photoCompletion,
  damageCount,
  approvalStatus,
  publicLinkStatus,
}: IntakeEvidenceSummaryProps) {
  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 text-sm font-semibold">
        <BarChart3 className="size-4" />
        Kabul Kanıt Özeti
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <EvidenceStatCard
          icon={Camera}
          label="Fotoğraf"
          value={`${photoCompletion.percentage}%`}
          status={photoCompletion.percentage === 100 ? "success" : photoCompletion.percentage >= 60 ? "warning" : "danger"}
        />
        <EvidenceStatCard
          icon={AlertTriangle}
          label="Hasar"
          value={`${damageCount}`}
          status={damageCount > 0 ? "warning" : "success"}
        />
        <EvidenceStatCard
          icon={CheckCircle2}
          label="Onay"
          value={approvalStatus === "verified" ? "Onaylı" : approvalStatus === "pending" ? "Bekliyor" : "Yok"}
          status={approvalStatus === "verified" ? "success" : approvalStatus === "pending" ? "warning" : "neutral"}
        />
        <EvidenceStatCard
          icon={publicLinkStatus === "active" ? CheckCircle2 : AlertTriangle}
          label="Halka Açık Link"
          value={publicLinkStatus === "active" ? "Aktif" : publicLinkStatus === "expired" ? "Süresi Dolmuş" : "Yok"}
          status={publicLinkStatus === "active" ? "success" : publicLinkStatus === "expired" ? "danger" : "neutral"}
        />
      </div>

      <PhotoCompletionBar
        percentage={photoCompletion.percentage}
        requiredCompleted={photoCompletion.requiredCompleted}
        required={photoCompletion.required}
        total={photoCompletion.total}
        completed={photoCompletion.completed}
        missingLabels={photoCompletion.missingLabels}
      />
    </div>
  )
}

function EvidenceStatCard({
  icon: Icon,
  label,
  value,
  status,
}: {
  icon: React.ComponentType<{ className?: string }>
  label: string
  value: string
  status: "success" | "warning" | "danger" | "neutral"
}) {
  const statusColors = {
    success: "bg-emerald-50 border-emerald-200 text-emerald-700",
    warning: "bg-amber-50 border-amber-200 text-amber-700",
    danger: "bg-rose-50 border-rose-200 text-rose-700",
    neutral: "bg-slate-50 border-slate-200 text-slate-600",
  }

  const iconColors = {
    success: "text-emerald-600",
    warning: "text-amber-600",
    danger: "text-rose-600",
    neutral: "text-slate-500",
  }

  return (
    <div className={`rounded-lg border p-3 ${statusColors[status]}`}>
      <div className="flex items-center gap-1.5 mb-1">
        <Icon className={`size-3.5 ${iconColors[status]}`} />
        <span className="text-xs font-medium">{label}</span>
      </div>
      <p className="text-sm font-bold">{value}</p>
    </div>
  )
}