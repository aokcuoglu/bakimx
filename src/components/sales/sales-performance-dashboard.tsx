"use client"

import { useMemo, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { ArrowLeft, ArrowRight, CalendarRange, CircleDollarSign, Clock3, Target, TrendingUp, Users } from "lucide-react"
import { setSalesMonthlyTarget } from "@/app/admin/sales/performance/actions"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { formatMinor } from "@/lib/billing/pricing"
import { SALES_FUNNEL_STATUSES, type SalesAdvisorPerformance, type SalesFunnelStatus } from "@/lib/sales/performance"
import type { SalesPerformanceReport } from "@/lib/sales/performance-query"
import { salesMonthlyTargetSchema } from "@/lib/validations/sales"

const FUNNEL_LABELS: Record<SalesFunnelStatus, string> = {
  new: "Yeni",
  contacted: "İletişim",
  demo_scheduled: "Demo planlı",
  demo_completed: "Demo yapıldı",
  proposal: "Teklif",
  onboarding: "Kayıt",
  won: "Kazanıldı",
  lost: "Kaybedildi",
}

const TARGET_METRICS = [
  { key: "newLeads", label: "Yeni aday" },
  { key: "qualifiedInteractions", label: "Nitelikli görüşme" },
  { key: "completedDemos", label: "Tamamlanan demo" },
  { key: "wonWorkshops", label: "Kazanılan şirket" },
  { key: "netSalesMinor", label: "KDV hariç net satış", money: true },
] as const

function reportHref(month: string, advisorId: string | null): string {
  const query = new URLSearchParams({ month })
  if (advisorId) query.set("advisor", advisorId)
  return `/admin/sales/performance?${query}`
}

function rateLabel(value: number | null): string {
  return value == null ? "—" : `%${value.toLocaleString("tr-TR", { maximumFractionDigits: 2 })}`
}

function targetValue(row: SalesAdvisorPerformance, key: typeof TARGET_METRICS[number]["key"]): number {
  return row.target[key]
}

function actualValue(row: SalesAdvisorPerformance, key: typeof TARGET_METRICS[number]["key"]): number {
  return row.actual[key]
}

function progressPercent(actual: number, target: number): number {
  if (target <= 0) return 0
  return Math.min(100, Math.round((actual / target) * 100))
}

export function SalesPerformanceDashboard({ report }: { report: SalesPerformanceReport }) {
  const router = useRouter()
  const summary = report.summary

  return (
    <div className="space-y-6">
      <Card>
        <CardContent className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-2">
            <Button asChild variant="outline" size="icon-sm" aria-label="Önceki ay">
              <Link href={reportHref(report.period.previousKey, report.selectedAdvisorId)}><ArrowLeft className="size-4" /></Link>
            </Button>
            <div className="min-w-40 text-center">
              <p className="text-xs text-muted-foreground">Europe/Istanbul dönemi</p>
              <p className="font-semibold capitalize text-foreground">{report.period.label}</p>
            </div>
            <Button asChild variant="outline" size="icon-sm" aria-label="Sonraki ay">
              <Link href={reportHref(report.period.nextKey, report.selectedAdvisorId)}><ArrowRight className="size-4" /></Link>
            </Button>
          </div>
          {!report.isAdvisor && (
            <div className="w-full sm:w-72">
              <Select
                value={report.selectedAdvisorId ?? "all"}
                onValueChange={(value) => router.push(reportHref(report.period.key, value === "all" ? null : value))}
              >
                <SelectTrigger aria-label="Danışman filtresi"><SelectValue placeholder="Ekip toplamı" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Tüm ekip</SelectItem>
                  {report.advisors.map((advisor) => <SelectItem key={advisor.id} value={advisor.id}>{advisor.name}</SelectItem>)}
                </SelectContent>
              </Select>
            </div>
          )}
        </CardContent>
      </Card>

      {report.rows.length === 0 ? (
        <Card>
          <CardContent className="py-12 text-center">
            <Users className="mx-auto size-8 text-muted-foreground" />
            <h2 className="mt-3 text-base font-semibold text-foreground">Etkin satış danışmanı yok</h2>
            <p className="mt-1 text-sm text-muted-foreground">Performans raporu, etkin bir danışman eklendiğinde oluşacak.</p>
            {report.canManageTargets && <Button asChild className="mt-4"><Link href="/admin/sales/advisors">Danışmanları yönet</Link></Button>}
          </CardContent>
        </Card>
      ) : (
        <>
          <section aria-label="Hedef gerçekleşme" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
            {TARGET_METRICS.map((metric) => {
              const actual = actualValue(summary, metric.key)
              const target = targetValue(summary, metric.key)
              const percent = progressPercent(actual, target)
              const isMoney = "money" in metric && metric.money
              return (
                <Card key={metric.key} size="sm">
                  <CardContent>
                    <p className="text-xs font-medium text-muted-foreground">{metric.label}</p>
                    <p className="mt-1 text-xl font-bold tabular-nums text-foreground">
                      {isMoney ? formatMinor(actual) : actual.toLocaleString("tr-TR")}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground">
                      {target > 0 ? `${isMoney ? formatMinor(target) : target.toLocaleString("tr-TR")} hedef · %${percent}` : "Hedef tanımlanmadı"}
                    </p>
                    <div
                      className="mt-3 h-1.5 overflow-hidden rounded-full bg-muted"
                      role="progressbar"
                      aria-label={`${metric.label} hedef ilerlemesi`}
                      aria-valuenow={percent}
                      aria-valuemin={0}
                      aria-valuemax={100}
                    >
                      <div className="h-full rounded-full bg-primary transition-[width]" style={{ width: `${percent}%` }} />
                    </div>
                  </CardContent>
                </Card>
              )
            })}
          </section>

          <section aria-label="Dönem göstergeleri" className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <MetricCard icon={TrendingUp} label="Kapanış oranı" value={rateLabel(summary.actual.closingRate)} detail={`${summary.actual.closedWon} kazanım / ${summary.actual.closedLost} kayıp`} />
            <MetricCard icon={Clock3} label="Geciken takip" value={summary.actual.overdueTasks.toLocaleString("tr-TR")} detail="Şu anda gecikmiş planlı görev" />
            <MetricCard icon={CircleDollarSign} label="Hesaplanan hakediş" value={formatMinor(summary.commissions.calculatedMinor)} detail={`Onaylı ${formatMinor(summary.commissions.approvedMinor)}`} />
            <MetricCard icon={Target} label="Ödenen hakediş" value={formatMinor(summary.commissions.paidMinor)} detail="Ledger’daki ödenmiş toplam" />
          </section>

          <Card>
            <CardHeader>
              <CardTitle>Mevcut satış hunisi</CardTitle>
              <CardDescription>Seçili danışman kapsamındaki adayların güncel aşamalarıdır; dönem filtresinden bağımsızdır.</CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-8">
              {SALES_FUNNEL_STATUSES.map((status) => (
                <div key={status} className="rounded-lg border bg-muted/50 p-3">
                  <p className="text-xs text-muted-foreground-strong">{FUNNEL_LABELS[status]}</p>
                  <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{summary.funnel[status]}</p>
                </div>
              ))}
            </CardContent>
          </Card>

          <TrendCard row={summary} />
          {!report.isAdvisor && <Comparison rows={report.rows} />}
          {report.canManageTargets && <TargetEditor month={report.period.key} rows={report.rows} />}
        </>
      )}
    </div>
  )
}

function MetricCard({ icon: Icon, label, value, detail }: { icon: typeof Target; label: string; value: string; detail: string }) {
  return (
    <Card size="sm">
      <CardContent className="flex items-start gap-3">
        <div className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary-strong"><Icon className="size-4" /></div>
        <div className="min-w-0">
          <p className="text-xs text-muted-foreground">{label}</p>
          <p className="mt-0.5 truncate text-lg font-bold tabular-nums text-foreground">{value}</p>
          <p className="mt-0.5 text-xs text-muted-foreground">{detail}</p>
        </div>
      </CardContent>
    </Card>
  )
}

function TrendCard({ row }: { row: SalesAdvisorPerformance }) {
  const maxActivity = Math.max(1, ...row.trend.map((bucket) => Math.max(bucket.newLeads, bucket.qualifiedInteractions)))
  return (
    <Card>
      <CardHeader>
        <CardTitle>Dönem trendi</CardTitle>
        <CardDescription>Haftalık aday, nitelikli görüşme, kazanım ve KDV hariç net satış.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="grid min-h-52 grid-cols-4 items-end gap-3 sm:grid-cols-5" aria-label="Haftalık satış performansı grafiği">
          {row.trend.map((bucket) => (
            <div key={bucket.key} className="flex min-w-0 flex-col items-center gap-2">
              <div className="flex h-32 w-full max-w-20 items-end justify-center gap-1 rounded-lg bg-muted/50 px-2 pt-2">
                <div className="w-3 rounded-t bg-primary" style={{ height: bucket.newLeads === 0 ? "0" : `${Math.max(4, (bucket.newLeads / maxActivity) * 100)}%` }} aria-label={`${bucket.newLeads} yeni aday`} />
                <div className="w-3 rounded-t bg-success" style={{ height: bucket.qualifiedInteractions === 0 ? "0" : `${Math.max(4, (bucket.qualifiedInteractions / maxActivity) * 100)}%` }} aria-label={`${bucket.qualifiedInteractions} nitelikli görüşme`} />
              </div>
              <div className="text-center">
                <p className="text-xs font-medium text-foreground">{bucket.label}</p>
                <p className="text-[11px] text-muted-foreground">{bucket.wonWorkshops} kazanım</p>
                <p className="truncate text-[11px] text-muted-foreground">{formatMinor(bucket.netSalesMinor)}</p>
              </div>
            </div>
          ))}
        </div>
        <div className="mt-4 flex flex-wrap justify-center gap-4 text-xs text-muted-foreground">
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-primary" /> Yeni aday</span>
          <span className="flex items-center gap-1.5"><span className="size-2 rounded-full bg-success" /> Nitelikli görüşme</span>
        </div>
      </CardContent>
    </Card>
  )
}

function Comparison({ rows }: { rows: SalesAdvisorPerformance[] }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>Danışman karşılaştırması</CardTitle>
        <CardDescription>Hedefler, gerçekleşenler ve kapanış performansı aynı dönem içinde karşılaştırılır.</CardDescription>
      </CardHeader>
      <CardContent>
        <div className="space-y-3 md:hidden">
          {rows.map((row) => (
            <article key={row.advisorId} className="rounded-lg border p-3">
              <div className="flex items-center justify-between gap-2"><p className="font-medium text-foreground">{row.name}</p><Badge variant="secondary">{rateLabel(row.actual.closingRate)}</Badge></div>
              <div className="mt-3 grid grid-cols-2 gap-2 text-xs">
                <ValuePair label="Aday" actual={row.actual.newLeads} target={row.target.newLeads} />
                <ValuePair label="Görüşme" actual={row.actual.qualifiedInteractions} target={row.target.qualifiedInteractions} />
                <ValuePair label="Demo" actual={row.actual.completedDemos} target={row.target.completedDemos} />
                <ValuePair label="Kazanım" actual={row.actual.wonWorkshops} target={row.target.wonWorkshops} />
              </div>
              <p className="mt-3 text-xs text-muted-foreground">Net satış: <span className="font-medium text-foreground">{formatMinor(row.actual.netSalesMinor)}</span> / {formatMinor(row.target.netSalesMinor)}</p>
            </article>
          ))}
        </div>
        <Table containerClassName="hidden md:block">
          <TableHeader><TableRow><TableHead>Danışman</TableHead><TableHead>Aday</TableHead><TableHead>Görüşme</TableHead><TableHead>Demo</TableHead><TableHead>Kazanım</TableHead><TableHead>Kapanış</TableHead><TableHead>Net satış</TableHead><TableHead>Geciken</TableHead></TableRow></TableHeader>
          <TableBody>
            {rows.map((row) => (
              <TableRow key={row.advisorId}>
                <TableCell className="font-medium">{row.name}</TableCell>
                <TableCell>{row.actual.newLeads} / {row.target.newLeads}</TableCell>
                <TableCell>{row.actual.qualifiedInteractions} / {row.target.qualifiedInteractions}</TableCell>
                <TableCell>{row.actual.completedDemos} / {row.target.completedDemos}</TableCell>
                <TableCell>{row.actual.wonWorkshops} / {row.target.wonWorkshops}</TableCell>
                <TableCell>{rateLabel(row.actual.closingRate)}</TableCell>
                <TableCell>{formatMinor(row.actual.netSalesMinor)} / {formatMinor(row.target.netSalesMinor)}</TableCell>
                <TableCell>{row.actual.overdueTasks}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </CardContent>
    </Card>
  )
}

function ValuePair({ label, actual, target }: { label: string; actual: number; target: number }) {
  return <p className="rounded-md bg-muted/50 p-2 text-muted-foreground-strong">{label}<span className="mt-0.5 block font-semibold text-foreground">{actual} / {target}</span></p>
}

function TargetEditor({ month, rows }: { month: string; rows: SalesAdvisorPerformance[] }) {
  const [pending, startTransition] = useTransition()
  const [serverError, setServerError] = useState<string | null>(null)
  const initial = rows[0]
  const form = useForm<z.infer<typeof salesMonthlyTargetSchema>>({
    resolver: zodResolver(salesMonthlyTargetSchema),
    defaultValues: targetDefaults(initial, month),
  })
  const rowById = useMemo(() => new Map(rows.map((row) => [row.advisorId, row])), [rows])

  const submit = form.handleSubmit((values) => startTransition(async () => {
    setServerError(null)
    const result = await setSalesMonthlyTarget(values)
    if (!result.ok) {
      setServerError(result.error)
      return
    }
    toast.success("Aylık satış hedefleri kaydedildi.")
  }))

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><CalendarRange className="size-5 text-primary" /> Aylık hedef tanımlama</CardTitle>
        <CardDescription>Kurucu hedefleri danışman ve Europe/Istanbul ayı için günceller.</CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={submit} className="space-y-4">
            {serverError && <Alert variant="destructive"><AlertTitle>Hedef kaydedilemedi</AlertTitle><AlertDescription>{serverError}</AlertDescription></Alert>}
            <FormField control={form.control} name="advisorId" render={({ field }) => (
              <FormItem className="max-w-md">
                <FormLabel>Satış danışmanı</FormLabel>
                <Select value={field.value} onValueChange={(value) => {
                  const row = rowById.get(value)
                  if (row) form.reset(targetDefaults(row, month))
                }}>
                  <FormControl><SelectTrigger><SelectValue placeholder="Danışman seçin" /></SelectTrigger></FormControl>
                  <SelectContent>{rows.map((row) => <SelectItem key={row.advisorId} value={row.advisorId}>{row.name}</SelectItem>)}</SelectContent>
                </Select>
                <FormMessage />
              </FormItem>
            )} />
            <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-5">
              <TargetNumberField form={form} name="newLeadTarget" label="Yeni aday" />
              <TargetNumberField form={form} name="qualifiedInteractionTarget" label="Nitelikli görüşme" />
              <TargetNumberField form={form} name="completedDemoTarget" label="Tamamlanan demo" />
              <TargetNumberField form={form} name="wonWorkshopTarget" label="Kazanılan şirket" />
              <FormField control={form.control} name="netSalesTarget" render={({ field }) => (
                <FormItem><FormLabel>Net satış (₺)</FormLabel><FormControl><Input type="number" min="0" step="0.01" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>
              )} />
            </div>
            <Button type="submit" disabled={pending}>{pending ? "Kaydediliyor…" : "Hedefleri kaydet"}</Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  )
}

function TargetNumberField({ form, name, label }: {
  form: ReturnType<typeof useForm<z.infer<typeof salesMonthlyTargetSchema>>>
  name: "newLeadTarget" | "qualifiedInteractionTarget" | "completedDemoTarget" | "wonWorkshopTarget"
  label: string
}) {
  return <FormField control={form.control} name={name} render={({ field }) => (
    <FormItem><FormLabel>{label}</FormLabel><FormControl><Input type="number" min="0" step="1" value={field.value} onChange={(event) => field.onChange(Number(event.target.value))} /></FormControl><FormMessage /></FormItem>
  )} />
}

function targetDefaults(row: SalesAdvisorPerformance, month: string): z.infer<typeof salesMonthlyTargetSchema> {
  return {
    advisorId: row.advisorId,
    month,
    newLeadTarget: row.target.newLeads,
    qualifiedInteractionTarget: row.target.qualifiedInteractions,
    completedDemoTarget: row.target.completedDemos,
    wonWorkshopTarget: row.target.wonWorkshops,
    netSalesTarget: row.target.netSalesMinor / 100,
  }
}
