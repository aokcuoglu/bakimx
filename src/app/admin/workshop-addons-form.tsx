"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { AlertCircle, Info, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Switch } from "@/components/ui/switch"
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { setWorkshopAddons, setWorkshopExtraVinQuota } from "@/app/admin/actions"
import { FEATURE_CATALOG } from "@/lib/feature-catalog"
import { ADDON_FEATURES } from "@/lib/plan"
import { typedResolver } from "@/lib/validations/resolver"
import {
  addonsFromToggles,
  togglesFromAddons,
  workshopAddonsFormSchema,
  type WorkshopAddonsFormValues,
} from "@/lib/validations/workshop-addons"

interface WorkshopAddonsFormProps {
  workshopId: string
  addons: readonly string[]
  extraVinQuota: number
  /** Ek özellik açıkken gelen aylık taban katalog kotası (bilgi metni için). */
  addonBaseQuota: number
  /**
   * Atölyenin erişim profili ek özelliklerin hepsini zaten açıyorsa nedeni.
   * Liste yine kaydedilir; profil düştüğünde (deneme biter, `premium` → `pro`)
   * geçerli olan budur.
   */
  allUnlockedReason?: "trial" | "premium"
}

const UNLOCKED_NOTES: Record<NonNullable<WorkshopAddonsFormProps["allUnlockedReason"]>, string> = {
  trial:
    "Atölye denemede; deneme süresince ek özelliklerin hepsi zaten açık. Burada açtıklarınız deneme bittikten sonra da açık kalır.",
  premium:
    "Atölye \"Paket + ek özellikler\" profilinde; ek özelliklerin hepsi zaten açık. Burada açtıklarınız paket Servis Paketi'ne dönerse de açık kalır.",
}

/**
 * Admin atölye detayında ek özellik aç/kapa ve ek katalog kotası (#827).
 *
 * İki ayrı sunucu eylemi çağrılır, yalnız değişen alan için — her biri kendi
 * denetim kaydını yazar. Sunucu kuralları kendisi doğrular; buradaki zod hızlı
 * geri bildirim içindir. `noValidate`: tarayıcının İngilizce doğrulama balonu
 * çıkmasın, kurallar tek kaynakta (`workshopAddonsFormSchema`) kalsın.
 */
export function WorkshopAddonsForm({
  workshopId,
  addons,
  extraVinQuota,
  addonBaseQuota,
  allUnlockedReason,
}: WorkshopAddonsFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState("")

  const form = useForm<WorkshopAddonsFormValues, unknown, WorkshopAddonsFormValues>({
    resolver: typedResolver(workshopAddonsFormSchema),
    defaultValues: { addons: togglesFromAddons(addons), extraVinQuota },
  })

  function onSubmit(values: WorkshopAddonsFormValues) {
    setServerError("")
    const { defaultValues } = form.formState
    const nextAddons = addonsFromToggles(values.addons)
    const prevAddons = addonsFromToggles(defaultValues?.addons ?? {})
    const addonsChanged = nextAddons.join(",") !== prevAddons.join(",")
    const quotaChanged = values.extraVinQuota !== defaultValues?.extraVinQuota

    if (!addonsChanged && !quotaChanged) {
      toast.info("Değişiklik yok.")
      return
    }

    startTransition(async () => {
      if (addonsChanged) {
        const result = await setWorkshopAddons(workshopId, nextAddons)
        if (!result.ok) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }
      }
      if (quotaChanged) {
        const result = await setWorkshopExtraVinQuota(workshopId, values.extraVinQuota)
        if (!result.ok) {
          setServerError(result.error)
          toast.error(result.error)
          return
        }
      }
      form.reset(values)
      toast.success("Ek özellikler ve katalog kotası kaydedildi")
    })
  }

  return (
    <div className="space-y-4">
      {allUnlockedReason && (
        <Alert>
          <Info className="size-4" />
          <AlertDescription>{UNLOCKED_NOTES[allUnlockedReason]}</AlertDescription>
        </Alert>
      )}

      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <div className="divide-y rounded-lg border">
            {ADDON_FEATURES.map((addon) => (
              <FormField
                key={addon}
                control={form.control}
                name={`addons.${addon}`}
                render={({ field }) => (
                  <FormItem className="flex flex-row items-center justify-between gap-3 px-3 py-3">
                    <div className="min-w-0 space-y-0.5">
                      <FormLabel className="cursor-pointer">{FEATURE_CATALOG[addon].name}</FormLabel>
                      <FormDescription className="text-xs">{FEATURE_CATALOG[addon].description}</FormDescription>
                    </div>
                    <FormControl>
                      <Switch checked={field.value} onCheckedChange={field.onChange} disabled={isPending} />
                    </FormControl>
                  </FormItem>
                )}
              />
            ))}
          </div>

          <FormField
            control={form.control}
            name="extraVinQuota"
            render={({ field }) => (
              <FormItem>
                <FormLabel>Ek katalog kotası (sorgu/ay)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" inputMode="numeric" step="1" placeholder="0" disabled={isPending} />
                </FormControl>
                <FormDescription className="text-xs">
                  Taban kotanın üzerine eklenir; 0 = ek kota yok. VIN ile araç tanıma ya da parça kataloğu
                  açıksa taban kota {addonBaseQuota.toLocaleString("tr-TR")} sorgu/ay.
                </FormDescription>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button variant="foreground" type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Kaydet
          </Button>
        </form>
      </Form>

      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
