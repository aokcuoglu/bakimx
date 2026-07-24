"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { Car, User, Search } from "lucide-react"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
import { InputGroup, InputGroupAddon, InputGroupInput } from "@/components/ui/input-group"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import type { UnifiedResult } from "@/lib/search/unified-results"
import { resultHref, fetchGlobalSearchResults } from "./global-search"

const MIN_QUERY = 2

/**
 * Üst başlık araması: plaka/müşteri yazınca birleşik arama backend'inden canlı
 * araç/müşteri sonuçları listeler; bir sonuç seçilince ilgili detay sayfasına
 * gider ve kutuyu temizler. part-search-input.tsx ile aynı Base UI Autocomplete
 * desenini izler (serbest metin + async `items`, `filter={null}`).
 */
export function GlobalSearch({ className }: { className?: string }) {
  const router = useRouter()
  const [query, setQuery] = useState("")
  const [results, setResults] = useState<UnifiedResult[]>([])
  const [loading, setLoading] = useState(false)

  useEffect(() => {
    const q = query.trim()
    if (q.length < MIN_QUERY) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      setLoading(false)
      return
    }
    let active = true
    setLoading(true)
    const t = setTimeout(async () => {
      const found = await fetchGlobalSearchResults(q)
      if (!active) return
      setResults(found)
      setLoading(false)
    }, 250)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [query])

  function select(r: UnifiedResult) {
    setQuery("")
    setResults([])
    router.push(resultHref(r))
  }

  const q = query.trim()
  const showContent = q.length >= MIN_QUERY

  return (
    <Autocomplete
      items={results}
      value={query}
      filter={null}
      autoHighlight
      itemToStringValue={(r: UnifiedResult) => r.label}
      onValueChange={(v: string) => setQuery(v)}
    >
      <div className={className}>
        <InputGroup>
          <AutocompleteInput
            render={
              <InputGroupInput
                type="search"
                placeholder="Plaka veya müşteri ara"
                aria-label="Plaka veya müşteri ara"
                className="text-sm"
              />
            }
          />
          <InputGroupAddon align="inline-start">
            <Search aria-hidden className="size-4 text-muted-foreground/70" />
          </InputGroupAddon>
        </InputGroup>
      </div>

      {showContent && (
        <AutocompleteContent>
          {loading ? (
            <div className="flex items-center justify-center gap-2 px-3 py-4 text-sm text-muted-foreground">
              <BrandSpinner size={16} />
              <span>Aranıyor…</span>
            </div>
          ) : (
            <>
              <AutocompleteEmpty>Sonuç bulunamadı</AutocompleteEmpty>
              <AutocompleteList>
                {(r: UnifiedResult) => (
                  <AutocompleteItem
                    key={r.kind === "vehicle" ? `v-${r.vehicleId}` : `c-${r.customerId}`}
                    value={r}
                    onClick={(e) => {
                      e.preventBaseUIHandler()
                      select(r)
                    }}
                  >
                    {r.kind === "vehicle" ? (
                      <Car className="size-4 text-primary" />
                    ) : (
                      <User className="size-4 text-muted-foreground" />
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block truncate">{r.label}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        {r.sublabel}
                      </span>
                    </span>
                  </AutocompleteItem>
                )}
              </AutocompleteList>
            </>
          )}
        </AutocompleteContent>
      )}
    </Autocomplete>
  )
}
