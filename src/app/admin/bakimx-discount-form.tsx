"use client"

import { useState, useTransition } from "react"
import { useForm } from "react-hook-form"
import { AlertCircle, Loader2 } from "lucide-react"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { typedResolver } from "@/lib/validations/resolver"
import { updateWorkshopBakimxDiscount } from "@/app/admin/actions"
import {
  bakimxDiscountFormSchema,
  bpsToPercent,
  percentToBps,
  type BakimxDiscountFormValues,
} from "@/lib/validations/bakimx-discount"

interface BakimxDiscountFormProps {
  workshopId: string
  currentDiscountBps: number
}

/**
 * Atölyenin GetirBakım kaynaklı iskonto oranını ayarlar (BAK-47).
 *
 * Alan YÜZDE girer (0–100), sunucuya bps gider — dönüşüm tek yerde
 * (`percentToBps`). Sunucu oranı ayrıca kendi doğruluyor; buradaki doğrulama
 * kullanıcıya hızlı geri bildirim içindir, güvenlik sınırı değildir.
 *
 * `noValidate` BİLİNÇLİ: `min`/`max` öznitelikleri olmadan tarayıcı kendi
 * doğrulama balonunu gösteriyor ve o balon TARAYICI DİLİNDE ("Value must be
 * greater than or equal to 0"). Türkçe arayüzde İngilizce hata çıkmasın ve
 * gönderim zod'a ulaşsın diye native doğrulama kapatıldı; kurallar tek kaynakta
 * (`bakimxDiscountFormSchema`) kalır.
 */
export function BakimxDiscountForm({ workshopId, currentDiscountBps }: BakimxDiscountFormProps) {
  const [isPending, startTransition] = useTransition()
  const [serverError, setServerError] = useState("")
  const [successMessage, setSuccessMessage] = useState("")

  const form = useForm<BakimxDiscountFormValues, unknown, BakimxDiscountFormValues>({
    resolver: typedResolver(bakimxDiscountFormSchema),
    defaultValues: { discountPercent: bpsToPercent(currentDiscountBps) },
  })

  function onSubmit(values: BakimxDiscountFormValues) {
    setServerError("")
    setSuccessMessage("")

    startTransition(async () => {
      const result = await updateWorkshopBakimxDiscount(workshopId, percentToBps(values.discountPercent))
      if (!result.ok) {
        setServerError(result.error)
        toast.error(result.error)
        return
      }
      const message = `GetirBakım iskontosu %${values.discountPercent} olarak güncellendi`
      setSuccessMessage(message)
      toast.success(message)
    })
  }

  return (
    <div className="space-y-4">
      <Form {...form}>
        <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4" noValidate>
          <FormField
            control={form.control}
            name="discountPercent"
            render={({ field }) => (
              <FormItem>
                <FormLabel>GetirBakım İskontosu (%)</FormLabel>
                <FormControl>
                  <Input {...field} type="number" step="0.01" inputMode="decimal" placeholder="0" disabled={isPending} />
                </FormControl>
                <p className="text-xs text-muted-foreground">
                  0 ile 100 arasında. Ondalık değer girilebilir (örn: 15.5 = %15,5).
                </p>
                <FormMessage />
              </FormItem>
            )}
          />

          <Button type="submit" disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Güncelle
          </Button>
        </form>
      </Form>

      {serverError && (
        <Alert variant="destructive">
          <AlertCircle className="size-4" />
          <AlertDescription>{serverError}</AlertDescription>
        </Alert>
      )}

      {successMessage && (
        <Alert className="border-success/20 bg-success/10">
          <AlertDescription className="text-success-strong">{successMessage}</AlertDescription>
        </Alert>
      )}
    </div>
  )
}
