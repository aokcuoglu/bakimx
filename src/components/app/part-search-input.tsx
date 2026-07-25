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
import { PackageSearch, Search, XIcon, Plus, PencilLine } from "lucide-react"
import { Button } from "@/components/ui/button"
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
  sku,
  vehicleTypeId,
  supplierId,
  categoryId,
  disabled,
  placeholder,
  onNameChange,
  onSelectArticle,
  onCommit,
  onClear,
  showClear,
  onSearchClick,
  searchDisabled,
  searchTitle,
  showCreate,
  onCreate,
  onCreateEdit,
  refreshSignal,
  onResultsCount,
}: {
  value: string
  /** Seçili parçanın numarası — input içinde öndeki mono çip olarak gösterilir. */
  sku?: string | null
  vehicleTypeId: number | null
  /** Marka filtresi (grid kolonu) — seçiliyse boş query'de bile arama tetiklenir. */
  supplierId?: number | null
  /** Kategori filtresi (grid kolonu) — seçiliyse boş query'de bile arama tetiklenir. */
  categoryId?: number | null
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
  /** 🔍 TecDoc picker'ı açar (input içinde arkadaki buton). */
  onSearchClick?: () => void
  searchDisabled?: boolean
  searchTitle?: string
  /** Composer'da (bare DEĞİL): dropdown'da her zaman görünen "Oluştur/Oluştur & Düzenle" aksiyonları. */
  showCreate?: boolean
  onCreate?: (name: string) => void
  onCreateEdit?: (name: string) => void
  /** Dışarıdan yeniden-arama sinyali: değeri değişince mevcut query yeniden sorgulanır (prefetch dolarken UI'ı tazelemek için). */
  refreshSignal?: number
  /** Her arama sonucu güncellemesinde sonuç sayısını bildirir (prefetch poll'unu erken durdurmak için). */
  onResultsCount?: (count: number) => void
}) {
  // Composer'da dropdown/altında her zaman görünen Odoo-tarzı create aksiyonları.
  // bare (liste satırı) kullanımında showCreate geçilmez → hiç render edilmez.
  // (Düz fonksiyon olarak çağrılır — JSX component tag'i DEĞİL — render sırasında
  // component tanımlamaktan kaçınmak için; react-hooks/static-components.)
  function renderCreateActions(text: string) {
    const t = text.trim()
    if (!showCreate || !t) return null
    return (
      <div className="flex flex-col gap-0.5 border-t border-border p-1">
        {onCreate && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 justify-start gap-2 font-normal"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCreate(t)}
          >
            <Plus className="size-4 text-primary" />
            <span>Oluştur <span className="font-semibold">“{t}”</span></span>
          </Button>
        )}
        {onCreateEdit && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="h-8 justify-start gap-2 font-normal text-muted-foreground"
            onMouseDown={(e) => e.preventDefault()}
            onClick={() => onCreateEdit(t)}
          >
            <PencilLine className="size-4" />
            Oluştur &amp; Düzenle…
          </Button>
        )}
      </div>
    )
  }
  const canClear = !!(onClear && showClear && !disabled)
  // Input'un arkasındaki butonlar: 🔍 (katalog picker) + X (temizle).
  const trailing =
    onSearchClick || canClear ? (
      <InputGroupAddon align="inline-end">
        {onSearchClick && (
          <InputGroupButton
            size="icon-xs"
            aria-label="Katalogdan parça seç"
            title={searchTitle}
            onClick={onSearchClick}
            disabled={searchDisabled}
          >
            <Search />
          </InputGroupButton>
        )}
        {canClear && (
          <InputGroupButton size="icon-xs" aria-label="Temizle" onClick={onClear}>
            <XIcon />
          </InputGroupButton>
        )}
      </InputGroupAddon>
    ) : null
  // Seçili parça numarası — input içinde öndeki mono çip.
  const skuChip = sku ? (
    <InputGroupAddon align="inline-start" className="pr-1">
      <span className="rounded bg-muted px-1 py-0.5 font-mono text-[11px] leading-none text-muted-foreground">{sku}</span>
    </InputGroupAddon>
  ) : null
  const [query, setQuery] = useState(value)
  const [results, setResults] = useState<ArticleSearchResult[]>([])
  // Dış `value` (kayıtlı ad / otomatik-doldur / seçim) query'yi güncellesin ama
  // arama TETİKLEMESİN — yoksa doldurulan ad tekrar aranıp liste geri açılır.
  const skipNextSearch = useRef(false)
  // onResultsCount'u ref'te tut: arama effect'inin deps'ini kirletmesin (çağıran
  // memoize etmese bile her render'da yeniden-fetch tetiklenmesin). Ref render'da
  // değil effect'te güncellenir (React Compiler render'da ref yazmayı yasaklar).
  const onResultsCountRef = useRef(onResultsCount)
  useEffect(() => {
    onResultsCountRef.current = onResultsCount
  }, [onResultsCount])

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
    const hasFilter = supplierId != null || categoryId != null
    if (q.length < 2 && !hasFilter) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setResults([])
      onResultsCountRef.current?.(0)
      return
    }
    let active = true
    const t = setTimeout(async () => {
      try {
        const qs = new URLSearchParams({ vehicleId: String(vehicleTypeId) })
        if (q.length >= 2) qs.set("q", q)
        if (supplierId != null) qs.set("supplierId", String(supplierId))
        if (categoryId != null) qs.set("categoryId", String(categoryId))
        const res = await fetch(`/api/tecdoc/articles/search?${qs.toString()}`)
        const data = await res.json()
        if (active && res.ok) {
          const arr = Array.isArray(data.articles) ? data.articles : []
          setResults(arr)
          onResultsCountRef.current?.(arr.length)
        }
      } catch {
        /* arama hatası sessiz — serbest metin girişi çalışmaya devam eder */
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(t)
    }
    // refreshSignal: prefetch dolarken dışarıdan tetiklenen yeniden-arama sinyali.
  }, [query, vehicleTypeId, supplierId, categoryId, refreshSignal])

  // Araç kataloğa bağlı değil → arama yok, düz metin girişi + (composer'da) create aksiyonları.
  if (vehicleTypeId == null) {
    const inputGroup = (
      <InputGroup>
        {skuChip}
        <InputGroupInput
          value={value}
          onChange={(e) => onNameChange(e.target.value)}
          // Composer (showCreate): blur ekleme YAPMAZ (odak kaybında istenmeyen ekleme
          // olmasın). Liste satırı (bare): blur'da serbest metni kalıcılaştırır.
          onBlur={showCreate ? undefined : onCommit}
          onKeyDown={
            showCreate
              ? (e) => {
                  if (e.key === "Enter" && value.trim()) {
                    e.preventDefault()
                    onCreate?.(value.trim())
                  }
                }
              : undefined
          }
          placeholder={placeholder}
          disabled={disabled}
          title={value || undefined}
          className="text-sm"
        />
        {trailing}
      </InputGroup>
    )
    if (!showCreate) return inputGroup
    return (
      <div className="w-full min-w-0 space-y-1.5">
        {inputGroup}
        {renderCreateActions(value)}
      </div>
    )
  }

  return (
    <Autocomplete
      items={results}
      value={query}
      filter={null}
      autoHighlight
      openOnInputClick={supplierId != null || categoryId != null}
      itemToStringValue={(a: ArticleSearchResult) => a.productName}
      onValueChange={(v: string) => {
        setQuery(v)
        onNameChange(v)
      }}
    >
      <InputGroup>
        {skuChip}
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
            <InputGroupInput placeholder={placeholder} disabled={disabled} title={value || undefined} className="text-sm" />
          }
        />
        {trailing}
      </InputGroup>
      {((showCreate ? query.trim().length >= 1 : query.trim().length >= 2) ||
        supplierId != null ||
        categoryId != null) && (
        <AutocompleteContent>
          <AutocompleteEmpty className="flex-col gap-1.5">
            <span>Eşleşen parça yok</span>
            {onSearchClick && !searchDisabled && (
              <InputGroupButton
                size="sm"
                variant="outline"
                // Input blur'ı popup'ı onClick'ten önce kapatmasın diye focus'u koru.
                onMouseDown={(e) => e.preventDefault()}
                onClick={onSearchClick}
              >
                <Search />
                Katalogdan getir
              </InputGroupButton>
            )}
          </AutocompleteEmpty>
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
          {renderCreateActions(query)}
        </AutocompleteContent>
      )}
    </Autocomplete>
  )
}
