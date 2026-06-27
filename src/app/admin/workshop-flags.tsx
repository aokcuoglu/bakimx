"use client"

import { useState, useTransition } from "react"
import { Loader2 } from "lucide-react"
import { cn } from "@/lib/utils"
import { buttonVariants } from "@/components/ui/button"
import { setWorkshopFeatureOverride, clearWorkshopFeatureOverride } from "@/app/admin/actions"

export interface FlagRow {
  key: string
  label: string
  tierGrants: boolean
  effective: boolean
  override: { enabled: boolean; expiresAt: string | null; reason: string | null } | null
}

function FlagItem({ workshopId, f }: { workshopId: string; f: FlagRow }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")

  function run(fn: () => Promise<{ ok: boolean; error?: string }>) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) setError(res.error || "İşlem başarısız")
    })
  }

  return (
    <div className="flex flex-col gap-2 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between">
      <div className="min-w-0">
        <div className="flex items-center gap-2">
          <span className="font-medium text-foreground">{f.label}</span>
          <span
            className={cn(
              "inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium",
              f.effective ? "bg-emerald-100 text-emerald-800" : "bg-muted text-muted-foreground",
            )}
          >
            {f.effective ? "açık" : "kapalı"}
          </span>
          {f.override && (
            <span className="inline-flex items-center rounded-full bg-primary/15 px-2 py-0.5 text-[11px] font-medium text-primary">
              override{f.override.expiresAt ? ` · ${new Date(f.override.expiresAt).toLocaleDateString("tr-TR")}` : ""}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-0.5">
          Plan varsayılanı: {f.tierGrants ? "açık" : "kapalı"}
        </p>
        {error && <p className="text-xs text-destructive mt-0.5">{error}</p>}
      </div>

      <div className="flex items-center gap-1.5 shrink-0">
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <button
          disabled={pending || (f.override?.enabled === true)}
          onClick={() => run(() => setWorkshopFeatureOverride(workshopId, f.key, true))}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Aç
        </button>
        <button
          disabled={pending || (f.override?.enabled === false)}
          onClick={() => run(() => setWorkshopFeatureOverride(workshopId, f.key, false))}
          className={cn(buttonVariants({ variant: "outline", size: "sm" }))}
        >
          Kapat
        </button>
        <button
          disabled={pending || !f.override}
          onClick={() => run(() => clearWorkshopFeatureOverride(workshopId, f.key))}
          className={cn(buttonVariants({ variant: "ghost", size: "sm" }))}
          title="Override'ı kaldır — plan varsayılanına dön"
        >
          Sıfırla
        </button>
      </div>
    </div>
  )
}

export function WorkshopFlags({ workshopId, flags }: { workshopId: string; flags: FlagRow[] }) {
  return (
    <div className="space-y-2">
      {flags.map((f) => (
        <FlagItem key={f.key} workshopId={workshopId} f={f} />
      ))}
    </div>
  )
}
