"use client"

import { useEffect, useRef, useState } from "react"
import {
  InputGroup,
  InputGroupAddon,
  InputGroupButton,
  InputGroupInput,
} from "@/components/ui/input-group"
import {
  Autocomplete,
  AutocompleteInput,
  AutocompleteContent,
  AutocompleteList,
  AutocompleteItem,
  AutocompleteEmpty,
} from "@/components/ui/autocomplete"
import { PackageSearch, XIcon } from "lucide-react"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"

/**
 * "Parça adı" alanı: serbest metin + (araç kataloğa bağlıysa) cache'lenmiş
 * parçalarda ad/numara ile canlı arama. Yazarken free-text `onNameChange` ile
 * korunur (katalogda olmayan ad da yazılabilir); bir öneri seçilince
 * `onSelectArticle` ile satır doldurulur. autoHighlight → Enter ilk sonucu seçer.
 * Araç kataloğa bağlı değilse düz Input gibi davranır.
 */
export function PartSearchInput({
  value,
  vehicleTypeId,
  disabled,
  placeholder,
  onNameChange,
  onSelectArticle,
  onCommit,
  onClear,
  showClear,
}: {
  value: string
  vehicleTypeId: number | null
  disabled?: boolean
  placeholder?: string
  /** Yazarken çağrılır — YALNIZ yerel güncelleme (kaydetmez); katalog modunda arama sorgusu. */
  onNameChange: (name: string) => void
  onSelectArticle: (a: ArticleSearchResult) => void
  /** Serbest-metin adı kalıcılaştır (yalnız katalogsuz modda blur'da; katalogda seçim kalıcılaştırır). */
  onCommit?: () => void
  /** Parça seçimini (ad/SKU/marka/kategori) temizler; showClear ile gösterilir. */
  onClear?: () => void
  showClear?: boolean
}) {
  const clearAddon =
    onClear && showClear && !disabled ? (
      <InputGroupAddon align="inline-end">
        <InputGroupButton size="icon-xs" aria-label="Temizle" onClick={onClear}>
          <XIcon />
        </InputGroupButton>
      </InputGroupAddon>
    ) : null
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<ArticleSearchResult[]>([])
  // Dış `value` (kayıtlı ad / otomatik-doldur / seçim) query'yi güncellesin ama
  // arama TETİKLEMESİN — yoksa doldurulan ad tekrar aranıp liste geri açılır.
  const skipNextSearch = useRef(false)

  useEffect(() => {
    // Dış value'yu iç query'ye senkronla (React↔prop senkronu; kaçınılmaz setState).
    if (value !== query) {
      skipNextSearch.current = true
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setQuery(value)
    }
    // yalnız dış value değişimini izler
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value])

  useEffect(() => {
    if (skipNextSearch.current) {
      skipNextSearch.current = false
      return
    }
    if (vehicleTypeId == null) return
    const q = query.trim()
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      return
    }
    let active = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch(
          `/api/tecdoc/articles/search?vehicleId=${vehicleTypeId}&q=${encodeURIComponent(q)}`
        )
        const data = await res.json()
        if (active && res.ok) setResults(Array.isArray(data.articles) ? data.articles : [])
      } catch {
        /* arama hatası sessiz — serbest metin girişi çalışmaya devam eder */
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [query, vehicleTypeId])

  // Araç kataloğa bağlı değil → arama yok, düz metin girişi (mevcut davranış) + clear.
  if (vehicleTypeId == null) {
    return (
      <InputGroup className="h-8">
        <InputGroupInput
          value={value}
          onChange={(e) => onNameChange(e.target.value)}
          onBlur={onCommit}
          placeholder={placeholder}
          disabled={disabled}
          className="text-sm"
        />
        {clearAddon}
      </InputGroup>
    )
  }

  return (
    <Autocomplete
      items={results}
      value={query}
      filter={null}
      autoHighlight
      itemToStringValue={(a: ArticleSearchResult) => a.productName}
      onValueChange={(v: string) => {
        setQuery(v)
        onNameChange(v)
      }}
    >
      <InputGroup className="h-8">
        <AutocompleteInput
          onKeyDown={(e) => {
            // Sonuç yokken Enter → yazılan serbest metni kaydet (katalogda olmayan
            // parça). Sonuç varsa Enter'ı Autocomplete işler (autoHighlight → seçim).
            if (e.key === "Enter" && results.length === 0 && query.trim()) {
              e.preventDefault()
              onCommit?.()
            }
          }}
          render={
            <InputGroupInput placeholder={placeholder} disabled={disabled} className="text-sm" />
          }
        />
        {clearAddon}
      </InputGroup>
      {query.trim().length >= 2 && (
      <AutocompleteContent>
        <AutocompleteEmpty>Eşleşen parça yok</AutocompleteEmpty>
        <AutocompleteList>
          {(a: ArticleSearchResult) => (
            <AutocompleteItem
              key={a.tecdocArticleId}
              value={a}
              onClick={() => onSelectArticle(a)}
            >
              {a.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={a.imageUrl}
                  alt=""
                  loading="lazy"
                  className="size-8 shrink-0 rounded object-contain bg-white border border-border/60"
                />
              ) : (
                <span className="size-8 shrink-0 rounded bg-muted flex items-center justify-center">
                  <PackageSearch className="size-4 text-muted-foreground/50" />
                </span>
              )}
              <span className="min-w-0 flex-1">
                <span className="block truncate">{a.productName}</span>
                <span className="block text-xs text-muted-foreground truncate">
                  <span className="font-mono">{a.articleNo}</span>
                  {a.supplierName && <> · {a.supplierName}</>}
                  {a.categoryName && <> · {a.categoryName}</>}
                </span>
              </span>
            </AutocompleteItem>
          )}
        </AutocompleteList>
      </AutocompleteContent>
      )}
    </Autocomplete>
  )
}
