"use client"

import { useCallback, useEffect, useState } from "react"
import { KeyRound, Loader2, RefreshCw, Search } from "lucide-react"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { Button } from "@/components/ui/button"
import { Skeleton } from "@/components/ui/skeleton"

type AdminUsage = {
  summary: {
    budgetMicroUsd: number
    spentMicroUsd: number
    reservedMicroUsd: number
    requestCount: number
    webSearchCount: number
    byokRequestCount: number
  }
}

const usd = new Intl.NumberFormat("tr-TR", { style: "currency", currency: "USD", minimumFractionDigits: 2, maximumFractionDigits: 2 })

export function MarketResearchUsage() {
  const [data, setData] = useState<AdminUsage | null>(null)
  const [error, setError] = useState("")
  const [loading, setLoading] = useState(true)
  const load = useCallback(async () => {
    setLoading(true)
    setError("")
    try {
      const response = await fetch("/api/admin/market-research/usage", { cache: "no-store" })
      const payload = await response.json().catch(() => ({})) as AdminUsage & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Kullanım verisi yüklenemedi.")
      setData(payload)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Kullanım verisi yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    const timeout = window.setTimeout(() => { void load() }, 0)
    return () => window.clearTimeout(timeout)
  }, [load])
  if (loading && !data) return <div className="grid gap-3 sm:grid-cols-3" aria-label="Piyasa araştırması kullanımı yükleniyor"><Skeleton className="h-20" /><Skeleton className="h-20" /><Skeleton className="h-20" /></div>
  if (!data) return <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>

  const { summary } = data
  const budget = summary.budgetMicroUsd / 1_000_000
  const consumed = (summary.spentMicroUsd + summary.reservedMicroUsd) / 1_000_000
  const percentage = budget > 0 ? Math.min((consumed / budget) * 100, 100) : 0

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between gap-3"><p className="text-xs text-muted-foreground">Platform anahtarıyla yapılan çağrılar bütçeden düşer; şirket anahtarlı çağrılar ayrıca sayılır.</p><Button variant="ghost" size="icon-sm" onClick={() => void load()} disabled={loading} aria-label="Piyasa araştırması kullanımını yenile">{loading ? <Loader2 className="animate-spin" aria-hidden="true" /> : <RefreshCw aria-hidden="true" />}</Button></div>
      {error && <Alert variant="destructive"><AlertDescription>{error}</AlertDescription></Alert>}
      <div className="grid gap-3 sm:grid-cols-3">
        <div className="rounded-lg bg-muted p-3"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><Search className="size-3.5" aria-hidden="true" />Başarılı araştırma</p><p className="mt-1 text-xl font-semibold tabular-nums">{summary.requestCount.toLocaleString("tr-TR")}</p><p className="text-xs text-muted-foreground">{summary.webSearchCount.toLocaleString("tr-TR")} web araması</p></div>
        <div className="rounded-lg bg-muted p-3"><p className="flex items-center gap-1.5 text-xs text-muted-foreground"><KeyRound className="size-3.5" aria-hidden="true" />Şirket anahtarlı</p><p className="mt-1 text-xl font-semibold tabular-nums">{summary.byokRequestCount.toLocaleString("tr-TR")}</p><p className="text-xs text-muted-foreground">Platform bütçesinden düşmez</p></div>
        <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">Platform bütçesi</p><p className="mt-1 text-xl font-semibold tabular-nums">{usd.format(consumed)} <span className="text-sm font-normal text-muted-foreground">/ {usd.format(budget)}</span></p><p className="text-xs text-muted-foreground">{usd.format(summary.reservedMicroUsd / 1_000_000)} rezerve</p></div>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-muted" role="progressbar" aria-label="Piyasa araştırması platform bütçesi" aria-valuemin={0} aria-valuemax={summary.budgetMicroUsd} aria-valuenow={summary.spentMicroUsd + summary.reservedMicroUsd}><div className="h-full rounded-full bg-primary" style={{ width: `${percentage}%` }} /></div>
    </div>
  )
}
