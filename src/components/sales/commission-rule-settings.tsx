"use client"

import { useState, useTransition } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import type { BillingCycle, PlanTier } from "@prisma/client"
import { createSalesCommissionRule } from "@/app/admin/sales/settings/actions"
import { salesCommissionRuleSchema } from "@/lib/validations/sales"
import { istanbulDateTimeInputValue } from "@/lib/sales/time"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

type Rule = {
  id: string
  planTier: PlanTier
  billingCycle: BillingCycle
  rateBps: number
  effectiveFrom: string
  effectiveTo: string | null
  createdAt: string
  createdByName: string
}

const PLAN_LABELS: Record<PlanTier, string> = {
  lite: "Lite",
  starter: "Başlangıç",
  pro: "Profesyonel",
  premium: "Premium",
}

export function CommissionRuleSettings({ rules, now }: { rules: Rule[]; now: number }) {
  const [pending, startTransition] = useTransition()
  const [defaultEffectiveFrom] = useState(() => istanbulDateTimeInputValue(new Date()))
  const form = useForm<z.infer<typeof salesCommissionRuleSchema>>({
    resolver: zodResolver(salesCommissionRuleSchema),
    defaultValues: {
      planTier: "pro",
      billingCycle: "monthly",
      ratePercent: 0,
      effectiveFrom: defaultEffectiveFrom,
    },
  })

  const submit = form.handleSubmit((values) => startTransition(async () => {
    const result = await createSalesCommissionRule(values)
    if (!result.ok) toast.error(result.error)
    else toast.success("Yeni hakediş kuralı yürürlük geçmişine eklendi.")
  }))

  return (
    <div className="grid gap-6 lg:grid-cols-[minmax(18rem,0.8fr)_minmax(0,1.4fr)]">
      <Card className="h-fit">
        <CardHeader>
          <CardTitle>Yeni kural</CardTitle>
          <CardDescription>Yüzde belirtilmediği için sistem varsayılan ticari oran üretmez.</CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Alert>
            <AlertTitle>Append-only geçmiş</AlertTitle>
            <AlertDescription>Yeni satır önceki kuralı bu tarihte kapatır; geçmiş oran ve başlangıç değeri değişmez. Daha önce oluşmuş hakediş snapshot’ları etkilenmez.</AlertDescription>
          </Alert>
          <Form {...form}>
            <form onSubmit={submit} className="space-y-4">
              <FormField control={form.control} name="planTier" render={({ field }) => (
                <FormItem>
                  <FormLabel>Paket</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      {Object.entries(PLAN_LABELS).map(([value, label]) => <SelectItem key={value} value={value}>{label}</SelectItem>)}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="billingCycle" render={({ field }) => (
                <FormItem>
                  <FormLabel>Faturalama dönemi</FormLabel>
                  <Select value={field.value} onValueChange={field.onChange}>
                    <FormControl><SelectTrigger><SelectValue /></SelectTrigger></FormControl>
                    <SelectContent>
                      <SelectItem value="monthly">Aylık</SelectItem>
                      <SelectItem value="yearly">Yıllık</SelectItem>
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="ratePercent" render={({ field }) => (
                <FormItem>
                  <FormLabel>Hakediş yüzdesi</FormLabel>
                  <FormControl>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.01"
                      value={field.value}
                      onChange={(event) => field.onChange(Number(event.target.value))}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <FormField control={form.control} name="effectiveFrom" render={({ field }) => (
                <FormItem>
                  <FormLabel>Yürürlük başlangıcı (Europe/Istanbul)</FormLabel>
                  <FormControl><Input type="datetime-local" {...field} /></FormControl>
                  <FormMessage />
                </FormItem>
              )} />
              <Button type="submit" disabled={pending}>Kuralı ekle</Button>
            </form>
          </Form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Kural geçmişi</CardTitle>
          <CardDescription>{rules.length} yürürlük satırı; silme ve yerinde düzenleme yoktur.</CardDescription>
        </CardHeader>
        <CardContent>
          {rules.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">Henüz ticari hakediş kuralı tanımlanmadı.</div>
          ) : (
            <div className="space-y-3">
              {rules.map((rule) => {
                const starts = new Date(rule.effectiveFrom).getTime()
                const ends = rule.effectiveTo ? new Date(rule.effectiveTo).getTime() : null
                const state = starts > now ? "Planlı" : ends != null && ends <= now ? "Sona erdi" : "Etkin"
                return (
                  <article key={rule.id} className="rounded-xl border p-4">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <p className="font-semibold text-foreground">{PLAN_LABELS[rule.planTier]} · {rule.billingCycle === "monthly" ? "Aylık" : "Yıllık"}</p>
                        <p className="mt-1 text-2xl font-bold tabular-nums text-foreground">%{(rule.rateBps / 100).toLocaleString("tr-TR")}</p>
                      </div>
                      <Badge variant={state === "Etkin" ? "default" : "secondary"}>{state}</Badge>
                    </div>
                    <p className="mt-3 text-sm text-muted-foreground">
                      {formatDateTime(rule.effectiveFrom)} → {rule.effectiveTo ? formatDateTime(rule.effectiveTo) : "Açık uçlu"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">Ekleyen: {rule.createdByName} · {formatDateTime(rule.createdAt)}</p>
                  </article>
                )
              })}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function formatDateTime(value: string): string {
  return new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" })
}
