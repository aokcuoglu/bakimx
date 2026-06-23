"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import {
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
}

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
  qualified: "bg-success/15 text-success",
  converted: "bg-success/15 text-success",
  in_progress: "bg-primary/15 text-primary",
  resolved: "bg-success/15 text-success",
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

function DemoRequestRow({ r }: { r: AdminDemoRequestRow }) {
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
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {DEMO_STATUSES.map((s) => (
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

function SupportRequestRow({ r }: { r: AdminSupportRequestRow }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function run(next: string) {
    setError("")
    startTransition(async () => {
      const res = await updateSupportRequestStatus(r.id, next)
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
          {error && <p className="text-sm text-destructive mt-1">{error}</p>}
        </div>

        <div className="flex flex-wrap items-center gap-1.5 shrink-0">
          {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
          {SUPPORT_STATUSES.map((s) => (
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

export function AdminDemoRequests({ requests }: { requests: AdminDemoRequestRow[] }) {
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz demo talebi yok.</p>
  }
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <DemoRequestRow key={r.id} r={r} />
      ))}
    </div>
  )
}

export function AdminSupportRequests({ requests }: { requests: AdminSupportRequestRow[] }) {
  if (requests.length === 0) {
    return <p className="text-sm text-muted-foreground">Henüz destek talebi yok.</p>
  }
  return (
    <div className="space-y-3">
      {requests.map((r) => (
        <SupportRequestRow key={r.id} r={r} />
      ))}
    </div>
  )
}