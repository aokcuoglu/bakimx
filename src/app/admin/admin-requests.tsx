"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { Building2, ExternalLink, Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Textarea } from "@/components/ui/textarea"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import {
  assignSupportRequest,
  saveSupportRequestInternalNote,
  setSupportRequestWorkshop,
  updateDemoRequestStatus,
  updateSupportRequestStatus,
} from "@/app/admin/actions"

export interface AdminDemoRequestRow {
  id: string
  name: string
  businessName: string
  phone: string
  city: string
  monthlyVehicles: string
  notes: string | null
  status: string
  createdAt: string
}

export interface AdminSupportRequestRow {
  id: string
  name: string
  businessName: string
  email: string
  phone: string
  subject: string
  message: string
  status: string
  createdAt: string
  /** Bağlı kiracı; NULL = eşleşme bulunamadı ya da birden çok aday çıktı. */
  workshopId: string | null
  workshopName: string | null
  assignedToUserId: string | null
  assignedToLabel: string | null
  /** YALNIZ konsol — müşteri yüzeylerine asla taşınmaz (BAK-98). */
  internalNote: string | null
}

/** İş yeri bağlama ve atama açılır listelerinin içeriği. */
export interface SupportRequestOptions {
  workshops: { value: string; label: string }[]
  admins: { value: string; label: string }[]
}

/** "Seçim yok" satırı — Base UI Select boş string'i geçerli bir değer sayar,
 *  bu yüzden temizleme ayrı bir seçenek olarak sunulur. */
const UNASSIGNED = "__none__"

const DEMO_STATUSES: { value: string; label: string }[] = [
  { value: "new", label: "Yeni" },
  { value: "contacted", label: "İletişime geçildi" },
  { value: "qualified", label: "Uygun" },
  { value: "converted", label: "Dönüştü" },
  { value: "archived", label: "Arşivlendi" },
]

const SUPPORT_STATUSES: { value: string; label: string }[] = [
  { value: "new", label: "Yeni" },
  { value: "in_progress", label: "İşleniyor" },
  { value: "resolved", label: "Çözüldü" },
  { value: "archived", label: "Arşivlendi" },
]

const STATUS_BADGE: Record<string, string> = {
  new: "bg-muted text-muted-foreground",
  contacted: "bg-primary/15 text-primary",
  qualified: "bg-success/15 text-success-strong",
  converted: "bg-success/15 text-success-strong",
  in_progress: "bg-primary/15 text-primary",
  resolved: "bg-success/15 text-success-strong",
  archived: "bg-muted text-muted-foreground",
}

function Badge({ children, className }: { children: React.ReactNode; className?: string }) {
  return (
    <span className={cn("inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium", className)}>
      {children}
    </span>
  )
}

function StatusButton({
  current,
  value,
  label,
  disabled,
  onClick,
}: {
  current: string
  value: string
  label: string
  disabled: boolean
  onClick: () => void
}) {
  return (
    <Button
      type="button"
      variant={current === value ? "default" : "outline"}
      size="sm"
      disabled={disabled}
      aria-pressed={current === value}
      onClick={onClick}
    >
      {label}
    </Button>
  )
}

function DemoRequestRow({ r, canManage }: { r: AdminDemoRequestRow; canManage: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function run(next: string) {
    setError("")
    startTransition(async () => {
      const res = await updateDemoRequestStatus(r.id, next)
      if (!res.ok) setError(res.error)
    })
  }

  const created = new Date(r.createdAt).toLocaleDateString("tr-TR")

  return (
    <div className="rounded-lg border bg-card p-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{r.name}</span>
            <Badge className={STATUS_BADGE[r.status] ?? "bg-muted"}>
              {DEMO_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{created}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {r.businessName} · {r.phone} · {r.city}
          </p>
          <p className="text-sm text-muted-foreground">
            Aylık araç: {r.monthlyVehicles}
          </p>
          {r.notes && (
            <p className="text-sm text-muted-foreground mt-1 italic">“{r.notes}”</p>
          )}
          {error && <p className="text-sm text-destructive-strong mt-1">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {canManage && DEMO_STATUSES.map((s) => (
            <StatusButton
              key={s.value}
              current={r.status}
              value={s.value}
              label={s.label}
              disabled={pending}
              onClick={() => run(s.value)}
            />
          ))}
        </div>
      </div>
    </div>
  )
}

/** Konsol içi tek satırlık açılır liste — etiketi `items` ile verilir, aksi
 *  hâlde Base UI Select tetikleyicide ham değeri basar. */
function ManageSelect({
  label,
  value,
  options,
  disabled,
  onChange,
}: {
  label: string
  value: string
  options: { value: string; label: string }[]
  disabled: boolean
  onChange: (next: string) => void
}) {
  return (
    <label className="flex flex-col gap-1 text-xs text-muted-foreground">
      {label}
      <Select
        value={value}
        disabled={disabled}
        onValueChange={(v) => onChange(v === UNASSIGNED ? "" : v)}
      >
        <SelectTrigger className="w-full">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {options.map((opt) => (
            <SelectItem key={opt.value} value={opt.value}>
              {opt.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </label>
  )
}

function SupportRequestRow({
  r,
  canManage,
  options,
}: {
  r: AdminSupportRequestRow
  canManage: boolean
  options: SupportRequestOptions
}) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [note, setNote] = useState(r.internalNote ?? "")
  const [noteSaved, setNoteSaved] = useState(false)

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    setError("")
    startTransition(async () => {
      const res = await action()
      if (!res.ok) setError(res.error)
    })
  }

  const created = new Date(r.createdAt).toLocaleDateString("tr-TR")

  const workshopOptions = [
    { value: UNASSIGNED, label: "Bağlı değil" },
    ...options.workshops,
  ]
  const adminOptions = [{ value: UNASSIGNED, label: "Atanmadı" }, ...options.admins]

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-semibold text-foreground">{r.name}</span>
            <Badge className={STATUS_BADGE[r.status] ?? "bg-muted"}>
              {SUPPORT_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}
            </Badge>
            <span className="text-xs text-muted-foreground">{created}</span>
          </div>
          <p className="text-sm text-muted-foreground mt-1">
            {r.businessName} · {r.phone} · {r.email}
          </p>
          {r.subject && (
            <p className="text-sm font-medium text-foreground mt-1">{r.subject}</p>
          )}
          <p className="text-sm text-muted-foreground mt-1">{r.message}</p>

          {/* Bağlı kayıttan iş yeri detayına tek tıkla geçiş — teşhisin ilk
              adımı "bu kim?" sorusunu cevaplamak. */}
          <div className="flex items-center gap-2 flex-wrap mt-2 text-xs">
            {r.workshopId ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={`/admin/workshops/${r.workshopId}`}>
                  <Building2 className="size-3.5" />
                  {r.workshopName ?? "İş yeri"}
                  <ExternalLink className="size-3.5" />
                </Link>
              </Button>
            ) : (
              <span className="text-muted-foreground">Bağlı iş yeri yok</span>
            )}
            {r.assignedToLabel && (
              <span className="text-muted-foreground">Atanan: {r.assignedToLabel}</span>
            )}
          </div>

          {error && <p className="text-sm text-destructive-strong mt-1">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {canManage && SUPPORT_STATUSES.map((s) => (
            <StatusButton
              key={s.value}
              current={r.status}
              value={s.value}
              label={s.label}
              disabled={pending}
              onClick={() => run(() => updateSupportRequestStatus(r.id, s.value))}
            />
          ))}
        </div>
      </div>

      {canManage ? (
        <div className="grid gap-3 border-t pt-3 sm:grid-cols-2">
          <ManageSelect
            label="İş yeri"
            value={r.workshopId ?? UNASSIGNED}
            options={workshopOptions}
            disabled={pending}
            onChange={(next) => run(() => setSupportRequestWorkshop(r.id, next))}
          />
          <ManageSelect
            label="Atanan"
            value={r.assignedToUserId ?? UNASSIGNED}
            options={adminOptions}
            disabled={pending}
            onChange={(next) => run(() => assignSupportRequest(r.id, next))}
          />

          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:col-span-2">
            İç not (müşteriye gösterilmez)
            <Textarea
              value={note}
              disabled={pending}
              rows={2}
              onChange={(e) => {
                setNote(e.target.value)
                setNoteSaved(false)
              }}
            />
          </label>
          <div className="flex items-center gap-2 sm:col-span-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={pending || note === (r.internalNote ?? "")}
              onClick={() =>
                run(async () => {
                  const res = await saveSupportRequestInternalNote(r.id, note)
                  if (res.ok) setNoteSaved(true)
                  return res
                })
              }
            >
              Notu kaydet
            </Button>
            {noteSaved && <span className="text-xs text-success-strong">Kaydedildi</span>}
          </div>
        </div>
      ) : (
        r.internalNote && (
          <p className="border-t pt-3 text-sm text-muted-foreground whitespace-pre-wrap">
            İç not: {r.internalNote}
          </p>
        )
      )}
    </div>
  )
}

export function AdminDemoRequests({
  requests,
  canManage = false,
}: {
  requests: AdminDemoRequestRow[]
  /** `manageLeads` yetkisi — yoksa durum düğmeleri çizilmez (BAK-93). */
  canManage?: boolean
}) {
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz demo talebi yok.</p>
  }
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <DemoRequestRow key={r.id} r={r} canManage={canManage} />
      ))}
    </div>
  )
}

export function AdminSupportRequests({
  requests,
  canManage = false,
  options = { workshops: [], admins: [] },
}: {
  requests: AdminSupportRequestRow[]
  canManage?: boolean
  /** Bağlama/atama listeleri — yalnız `canManage` ise kullanılır. */
  options?: SupportRequestOptions
}) {
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz destek talebi yok.</p>
  }
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <SupportRequestRow key={r.id} r={r} canManage={canManage} options={options} />
      ))}
    </div>
  )
}