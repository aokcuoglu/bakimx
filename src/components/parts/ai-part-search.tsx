"use client"

import { FormEvent, useState } from "react"
import { Bot, Loader2, PackageSearch, Plus, ShieldCheck } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { formatTRY } from "@/lib/format"
import type { AiPartSuggestion } from "@/lib/parts/ai-search"

export function AiPartSearch({ vehicleTypeId, disabled, onAdd }: { vehicleTypeId: number | null; disabled?: boolean; onAdd: (suggestion: AiPartSuggestion) => Promise<void> }) {
  const [message, setMessage] = useState("")
  const [query, setQuery] = useState("")
  const [suggestions, setSuggestions] = useState<AiPartSuggestion[]>([])
  const [loading, setLoading] = useState(false)
  const [adding, setAdding] = useState<string | null>(null)
  const [error, setError] = useState("")

  async function search(event: FormEvent) {
    event.preventDefault()
    if (message.trim().length < 2) return
    setLoading(true); setError(""); setSuggestions([])
    try {
      const response = await fetch("/api/parts/ai-search", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ message, vehicleTypeId }) })
      const data = await response.json() as { error?: string; query?: string; suggestions?: AiPartSuggestion[] }
      if (!response.ok) throw new Error(data.error || "Arama yapılamadı")
      setQuery(data.query || message); setSuggestions(data.suggestions || [])
    } catch (err) { setError(err instanceof Error ? err.message : "Arama yapılamadı") }
    finally { setLoading(false) }
  }

  async function add(item: AiPartSuggestion) {
    setAdding(item.key); setError("")
    try { await onAdd(item) }
    catch (err) { setError(err instanceof Error ? err.message : "Parça eklenemedi") }
    finally { setAdding(null) }
  }

  return (
    <div className="space-y-3 rounded-xl border border-primary/20 bg-gradient-to-br from-primary/5 to-card p-4">
      <div className="flex items-start gap-2">
        <Bot className="mt-0.5 size-4 shrink-0 text-primary" />
        <div><h3 className="text-sm font-semibold">AI Parça Bulucu</h3><p className="text-xs text-muted-foreground">İhtiyacınızı doğal dille yazın; stok ve kataloglar birlikte aransın.</p></div>
      </div>
      <form onSubmit={search} className="flex flex-col gap-2 sm:flex-row">
        <Input aria-label="Aranacak parçayı tarif edin" value={message} onChange={(e) => setMessage(e.target.value)} placeholder="Örn. 2018 Corolla için ön fren balatası" disabled={loading || disabled} maxLength={500} />
        <Button type="submit" size="sm" disabled={loading || disabled || message.trim().length < 2}>{loading ? <Loader2 className="size-4 animate-spin" /> : <PackageSearch className="size-4" />} Ara</Button>
      </form>
      {error && <p role="alert" className="rounded-md bg-destructive/10 px-3 py-2 text-sm text-destructive-strong">{error}</p>}
      {!loading && query && suggestions.length === 0 && !error && <p className="text-sm text-muted-foreground">“{query}” için sonuç bulunamadı. Parça numarası veya daha kısa bir ad deneyin.</p>}
      {suggestions.length > 0 && <div className="space-y-2" aria-live="polite">
        <p className="text-xs text-muted-foreground">“{query}” için {suggestions.length} öneri</p>
        {suggestions.map((item) => <div key={item.key} className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-center">
          <div className="min-w-0 flex-1"><div className="flex flex-wrap items-center gap-1.5"><span className="rounded bg-primary/10 px-1.5 py-0.5 text-[11px] font-medium text-primary-strong">{item.sourceLabel}</span>{item.stockLabel && <span className="text-xs text-muted-foreground">{item.stockLabel}</span>}</div><p className="mt-1 text-sm font-medium">{item.name}</p><p className="text-xs text-muted-foreground">{[item.brand, item.sku].filter(Boolean).join(" · ") || "Parça bilgisi yok"}{item.priceKurus != null ? ` · ${formatTRY(item.priceKurus)}` : ""}</p></div>
          <Button type="button" size="sm" variant="outline" disabled={adding != null || disabled} onClick={() => void add(item)}>{adding === item.key ? <Loader2 className="size-4 animate-spin" /> : <Plus className="size-4" />} Kaleme ekle</Button>
        </div>)}
      </div>}
      <p className="flex items-start gap-1.5 text-[11px] text-muted-foreground"><ShieldCheck className="mt-0.5 size-3 shrink-0" />AI yalnız arama sorgusunu hazırlar. Hiçbir parça siz “Kaleme ekle” düğmesine basmadan iş emrine eklenmez.</p>
    </div>
  )
}
