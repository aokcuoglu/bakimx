"use client"

import { useState, useTransition } from "react"
import { cn } from "@/lib/utils"
import { HardHat, Plus, UserCircle, Phone } from "lucide-react"
import { TECHNICIAN_ROLES } from "@/lib/constants"
import type { TechnicianRoleKey } from "@/lib/constants"
import { createTechnicianAction, toggleTechnicianActiveAction } from "@/app/(app)/technician/actions"
import { formatPhoneTR } from "@/lib/format"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"

type TechnicianRow = {
  id: string
  fullName: string
  phone: string
  role: string
  isActive: boolean
  createdAt: string
}

export function TechnicianManagement({ technicians }: { technicians: TechnicianRow[] }) {
  const [showForm, setShowForm] = useState(false)
  const [isPending, startTransition] = useTransition()
  const [error, setError] = useState("")

  return (
    <div className="rounded-lg border border-border bg-white p-5">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <HardHat className="size-5 text-muted-foreground" />
          <div>
            <h3 className="text-base font-semibold text-foreground">Teknisyenler & Ustalar</h3>
            <p className="text-xs text-muted-foreground">İş emirlerine atama yapabileceğiniz personeli yönetin</p>
          </div>
        </div>
        <Button
          size="lg"
          onClick={() => setShowForm(!showForm)}
          className="touch-manipulation"
        >
          <Plus className="size-4" />
          Ekle
        </Button>
      </div>

      {showForm && (
        <AddTechnicianForm
          onDone={() => setShowForm(false)}
          isPending={isPending}
          startTransition={startTransition}
          error={error}
          setError={setError}
        />
      )}

      {technicians.length === 0 ? (
        <div className="text-center py-8 text-muted-foreground text-sm">
          <HardHat className="size-10 mx-auto mb-2 text-muted-foreground/50" />
          <p className="font-medium">Henüz teknisyen eklenmemiş</p>
          <p className="text-xs mt-1">İş emirlerine atama yapmak için teknisyen ekleyin</p>
        </div>
      ) : (
        <div className="space-y-2">
          {technicians.map((t) => {
            const roleInfo = (TECHNICIAN_ROLES as Record<string, { label: string; color: string }>)[t.role]
            return (
              <div
                key={t.id}
                className={cn(
                  "flex items-center gap-3 p-3 rounded-lg border",
                  t.isActive ? "border-border bg-white" : "border-border bg-muted opacity-60"
                )}
              >
                <div className="size-10 rounded-full bg-muted flex items-center justify-center text-muted-foreground shrink-0">
                  <UserCircle className="size-5" />
                </div>
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className={cn("text-sm font-medium", t.isActive ? "text-foreground" : "text-muted-foreground")}>
                      {t.fullName}
                    </span>
                    <span className={cn("inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-medium border", roleInfo?.color || "bg-muted text-muted-foreground")}>
                      {roleInfo?.label || t.role}
                    </span>
                    {!t.isActive && (
                      <span className="text-[10px] font-medium text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">
                        Pasif
                      </span>
                    )}
                  </div>
                  <div className="flex items-center gap-1 text-xs text-muted-foreground mt-0.5">
                    <Phone className="size-3" />
                    {t.phone}
                  </div>
                </div>
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => {
                    startTransition(async () => {
                      await toggleTechnicianActiveAction(t.id)
                      window.location.reload()
                    })
                  }}
                  disabled={isPending}
                  className={cn(
                    "touch-manipulation",
                    t.isActive
                      ? "text-destructive hover:bg-destructive/10 border-destructive/20"
                      : "text-success hover:bg-success/10 border-success/20"
                  )}
                >
                  {t.isActive ? "Pasif Yap" : "Aktif Yap"}
                </Button>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}

function AddTechnicianForm({
  onDone,
  isPending,
  startTransition,
  error,
  setError,
}: {
  onDone: () => void
  isPending: boolean
  startTransition: (fn: () => Promise<void>) => void
  error: string
  setError: (v: string) => void
}) {
  const [fullName, setFullName] = useState("")
  const [phone, setPhone] = useState("")
  const [role, setRole] = useState<TechnicianRoleKey>("usta")

  return (
    <form
      action={() => {
        const fd = new FormData()
        fd.set("fullName", fullName)
        fd.set("phone", phone)
        fd.set("role", role)
        startTransition(async () => {
          const result = await createTechnicianAction(fd)
          if (result.error) {
            setError(result.error)
          } else {
            window.location.reload()
          }
        })
      }}
      className="p-4 rounded-lg border border-primary/20 bg-primary/5 space-y-3 mb-4"
    >
      <h4 className="text-sm font-semibold text-foreground">Yeni Teknisyen Ekle</h4>
      {error && (
        <p className="text-sm text-destructive">{error}</p>
      )}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input
          type="text"
          value={fullName}
          onChange={(e) => setFullName(e.target.value)}
          placeholder="Ad Soyad *"
          required
        />
        <Input
          type="tel"
          inputMode="tel"
          value={phone}
          onChange={(e) => setPhone(formatPhoneTR(e.target.value))}
          placeholder="0544 515 74 08"
          required
        />
      </div>
      <div className="flex flex-wrap gap-2">
        {(Object.entries(TECHNICIAN_ROLES) as [TechnicianRoleKey, { label: string; color: string }][]).map(([key, info]) => (
          <button
            key={key}
            type="button"
            onClick={() => setRole(key)}
            className={cn(
              "px-3 py-1.5 rounded-lg text-sm font-medium transition-colors touch-manipulation",
              role === key
                ? "bg-primary text-primary-foreground"
                : "bg-white border border-border text-muted-foreground hover:bg-muted"
            )}
          >
            {info.label}
          </button>
        ))}
      </div>
      <div className="flex gap-2">
        <Button
          type="submit"
          size="lg"
          disabled={isPending || !fullName.trim() || !phone.trim()}
          className="touch-manipulation"
        >
          <Plus className="size-4" />
          Ekle
        </Button>
        <Button
          type="button"
          variant="outline"
          size="lg"
          onClick={onDone}
          className="touch-manipulation"
        >
          İptal
        </Button>
      </div>
    </form>
  )
}