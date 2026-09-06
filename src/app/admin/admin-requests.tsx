"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { toast } from "sonner"
import {
  Building2,
  CalendarDays,
  Car,
  ExternalLink,
  Inbox,
  Loader2,
  MapPin,
  Phone,
  User,
} from "lucide-react"
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
  workshopId: string | null
  workshopName: string | null
  assignedToUserId: string | null
  assignedToLabel: string | null
  internalNote: string | null
}

export interface SupportRequestOptions {
  workshops: { value: string; label: string }[]
  admins: { value: string; label: string }[]
}

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

const DEMO_STATUS_BADGE: Record<string, string> = {
  new: "bg-primary/15 text-primary-strong ring-1 ring-primary/20",
  contacted: "bg-primary/10 text-primary-strong",
  qualified: "bg-success/15 text-success-strong",
  converted: "bg-success/20 text-success-strong ring-1 ring-success/20",
  archived: "bg-muted text-muted-foreground",
}

const DEMO_STATUS_DOT: Record<string, string> = {
  new: "bg-primary",
  contacted: "bg-primary/60",
  qualified: "bg-success",
  converted: "bg-success",
  archived: "bg-muted-foreground/40",
}

const SUPPORT_STATUS_BADGE: Record<string, string> = {
  new: "bg-warning/15 text-warning-strong ring-1 ring-warning/20",
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

/* ────────────────────────────── Demo Talepleri ────────────────────────────── */

function DemoStatCard({
  label,
  value,
  tone,
}: {
  label: string
  value: number
  tone?: string
}) {
  return (
    <div className="rounded-xl border bg-card px-4 py-3">
      <p className={cn("text-2xl font-bold", tone ?? "text-foreground")}>{value}</p>
      <p className="text-xs text-muted-foreground mt-0.5">{label}</p>
    </div>
  )
}

function DemoRequestRow({ r, canManage }: { r: AdminDemoRequestRow; canManage: boolean }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function run(next: string) {
    setError("")
    startTransition(async () => {
      const res = await updateDemoRequestStatus(r.id, next)
      if (!res.ok) {
        setError(res.error)
        toast.error(res.error)
      } else {
        toast.success("Demo talebi güncellendi")
      }
    })
  }

  const isNew = r.status === "new"
  const created = new Date(r.createdAt)
  const dateStr = created.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
  const timeStr = created.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })

  return (
    <div
      className={cn(
        "group relative rounded-xl border bg-card p-4 sm:p-5 transition-all hover:shadow-md",
        isNew ? "border-primary/30 shadow-sm" : "border-border/60"
      )}
    >
      {isNew && <div className="absolute inset-y-0 left-0 w-1 rounded-l-xl bg-primary" />}

      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 space-y-2">
          <div className="flex items-center gap-2.5 flex-wrap">
            <span className={cn("text-base", isNew ? "font-bold" : "font-semibold")}>{r.name}</span>
            <Badge className={DEMO_STATUS_BADGE[r.status] ?? "bg-muted"}>
              <span className={cn("mr-1 size-1.5 rounded-full", DEMO_STATUS_DOT[r.status])} />
              {DEMO_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}
            </Badge>
          </div>

          <div className="flex items-center gap-1.5 text-sm">
            <Building2 className="size-3.5 shrink-0 text-muted-foreground" />
            <span className="font-medium text-foreground">{r.businessName}</span>
          </div>

          <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Phone className="size-3.5 shrink-0" />
              {r.phone}
            </span>
            <span className="flex items-center gap-1.5">
              <MapPin className="size-3.5 shrink-0" />
              {r.city}
            </span>
            <span className="flex items-center gap-1.5">
              <Car className="size-3.5 shrink-0" />
              {r.monthlyVehicles} araç/ay
            </span>
          </div>

          {r.notes && (
            <p className="text-sm text-muted-foreground italic line-clamp-2">
              &ldquo;{r.notes}&rdquo;
            </p>
          )}
          {error && <p className="text-sm text-destructive-strong">{error}</p>}
        </div>

        <div className="flex flex-col items-start gap-3 sm:flex-row sm:items-center lg:flex-col lg:items-end shrink-0">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <CalendarDays className="size-3.5" />
            <span>{dateStr}</span>
            <span className="text-muted-foreground-strong">{timeStr}</span>
          </div>

          {canManage && (
            <div className="flex flex-wrap gap-1.5">
              {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
              {DEMO_STATUSES.map((s) => (
                <Button
                  key={s.value}
                  type="button"
                  variant={r.status === s.value ? "default" : "outline"}
                  size="sm"
                  disabled={pending}
                  aria-pressed={r.status === s.value}
                  onClick={() => run(s.value)}
                  className="h-7 text-xs"
                >
                  {s.label}
                </Button>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

export function AdminDemoRequests({
  requests,
  canManage = false,
}: {
  requests: AdminDemoRequestRow[]
  canManage?: boolean
}) {
  const total = requests.length
  const newCount = requests.filter((r) => r.status === "new").length
  const contactedCount = requests.filter((r) => r.status === "contacted").length
  const qualifiedCount = requests.filter((r) => r.status === "qualified").length
  const convertedCount = requests.filter((r) => r.status === "converted").length

  if (total === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center">
        <Inbox className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="font-medium text-foreground">Henüz demo talebi yok</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Public demo formundan gelen talepler burada listelenecek.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
        <DemoStatCard label="Toplam" value={total} />
        <DemoStatCard label="Yeni" value={newCount} tone="text-primary" />
        <DemoStatCard label="İletişime geçildi" value={contactedCount} tone="text-primary-strong" />
        <DemoStatCard label="Dönüştü" value={convertedCount} tone="text-success-strong" />
      </div>

      {qualifiedCount > 0 && (
        <p className="text-xs text-muted-foreground">
          {qualifiedCount} talep &ldquo;Uygun&rdquo; durumunda bekliyor.
        </p>
      )}

      <div className="space-y-3">
        {requests.map((r) => (
          <DemoRequestRow key={r.id} r={r} canManage={canManage} />
        ))}
      </div>
    </div>
  )
}

/* ──────────────────────────── Destek Gelen Kutusu ──────────────────────────── */

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
  const [expanded, setExpanded] = useState(false)
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [note, setNote] = useState(r.internalNote ?? "")
  const [noteSaved, setNoteSaved] = useState(false)

  function run(action: () => Promise<{ ok: true } | { ok: false; error: string }>, successMessage: string) {
    setError("")
    startTransition(async () => {
      const res = await action()
      if (!res.ok) {
        setError(res.error)
        toast.error(res.error)
      } else {
        toast.success(successMessage)
      }
    })
  }

  const isNew = r.status === "new"
  const created = new Date(r.createdAt)
  const dateStr = created.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })
  const timeStr = created.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })

  const workshopOptions = [{ value: UNASSIGNED, label: "Bağlı değil" }, ...options.workshops]
  const adminOptions = [{ value: UNASSIGNED, label: "Atanmadı" }, ...options.admins]

  return (
    <div
      className={cn(
        "rounded-xl border bg-card transition-all",
        isNew ? "border-warning/30" : "border-border/60"
      )}
    >
      <Button
        type="button"
        variant="ghost"
        aria-expanded={expanded}
        className="h-auto w-full items-start justify-start gap-3 whitespace-normal rounded-xl p-4 text-left transition-colors hover:bg-muted/30"
        onClick={() => setExpanded(!expanded)}
      >
        <div className="min-w-0 flex-1 space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn("text-sm", isNew ? "font-bold" : "font-semibold")}>{r.name}</span>
            <Badge className={SUPPORT_STATUS_BADGE[r.status] ?? "bg-muted"}>
              {SUPPORT_STATUSES.find((s) => s.value === r.status)?.label ?? r.status}
            </Badge>
            {r.assignedToLabel && (
              <span className="text-xs text-muted-foreground">
                → {r.assignedToLabel}
              </span>
            )}
          </div>
          <p className="text-sm text-muted-foreground">
            {r.subject || r.businessName}
          </p>
          {!expanded && (
            <p className="text-xs text-muted-foreground line-clamp-1">{r.message}</p>
          )}
        </div>

        <div className="flex items-center gap-2 text-xs text-muted-foreground shrink-0 pt-0.5">
          <CalendarDays className="size-3.5" />
          <span>{dateStr}</span>
          <span className="text-muted-foreground-strong">{timeStr}</span>
        </div>
      </Button>

      {expanded && (
        <div className="border-t px-4 pb-4 pt-3 space-y-4">
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2 text-sm">
              <div className="flex items-center gap-2 text-muted-foreground">
                <Building2 className="size-3.5 shrink-0" />
                <span>{r.businessName}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <Phone className="size-3.5 shrink-0" />
                <span>{r.phone}</span>
              </div>
              <div className="flex items-center gap-2 text-muted-foreground">
                <User className="size-3.5 shrink-0" />
                <span>{r.email}</span>
              </div>
            </div>

            {canManage && (
              <div className="space-y-3">
                <ManageSelect
                  label="Durum"
                  value={r.status}
                  options={SUPPORT_STATUSES}
                  disabled={pending}
                  onChange={(next) =>
                    run(() => updateSupportRequestStatus(r.id, next), "Destek talebi durumu güncellendi")
                  }
                />
                <ManageSelect
                  label="İş yeri"
                  value={r.workshopId ?? UNASSIGNED}
                  options={workshopOptions}
                  disabled={pending}
                  onChange={(next) =>
                    run(() => setSupportRequestWorkshop(r.id, next), "İş yeri bağlantısı güncellendi")
                  }
                />
                <ManageSelect
                  label="Atanan"
                  value={r.assignedToUserId ?? UNASSIGNED}
                  options={adminOptions}
                  disabled={pending}
                  onChange={(next) =>
                    run(() => assignSupportRequest(r.id, next), "Atanan yönetici güncellendi")
                  }
                />
              </div>
            )}
          </div>

          <div className="rounded-lg bg-muted/50 px-4 py-3 text-sm leading-6 text-foreground whitespace-pre-wrap">
            {r.message}
          </div>

          {r.workshopId && (
            <Button variant="outline" size="sm" asChild>
              <Link href={`/admin/workshops/${r.workshopId}`}>
                <Building2 className="size-3.5" />
                {r.workshopName ?? "İş yeri"}
                <ExternalLink className="ml-auto size-3.5" />
              </Link>
            </Button>
          )}

          {canManage && (
            <div className="space-y-2">
              <label className="flex flex-col gap-1 text-xs text-muted-foreground">
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
              <div className="flex items-center gap-2">
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
                    }, "İç not kaydedildi")
                  }
                >
                  Notu kaydet
                </Button>
                {noteSaved && <span className="text-xs text-success-strong">Kaydedildi</span>}
              </div>
            </div>
          )}

          {error && <p className="text-sm text-destructive-strong">{error}</p>}
        </div>
      )}
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
  options?: SupportRequestOptions
}) {
  if (requests.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card px-5 py-12 text-center">
        <Inbox className="mx-auto mb-3 size-8 text-muted-foreground" />
        <p className="font-medium text-foreground">Destek talebi yok</p>
        <p className="mt-1 text-sm text-muted-foreground">
          Public destek formundan gelen talepler burada listelenecek.
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <SupportRequestRow key={r.id} r={r} canManage={canManage} options={options} />
      ))}
    </div>
  )
}
