"use client"

import { useState } from "react"
import { AlertTriangle, ExternalLink, Loader2, Search } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"

interface ProbeResult {
  success: true
  domains: string[]
  webSearches: number
  costMicroUsd: number
}

export function MarketResearchProbe() {
  const [query, setQuery] = useState("")
  const [vehicle, setVehicle] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState("")
  const [result, setResult] = useState<ProbeResult | null>(null)

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setPending(true)
    setError("")

    try {
      const response = await fetch("/api/admin/market-research/probe", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ query, vehicle: vehicle || undefined }),
      })
      const payload = await response.json().catch(() => ({})) as Partial<ProbeResult> & { error?: string }
      if (!response.ok) throw new Error(payload.error || "Piyasa araştırması başlatılamadı.")
      setResult(payload as ProbeResult)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Piyasa araştırması başlatılamadı.")
    } finally {
      setPending(false)
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex items-start gap-2 rounded-md border border-warning/30 bg-warning/10 p-3 text-sm">
        <AlertTriangle className="mt-0.5 size-4 shrink-0 text-warning-strong" aria-hidden="true" />
        <p>
          Bu keşif yalnız AWS dev ortamında ve ayda bir kez çalışır. Gerçek sağlayıcı etkinse ücretli bir
          Anthropic çağrısı yapar; sonucu göndermeden önce sorguyu kontrol edin.
        </p>
      </div>

      <form className="grid gap-4 sm:grid-cols-2" onSubmit={submit}>
        <div className="space-y-1.5 sm:col-span-2">
          <Label htmlFor="market-research-query">Aranacak parça</Label>
          <Input
            id="market-research-query"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            minLength={2}
            maxLength={200}
            placeholder="Örn. 2020 Corolla ön fren balatası"
            required
            disabled={pending || Boolean(result)}
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="market-research-vehicle">Araç bilgisi (isteğe bağlı)</Label>
          <Input
            id="market-research-vehicle"
            value={vehicle}
            onChange={(event) => setVehicle(event.target.value)}
            maxLength={200}
            placeholder="Örn. Toyota Corolla 2020 1.6"
            disabled={pending || Boolean(result)}
          />
        </div>
        <div className="flex items-end">
          <Button type="submit" disabled={pending || Boolean(result) || query.trim().length < 2}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
            {pending ? "Araştırılıyor…" : result ? "Keşif tamamlandı" : "Tek keşfi başlat"}
          </Button>
        </div>
      </form>

      {error && (
        <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-strong">
          {error}
        </div>
      )}

      {result && (
        <div className="space-y-3 rounded-md border bg-muted/40 p-4" aria-live="polite">
          <h3 className="font-semibold">Keşif tamamlandı</h3>
          <dl className="grid grid-cols-2 gap-3 text-sm sm:max-w-md">
            <div><dt className="text-muted-foreground">Web araması</dt><dd className="font-semibold tabular-nums">{result.webSearches}</dd></div>
            <div><dt className="text-muted-foreground">Ölçülen maliyet</dt><dd className="font-semibold tabular-nums">${(result.costMicroUsd / 1_000_000).toFixed(6)}</dd></div>
          </dl>
          <div>
            <p className="text-sm font-medium">Kaynak domainleri</p>
            {result.domains.length > 0 ? (
              <ul className="mt-1 space-y-1 text-sm">
                {result.domains.map((domain) => (
                  <li key={domain}>
                    <a className="inline-flex items-center gap-1 text-primary underline-offset-4 hover:underline" href={`https://${domain}`} target="_blank" rel="noreferrer">
                      {domain}<ExternalLink className="size-3.5" aria-hidden="true" />
                    </a>
                  </li>
                ))}
              </ul>
            ) : <p className="mt-1 text-sm text-muted-foreground">Kaynak domaini dönmedi.</p>}
          </div>
        </div>
      )}
    </div>
  )
}
