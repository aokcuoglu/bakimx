"use client"

import { useState } from "react"
import { zodResolver } from "@hookform/resolvers/zod"
import { ExternalLink, Loader2, Search, ShieldCheck } from "lucide-react"
import { useForm } from "react-hook-form"
import { Button } from "@/components/ui/button"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import type { MarketResearchSuggestion } from "@/lib/market-research/types"
import { marketResearchSchema, type MarketResearchValues } from "@/lib/validations/market-research"

export function MarketResearchForm({ onResearchComplete }: { onResearchComplete?: () => void }) {
  const [suggestions, setSuggestions] = useState<MarketResearchSuggestion[]>([])
  const [searched, setSearched] = useState(false)
  const [error, setError] = useState("")
  const form = useForm<MarketResearchValues>({
    resolver: zodResolver(marketResearchSchema),
    defaultValues: { query: "", vehicle: "", partNumbers: "" },
  })

  async function submit(values: MarketResearchValues) {
    setError("")
    setSearched(false)
    setSuggestions([])
    try {
      const response = await fetch("/api/market-research", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(values),
      })
      const payload = await response.json().catch(() => ({})) as { error?: string; suggestions?: MarketResearchSuggestion[] }
      if (!response.ok) throw new Error(payload.error || "Piyasa araştırması başlatılamadı.")
      setSuggestions(payload.suggestions || [])
      setSearched(true)
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : "Piyasa araştırması başlatılamadı.")
    } finally {
      onResearchComplete?.()
    }
  }

  const pending = form.formState.isSubmitting

  return (
    <div className="space-y-5">
      <Form {...form}>
      <form onSubmit={form.handleSubmit(submit)} className="grid gap-4 rounded-xl border bg-card p-4 sm:grid-cols-2 sm:p-5">
        <FormField control={form.control} name="query" render={({ field }) => <FormItem className="sm:col-span-2"><FormLabel>Aranacak parça</FormLabel><FormControl><Input {...field} minLength={2} maxLength={200} placeholder="Örn. Tesla Model Y ön fren balatası" disabled={pending} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="vehicle" render={({ field }) => <FormItem><FormLabel>Araç bilgisi (isteğe bağlı)</FormLabel><FormControl><Input {...field} maxLength={200} placeholder="Örn. Tesla Model Y 2025" disabled={pending} /></FormControl><FormMessage /></FormItem>} />
        <FormField control={form.control} name="partNumbers" render={({ field }) => <FormItem><FormLabel>Parça numaraları (isteğe bağlı)</FormLabel><FormControl><Input {...field} maxLength={300} placeholder="Virgülle ayırın" disabled={pending} /></FormControl><FormMessage /></FormItem>} />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>
            {pending ? <Loader2 className="animate-spin" aria-hidden="true" /> : <Search aria-hidden="true" />}
            {pending ? "Araştırılıyor…" : "Piyasada Ara"}
          </Button>
        </div>
      </form>
      </Form>

      {error && <div role="alert" className="rounded-md border border-destructive/30 bg-destructive/10 p-3 text-sm text-destructive-strong">{error}</div>}
      {searched && suggestions.length === 0 && <p className="rounded-md border bg-card p-4 text-sm text-muted-foreground">Doğrulanabilir kaynağı olan bir sonuç bulunamadı. Daha açık bir parça adı veya numarası deneyin.</p>}
      {suggestions.length > 0 && <div className="grid gap-3" aria-live="polite">
        {suggestions.map((item, index) => <article key={`${item.name}-${item.partNumber}-${index}`} className="rounded-xl border bg-card p-4">
          <div className="flex flex-wrap items-start justify-between gap-2">
            <div><h2 className="font-semibold">{item.name}</h2><p className="mt-1 text-sm text-muted-foreground">{[item.brand, item.partNumber].filter(Boolean).join(" · ") || "Marka / parça numarası belirtilmedi"}</p></div>
            {item.priceText && <span className="rounded-full bg-primary/10 px-2.5 py-1 text-sm font-semibold text-primary-strong">{item.priceText}</span>}
          </div>
          {item.notes && <p className="mt-3 text-sm">{item.notes}</p>}
          <div className="mt-3 flex flex-wrap gap-2">
            {item.sources.map((source) => <Button key={source.url} variant="outline" size="sm" asChild><a href={source.url} target="_blank" rel="noreferrer">{source.title}<ExternalLink aria-hidden="true" /></a></Button>)}
          </div>
        </article>)}
      </div>}
      <p className="flex items-start gap-1.5 text-xs text-muted-foreground"><ShieldCheck className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />Sonuçlar fiyat ve uyumluluk için başlangıç noktasıdır. Siparişten önce satıcı kaynağını ve araç uyumluluğunu doğrulayın.</p>
    </div>
  )
}
