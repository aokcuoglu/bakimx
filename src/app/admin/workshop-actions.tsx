"use client"

import { useState, useTransition } from "react"
import { useForm, useWatch } from "react-hook-form"
import { Check, X, Loader2, Minus, Plus, AlertCircle } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Checkbox } from "@/components/ui/checkbox"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog"
import {
  approveWorkshop,
  rejectWorkshop,
  activateWorkshopPlan,
  setWorkshopExtraSeats,
} from "@/app/admin/actions"
import { isSalePlanTier, PLAN_LABELS, PLAN_SEATS, planLabel } from "@/lib/plan"
import { addPeriod } from "@/lib/billing/period"
import { formatTrDate } from "@/lib/format-date"
import { typedResolver } from "@/lib/validations/resolver"
import { manualPlanActivationSchema, type ManualPlanActivationInput } from "@/lib/validations/plan-activation"

/** Elle etkinleştirme her zaman tek satış paketine yapılır (#782, #830). Ek
 *  özellikler pakete değil, iş yeri detayındaki anahtarlara bağlıdır (#827). */
const MANUAL_ACTIVATION_TIER = "pro" as const

export interface WorkshopActionState {
  id: string
  approvalStatus: string
  requestedPlanTier: string | null
  extraSeats: number
  /** Ek koltuklar hariç, bugünkü erişim profilinin içerdiği koltuk. */
  includedSeats: number
  /** Satır süresiz eski Lite hakkı taşıyor mu (`hasLifetimeLite`). */
  lifetimeLite: boolean
  planTier?: string
  currentPeriodEnd?: string | null
  subscriptionStatus?: string
  activeUsers?: number
}

/** Shared founder controls for a workshop (approve/reject · assign plan · extra
 *  seats). Used inline in the workshops list and on the 360° tenant detail. */
export function WorkshopActions({ w }: { w: WorkshopActionState }) {
  const [pending, startTransition] = useTransition()
  const [error, setError] = useState("")
  const [seats, setSeats] = useState(w.extraSeats)
  const [open, setOpen] = useState(false)
  // Dönem seçimi bilinçli: varsayılan yok, ya dönem ya da açık "süresiz" (#1040).
  const form = useForm<ManualPlanActivationInput, unknown, ManualPlanActivationInput>({
    resolver: typedResolver(manualPlanActivationSchema),
    defaultValues: { cycle: undefined, indefinite: false },
  })
  const cycle = useWatch({ control: form.control, name: "cycle" })
  const indefinite = useWatch({ control: form.control, name: "indefinite" })
  const paidPeriod = w.subscriptionStatus === "active" && !!w.currentPeriodEnd && new Date(w.currentPeriodEnd) > new Date()
  // Koltuk kaydı ve paket etkinleştirme ayrı düğmelerdir (#939). Ödenmiş dönemde
  // dahil koltuk bugünkü profilden gelir; aksi halde limit, etkinleştirilecek
  // paketin koltuğu üzerinden hesaplanır.
  const includedSeats = paidPeriod ? w.includedSeats : PLAN_SEATS[MANUAL_ACTIVATION_TIER]
  const manualLabel = PLAN_LABELS[MANUAL_ACTIVATION_TIER]
  // Satıştaki paket dışındaki eski satır yalnız "Paketi etkinleştir" ile Servis
  // Paketi'ne geçer; koltuk kaydı paketi değiştirmez. Uyarı ve düğme hedefi söyler.
  const legacyTier = !!w.planTier && !isSalePlanTier(w.planTier)
  const legacyNote = legacyTier
    ? `Bu iş yeri ${planLabel(w.planTier)} satırında; etkinleştirirseniz ${manualLabel}'ne geçer.` +
      (w.lifetimeLite ? " Süresiz Lite hakkı kalkar." : "") +
      " Ek özellikler iş yeri detayındaki anahtarlardan açılır."
    : null
  const activateLabel = indefinite ? "Süresiz etkinleştir" : legacyTier ? `${manualLabel}'ne geçir` : "Paketi etkinleştir"
  const activateSuccess = legacyTier ? `İş yeri ${manualLabel}'ne geçirildi` : "Paket etkinleştirildi"

  function run(fn: () => Promise<{ ok: boolean; error?: string }>, successMessage?: string, onSuccess?: () => void) {
    setError("")
    startTransition(async () => {
      const res = await fn()
      if (!res.ok) {
        const message = res.error || "İşlem başarısız"
        setError(message)
        toast.error(message)
        return
      }

      if (successMessage) toast.success(successMessage)
      onSuccess?.()
    })
  }

  return (
    <div className="flex flex-col gap-1.5">
      <div className="flex flex-wrap items-center gap-2">
        {pending && <Loader2 className="size-4 animate-spin text-muted-foreground" />}

        {w.approvalStatus === "pending" ? (
          <>
            <Button variant="foreground"
              disabled={pending}
              onClick={() => run(() => approveWorkshop(w.id), "İş yeri onaylandı")}
              size="sm"
            >
              <Check className="size-3.5" /> Onayla
            </Button>
            <Button
              disabled={pending}
              onClick={() => run(() => rejectWorkshop(w.id), "İş yeri reddedildi")}
              variant="outline"
              size="sm"
            >
              <X className="size-3.5" /> Reddet
            </Button>
          </>
        ) : <Dialog open={open} onOpenChange={(next) => { setOpen(next); if (!next) form.reset() }}>
          <DialogTrigger asChild><Button variant="outline">Aboneliği yönet</Button></DialogTrigger>
          <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Aboneliği yönet</DialogTitle><DialogDescription>Değişikliklerin etkisini onaylamadan önce gözden geçirin.</DialogDescription></DialogHeader>
            {paidPeriod ? (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p>Aktif paket: <strong>{planLabel(w.planTier)}</strong></p>
                <p>Dönem bitişi: <strong>{formatTrDate(w.currentPeriodEnd!)}</strong></p>
                <p className="text-muted-foreground-strong">Ödenmiş dönem boyunca paket değiştirilemez; yenileme için faturalandırma akışını kullanın.</p>
              </div>
            ) : (
              <div className="rounded-md bg-muted p-3 text-sm space-y-1">
                <p>Manuel etkinleştirme: <strong>{manualLabel}</strong></p>
                {legacyNote && <p className="font-normal text-foreground">{legacyNote}</p>}
              </div>
            )}
            {!paidPeriod && (
              <Form {...form}>
                <div className="rounded-md border p-3 space-y-3">
                  <FormField
                    control={form.control}
                    name="cycle"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel>Erişim dönemi</FormLabel>
                        <FormControl>
                          <ToggleGroup
                            type="single"
                            variant="outline"
                            size="control"
                            value={field.value ?? ""}
                            onValueChange={(v) => field.onChange(v || undefined)}
                            disabled={pending || indefinite}
                            aria-label="Erişim dönemi"
                          >
                            <ToggleGroupItem value="monthly">Aylık</ToggleGroupItem>
                            <ToggleGroupItem value="yearly">Yıllık</ToggleGroupItem>
                          </ToggleGroup>
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="indefinite"
                    render={({ field }) => (
                      <FormItem className="flex min-h-11 flex-row items-center gap-2 space-y-0 md:min-h-0">
                        <FormControl>
                          <Checkbox
                            checked={field.value}
                            disabled={pending}
                            onCheckedChange={(checked) => {
                              field.onChange(checked === true)
                              if (checked === true) {
                                form.setValue("cycle", undefined, { shouldValidate: false })
                                form.clearErrors("cycle")
                              }
                            }}
                          />
                        </FormControl>
                        <FormLabel className="font-normal">Süresiz erişim ver (dönem bitişi olmaz)</FormLabel>
                      </FormItem>
                    )}
                  />
                  {indefinite ? (
                    <p className="rounded-sm bg-warning/10 p-2 text-xs text-warning-strong">
                      Bu iş yeri yenileme/ödeme ekranına hiç düşmez; seçim denetim kaydına işlenir.
                    </p>
                  ) : cycle ? (
                    <p className="rounded-sm bg-muted p-2 text-xs text-muted-foreground-strong">
                      Dönem bitişi: {formatTrDate(addPeriod(new Date(), cycle))}
                    </p>
                  ) : null}
                </div>
              </Form>
            )}
            <div className="rounded-md border p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="font-medium text-sm">Ek koltuk</span>
                <div className="flex items-center gap-2">
                  <Button size="icon" variant="outline" disabled={pending || seats === 0} onClick={() => setSeats(seats - 1)} aria-label="Ek koltuğu azalt"><Minus /></Button>
                  <span className="w-6 text-center">{seats}</span>
                  <Button size="icon" variant="outline" disabled={pending || seats >= 500} onClick={() => setSeats(seats + 1)} aria-label="Ek koltuğu artır"><Plus /></Button>
                </div>
              </div>
              <p className="text-xs text-muted-foreground">Yeni limit: {includedSeats + seats} koltuk{w.activeUsers != null ? ` · ${w.activeUsers} aktif kullanıcı` : ""}</p>
              <Button variant="outline" disabled={pending || seats === w.extraSeats} onClick={() => run(() => setWorkshopExtraSeats(w.id, seats), "Ek koltuklar kaydedildi")}>
                {pending && <Loader2 className="animate-spin" />}Koltukları kaydet
              </Button>
            </div>
            {error && (
              <Alert variant="destructive">
                <AlertCircle className="size-4" />
                <AlertDescription>{error}</AlertDescription>
              </Alert>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => setOpen(false)}>Kapat</Button>
              {!paidPeriod && (
                <Button variant="foreground" disabled={pending} onClick={form.handleSubmit((values) => run(() => activateWorkshopPlan(w.id, MANUAL_ACTIVATION_TIER, values), activateSuccess, () => { setOpen(false); form.reset() }))}>
                  {pending && <Loader2 className="animate-spin" />}{activateLabel}
                </Button>
              )}
            </DialogFooter>
          </DialogContent>
        </Dialog>}
      </div>
      {error && !open && <p className="text-sm text-destructive-strong">{error}</p>}
    </div>
  )
}
