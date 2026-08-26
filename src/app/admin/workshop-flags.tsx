"use client"

import { useState, useTransition } from "react"
import { AnimatePresence, motion, useReducedMotion } from "framer-motion"
import { toast } from "sonner"
import { Loader2, RotateCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Switch } from "@/components/ui/switch"
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
  const [effective, setEffective] = useState(f.effective)
  const [hasOverride, setHasOverride] = useState(Boolean(f.override))
  const reduceMotion = useReducedMotion()

  function run(
    fn: () => Promise<{ ok: boolean; error?: string }>,
    onSuccess: () => void,
    onError: () => void,
  ) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (res.ok) {
        onSuccess()
        toast.success("Özellik ayarı güncellendi")
      } else {
        onError()
        const message = res.error || "İşlem başarısız"
        setError(message)
        toast.error(message)
      }
    })
  }

  return (
    <motion.div
      layout={!reduceMotion}
      animate={reduceMotion ? undefined : { scale: pending ? 0.995 : 1 }}
      transition={{ duration: reduceMotion ? 0 : 0.16, ease: "easeOut" }}
      className="grid gap-3 rounded-lg border bg-muted/30 p-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center"
    >
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold text-foreground">{f.label}</span>
          <AnimatePresence initial={false} mode="wait">
            <motion.div
              key={effective ? "enabled" : "disabled"}
              initial={reduceMotion ? false : { opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={reduceMotion ? undefined : { opacity: 0, scale: 0.9 }}
              transition={{ duration: reduceMotion ? 0 : 0.14, ease: "easeOut" }}
            >
              <Badge variant={effective ? "default" : "secondary"} className="px-2">
                {effective ? "açık" : "kapalı"}
              </Badge>
            </motion.div>
          </AnimatePresence>
          {f.override && (
            <span className="inline-flex items-center rounded-full bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary-strong">
              override{f.override.expiresAt ? ` · ${new Date(f.override.expiresAt).toLocaleDateString("tr-TR")}` : ""}
            </span>
          )}
        </div>
        <p className="mt-0.5 text-xs text-muted-foreground">
          Plan varsayılanı: {f.tierGrants ? "açık" : "kapalı"}
        </p>
        {error && <p className="mt-1 text-xs text-destructive-strong" role="alert">{error}</p>}
      </div>

      <div className="flex flex-wrap items-center gap-2 lg:justify-end">
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}
        <div className="flex items-center gap-2">
          <span className="text-xs text-muted-foreground">Kapalı</span>
          <Switch
            checked={effective}
            disabled={pending}
            onCheckedChange={(enabled) => {
              const previous = effective
              setEffective(enabled)
              run(
                () => setWorkshopFeatureOverride(workshopId, f.key, enabled),
                () => setHasOverride(true),
                () => setEffective(previous),
              )
            }}
            aria-label={`${f.label} özelliğini ${effective ? "kapat" : "aç"}`}
          />
          <span className="text-xs font-medium text-foreground">Açık</span>
        </div>
        <Button
          disabled={pending || !hasOverride}
          onClick={() => {
            const previous = effective
            setEffective(f.tierGrants)
            run(
              () => clearWorkshopFeatureOverride(workshopId, f.key),
              () => setHasOverride(false),
              () => setEffective(previous),
            )
          }}
          variant="ghost"
          size="sm"
          aria-label="Özel ayarı kaldır ve plan varsayılanına dön"
        >
          <RotateCcw />
          Sıfırla
        </Button>
      </div>
    </motion.div>
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
