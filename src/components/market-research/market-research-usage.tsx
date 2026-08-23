"use client"

import { useCallback, useEffect, useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { BarChart3, CheckCircle2, Clock3, KeyRound, Loader2, RefreshCw, Search, ShieldCheck, Trash2 } from "lucide-react"
import { useForm } from "react-hook-form"
import { toast } from "sonner"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription,
  AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger,
} from "@/components/ui/alert-dialog"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Skeleton } from "@/components/ui/skeleton"
import {
  marketResearchCredentialSchema,
  type MarketResearchCredentialValues,
} from "@/lib/validations/market-research"

type UsageRecord = {
  id: string
  status: string
  fundingSource: "platform" | "customer"
  estimatedCostMicroUsd: number
  webSearchCount: number
  createdAt: string
  durationMs?: number | null
}

type UsagePayload = {
  summary: {
    monthStart: string
    monthlyLimit: number
    requestCount: number
    reservedRequests?: number
    remainingRequests: number
    estimatedCostMicroUsd: number
    webSearchCount: number
    platformCostMicroUsd: number
    byokCostMicroUsd: number
  }
  credential: {
    configured: boolean
    maskedLast4?: string | null
    updatedAt?: string | null
    canManage?: boolean
  }
  recent: UsageRecord[]
}

const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 4 })
export const formatMarketResearchCost = (microUsd: number) => usd.format(microUsd / 1_000_000)

function Stat({ label, value, hint, icon: Icon }: { label: string; value: string; hint: string; icon: typeof Search }) {
  return (
    <div className="rounded-lg border bg-card p-3">
      <div className="flex items-center gap-2 text-xs text-muted-foreground"><Icon className="size-3.5" aria-hidden="true" />{label}</div>
      <p className="mt-1 text-xl font-semibold tabular-nums">{value}</p>
      <p className="mt-0.5 text-xs text-muted-foreground">{hint}</p>
    </div>
  )
}

function CredentialCard({ credential, onChanged }: { credential: UsagePayload["credential"]; onChanged: () => void }) {
  const [removing, setRemoving] = useState(false)
  const form = useForm<MarketResearchCredentialValues>({
    resolver: zodResolver(marketResearchCredentialSchema),
    defaultValues: { apiKey: "" },
  })

  async function save(values: MarketResearchCredentialValues) {
    const response = await fetch("/api/market-research/credential", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(values),
    })
    const payload = await response.json().catch(() => ({})) as { error?: string }
    if (!response.ok) {
      form.setError("apiKey", { message: payload.error || "API anahtarı kaydedilemedi." })
      return
    }
    form.reset()
    toast.success(credential.configured ? "API anahtarı güncellendi." : "API anahtarı kaydedildi.")
    onChanged()
  }

  async function remove() {
    setRemoving(true)
    try {
      const response = await fetch("/api/market-research/credential", { method: "DELETE" })
      const payload = await response.json().catch(() => ({})) as { error?: string }
      if (!response.ok) throw new Error(payload.error || "API anahtarı kaldırılamadı.")
      toast.success("API anahtarı kaldırıldı. Yeni araştırmalar platform kotasını kullanacak.")
      onChanged()
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "API anahtarı kaldırılamadı.")
    } finally {
      setRemoving(false)
    }
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2"><KeyRound className="size-4" aria-hidden="true" />Kendi Anthropic anahtarınız</CardTitle>
        <CardDescription>Kendi anahtarınızı kullanan araştırmalar BakımX bütçesinden değil, Anthropic hesabınızdan ücretlendirilir.</CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {credential.configured && (
          <Alert>
            <CheckCircle2 aria-hidden="true" />
            <AlertTitle>Anahtar etkin</AlertTitle>
            <AlertDescription>Kaydedilen anahtar •••• {credential.maskedLast4 || "••••"}. Anahtarın tamamı güvenlik nedeniyle bir daha gösterilmez.</AlertDescription>
          </Alert>
        )}
        <Form {...form}>
          <form onSubmit={form.handleSubmit(save)} className="flex flex-col gap-3 sm:flex-row sm:items-start">
            <FormField control={form.control} name="apiKey" render={({ field }) => (
              <FormItem className="min-w-0 flex-1">
                <FormLabel>{credential.configured ? "Yeni API anahtarı" : "Anthropic API anahtarı"}</FormLabel>
                <FormControl><Input {...field} type="password" autoComplete="off" spellCheck={false} placeholder="sk-ant-…" /></FormControl>
                <FormMessage />
              </FormItem>
            )} />
            <Button type="submit" className="sm:mt-6" disabled={form.formState.isSubmitting}>
              {form.formState.isSubmitting && <Loader2 className="animate-spin" aria-hidden="true" />}
              {credential.configured ? "Anahtarı değiştir" : "Anahtarı kaydet"}
            </Button>
          </form>
        </Form>
        <div className="flex flex-col gap-3 border-t pt-4 text-xs text-muted-foreground sm:flex-row sm:items-center sm:justify-between">
          <p className="flex max-w-xl items-start gap-1.5"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Anahtar şifreli saklanır, hiçbir zaman ekranda veya kullanım kayıtlarında düz metin olarak tutulmaz.</p>
          {credential.configured && (
            <AlertDialog>
              <AlertDialogTrigger asChild><Button type="button" variant="outline" size="sm"><Trash2 aria-hidden="true" />Anahtarı kaldır</Button></AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader><AlertDialogTitle>API anahtarı kaldırılsın mı?</AlertDialogTitle><AlertDialogDescription>Sonraki araştırmalar şirket anahtarını kullanmayacak ve uygun olduğu sürece BakımX platform kotasından düşecektir.</AlertDialogDescription></AlertDialogHeader>
                <AlertDialogFooter><AlertDialogCancel>Vazgeç</AlertDialogCancel><AlertDialogAction variant="destructive" onClick={remove} disabled={removing}>Kaldır</AlertDialogAction></AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          )}
        </div>
      </CardContent>
    </Card>
  )
}

export function MarketResearchUsage({ canManageCredential, refreshKey }: { canManageCredential: boolean; refreshKey: number }) {
  const [data, setData] = useState<UsagePayload | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/market-research/usage", { cache: "no-store" })
      const payload = await response.json().catch(() => ({})) as UsagePayload & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Kullanım bilgileri yüklenemedi.")
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kullanım bilgileri yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timeout)
  }, [load, refreshKey])

  if (loading && !data) return <UsageSkeleton />
  if (error && !data) return <Alert variant="destructive"><AlertTitle>Kullanım bilgileri gösterilemiyor</AlertTitle><AlertDescription>{error}</AlertDescription></Alert>
  if (!data) return null

  const { summary, credential, recent } = data
  const used = summary.requestCount + (summary.reservedRequests || 0)
  const percentage = summary.monthlyLimit > 0 ? Math.min((used / summary.monthlyLimit) * 100, 100) : 0

  return (
    <section className="space-y-4" aria-labelledby="market-usage-title">
      <div className="flex items-center justify-between gap-3">
        <div><h2 id="market-usage-title" className="text-lg font-semibold">Bu ayki kullanım</h2><p className="text-sm text-muted-foreground">Araştırma kotanızı ve tahmini sağlayıcı maliyetini izleyin.</p></div>
        <Button variant="ghost" size="icon-sm" onClick={() => void load()} disabled={loading} aria-label="Kullanımı yenile"><RefreshCw className={loading ? "animate-spin" : undefined} aria-hidden="true" /></Button>
      </div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <Stat label="Araştırma" value={`${summary.requestCount} / ${summary.monthlyLimit}`} hint={`${summary.remainingRequests} araştırma kaldı`} icon={Search} />
        <Stat label="Tahmini harcama" value={formatMarketResearchCost(summary.estimatedCostMicroUsd)} hint="Anthropic kullanım tahmini" icon={BarChart3} />
        <Stat label="Web araması" value={summary.webSearchCount.toLocaleString("tr-TR")} hint="Bu ay kullanılan arama" icon={Search} />
        <Stat label="Aktif kaynak" value={credential.configured ? "Kendi anahtarınız" : "BakımX"} hint={credential.configured ? "Şirket hesabınıza yansır" : "Platform bütçesinden karşılanır"} icon={KeyRound} />
      </div>
      <div>
        <div className="mb-1.5 flex justify-between text-xs"><span className="text-muted-foreground">Aylık kota</span><span className="tabular-nums">%{percentage.toFixed(0)}</span></div>
        <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Aylık araştırma kotası" aria-valuemin={0} aria-valuemax={summary.monthlyLimit} aria-valuenow={used}><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div>
      </div>
      <Card>
        <CardHeader><CardTitle>Harcama dağılımı</CardTitle><CardDescription>Tutarlar sağlayıcının bildirdiği token ve web araması kullanımından hesaplanan tahminlerdir; fatura tutarı farklı olabilir.</CardDescription></CardHeader>
        <CardContent className="grid gap-3 sm:grid-cols-2"><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">BakımX tarafından karşılanan</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatMarketResearchCost(summary.platformCostMicroUsd)}</p></div><div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Şirket anahtarınıza yansıyan</p><p className="mt-1 text-lg font-semibold tabular-nums">{formatMarketResearchCost(summary.byokCostMicroUsd)}</p></div></CardContent>
      </Card>
      {canManageCredential && <CredentialCard credential={credential} onChanged={() => void load()} />}
      {!canManageCredential && credential.configured && <Alert><ShieldCheck aria-hidden="true" /><AlertTitle>Şirket anahtarı etkin</AlertTitle><AlertDescription>API anahtarını yalnız şirket sahibi değiştirebilir veya kaldırabilir.</AlertDescription></Alert>}
      <Card>
        <CardHeader><CardTitle>Son kullanımlar</CardTitle><CardDescription>Gizlilik için arama metinleri ve API anahtarları bu kayıtlarda yer almaz.</CardDescription></CardHeader>
        <CardContent>
          {recent.length === 0 ? <p className="py-5 text-center text-sm text-muted-foreground">Bu ay henüz araştırma yapılmadı.</p> : (
            <ul className="divide-y" aria-label="Son piyasa araştırmaları">
              {recent.map((record) => <li key={record.id} className="flex flex-col gap-2 py-3 first:pt-0 last:pb-0 sm:flex-row sm:items-center sm:justify-between"><div className="flex items-center gap-2"><Clock3 className="size-4 text-muted-foreground" aria-hidden="true" /><div><p className="text-sm font-medium">{new Date(record.createdAt).toLocaleString("tr-TR")}</p><p className="text-xs text-muted-foreground">{record.webSearchCount} web araması{record.durationMs ? ` · ${(record.durationMs / 1000).toFixed(1)} sn` : ""}</p></div></div><div className="flex flex-wrap items-center gap-2 sm:justify-end"><Badge variant="outline">{record.status === "succeeded" ? "Tamamlandı" : record.status === "running" ? "Sürüyor" : "Başarısız"}</Badge><Badge variant="outline">{record.fundingSource === "customer" ? "Şirket anahtarı" : "BakımX"}</Badge><span className="min-w-20 text-right text-sm font-medium tabular-nums">{record.status === "succeeded" ? formatMarketResearchCost(record.estimatedCostMicroUsd) : "—"}</span></div></li>)}
            </ul>
          )}
        </CardContent>
      </Card>
    </section>
  )
}

function UsageSkeleton() {
  return <div className="space-y-4" aria-label="Kullanım bilgileri yükleniyor"><Skeleton className="h-12 w-56" /><div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">{Array.from({ length: 4 }, (_, index) => <Skeleton key={index} className="h-24" />)}</div><Skeleton className="h-40" /></div>
}
