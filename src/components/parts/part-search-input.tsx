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
import { Info, PackageSearch, Search, XIcon, Plus, PencilLine, TriangleAlert, Store } from "lucide-react"
import { Button } from "@/components/ui/button"
import { formatTRY } from "@/lib/format"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import { BAKIMX_SUGGESTION_LIMIT, useBakimxProductSearch } from "@/lib/parts/bakimx-client"
import { bakimxStockLabel } from "@/lib/parts/bakimx-item"
import {
  buildPartSuggestions,
  suggestionKey,
  suggestionLabel,
  type PartSuggestion,
  type StockPartLite,
} from "@/lib/parts/suggestions"

/**
 * "Parça adı" alanı: serbest metin + üç kaynakta canlı arama — araç kataloğa
 * bağlıysa cache'lenmiş TecDoc parçaları (numara/ad/marka/kategori; boşlukla
 * ayrılan terimler AND'lenir, bkz. searchVehicleArticles), BakımX ürün kataloğu
 * ve atölyenin kendi stok kartları. Yazarken free-text `onNameChange` ile
 * korunur (katalogda olmayan ad da yazılabilir); bir öneri seçilince ilgili
 * `onSelect*` geri çağırımı satırı doldurur. autoHighlight → Enter ilk sonucu
 * seçer.
 *
 * BakımX ve stok aramaları araç kataloğa bağlı OLMASA DA çalışır (BakımX
 * ürünleri araçtan bağımsız); yalnız üçü de kapalıysa bileşen düz Input'a düşer.
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
  createLabel = "Oluştur",
  onCreate,
  onCreateEdit,
  refreshSignal,
  onResultsCount,
  onShowDetail,
  onSelectStockPart,
  onSelectBakimxProduct,
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
  /**
   * Atölyenin kendi stok kartı seçildi (#181). Verilmezse stok kartları hiç
   * aranmaz — bileşenin eski davranışı korunur.
   */
  onSelectStockPart?: (p: StockPartLite) => void
  /**
   * BakımX katalog ürünü seçildi (BAK-35). Verilmezse BakımX hiç aranmaz —
   * kalemi yazamayan çağıran (ör. parça talebi) ürün de göstermemeli.
   */
  onSelectBakimxProduct?: (p: BakimxProductSummary) => void
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
  /**
   * Serbest-metin aksiyonunun fiili. Kalem ekleyen composer'da "Oluştur";
   * teknisyenin parça talebinde "Talep et" — eylem kalem değil talep yaratır.
   */
  createLabel?: string
  onCreate?: (name: string) => void
  onCreateEdit?: (name: string) => void
  /** Dışarıdan yeniden-arama sinyali: değeri değişince mevcut query yeniden sorgulanır (prefetch dolarken UI'ı tazelemek için). */
  refreshSignal?: number
  /** Her arama sonucu güncellemesinde sonuç sayısını bildirir (prefetch poll'unu erken durdurmak için). */
  onResultsCount?: (count: number) => void
  /** Verilirse sonuç satırında ⓘ çıkar → parça detay modalını açar (satırı SEÇMEDEN). */
  onShowDetail?: (a: ArticleSearchResult) => void
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
            <span>{createLabel} <span className="font-semibold">“{t}”</span></span>
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
  const [stockResults, setStockResults] = useState<StockPartLite[]>([])
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

  // Atölyenin kendi stok kartlarında arama (#181). TecDoc aramasından BAĞIMSIZ:
  // araç kataloğa bağlı olmasa da stok kartları aranabilir olmalı — iş emri
  // araması bugüne dek kendi stoğumuzu hiç sorgulamıyordu.
  useEffect(() => {
    if (!onSelectStockPart) return
    const q = query.trim()
    if (q.length < 2) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setStockResults([])
      return
    }
    let active = true
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/parts/search?q=${encodeURIComponent(q)}`)
        const data = await res.json()
        if (active && res.ok) setStockResults(Array.isArray(data.parts) ? data.parts : [])
      } catch {
        /* stok araması sessizce boş kalır — katalog araması ve serbest metin çalışır */
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [query, onSelectStockPart])

  // BakımX ürün kataloğu (BAK-35). TecDoc'tan BAĞIMSIZ: ürünler araçtan bağımsız
  // olduğu için araç kataloğa bağlı olmasa da aranır. Kapı kapalıysa hook boş
  // liste döner ve satırlar hiç render edilmez — hata gösterilmez (bkz.
  // bakimx-client.ts).
  const { products: bakimxResults } = useBakimxProductSearch({
    enabled: !!onSelectBakimxProduct,
    q: query,
    limit: BAKIMX_SUGGESTION_LIMIT,
    vehicleTypeId,
  })

  const suggestions = buildPartSuggestions(results, bakimxResults, stockResults)

  // Araç kataloğa bağlı değil VE ne BakımX ne stok araması var → arama yapacak
  // bir şey kalmaz, düz metin girişi + (composer'da) create aksiyonları.
  //
  // Stok/BakımX araması varsa düz input'a DÜŞÜLMEZ: katalogsuz araç, atölyenin
  // kendi stok kartlarının (#181) ve araçtan bağımsız BakımX ürünlerinin en çok
  // işe yaradığı durum. Bu erken dönüş yüzünden stok sonuçları hiç
  // görünmüyordu.
  if (vehicleTypeId == null && !onSelectStockPart && !onSelectBakimxProduct) {
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
      items={suggestions}
      value={query}
      filter={null}
      autoHighlight
      openOnInputClick={supplierId != null || categoryId != null}
      itemToStringValue={suggestionLabel}
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
            if (e.key === "Enter" && suggestions.length === 0 && query.trim()) {
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
            {(s: PartSuggestion) => (s.kind === "bakimx" ? (
              // BAK-35 — BakımX kataloğu: araca bağlı değil ama satılabilirliği ve
              // fiyatı bizde kayıtlı. Gösterilen tutar ATÖLYENİN ALIŞ fiyatıdır
              // (KDV hariç); etiketi kaldırmayın, satış fiyatı sanılırsa atölye
              // kendi marjını unutur.
              <AutocompleteItem
                key={suggestionKey(s)}
                value={s}
                onClick={() => onSelectBakimxProduct?.(s.product)}
              >
                <span className="size-8 shrink-0 rounded bg-primary/10 flex items-center justify-center">
                  <Store className="size-4 text-primary" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.product.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    <span className="font-mono">{s.product.sku}</span>
                    {s.product.brandName && <> · {s.product.brandName}</>}
                    {s.product.categoryLabel && <> · {s.product.categoryLabel}</>}
                  </span>
                  <span className="block text-[11px] text-muted-foreground truncate">
                    <span className="font-semibold text-foreground">
                      Alış: {formatTRY(s.product.workshopPriceKurus)}
                    </span>
                    <> · KDV hariç · {bakimxStockLabel(s.product)}</>
                  </span>
                </span>
              </AutocompleteItem>
            ) : s.kind === "stock" ? (
              // #181 — atölyenin kendi stok kartı: araca bağlı DEĞİL, ünlemle
              // ayrışsın ki kullanıcı listeden anlasın. Onay akışı çağıranda (#157).
              <AutocompleteItem
                key={suggestionKey(s)}
                value={s}
                onClick={() => onSelectStockPart?.(s.part)}
              >
                <span className="size-8 shrink-0 rounded bg-warning/15 flex items-center justify-center">
                  <TriangleAlert className="size-4 text-warning-strong" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block truncate">{s.part.name}</span>
                  <span className="block text-xs text-muted-foreground truncate">
                    {s.part.sku && <span className="font-mono">{s.part.sku}</span>}
                    {s.part.brand && <> · {s.part.brand}</>}
                    <> · Stok: {s.part.stockQty} {s.part.unit}</>
                  </span>
                  <span className="block text-[11px] text-warning-strong">
                    Bu araca bağlı değil — kendi stok kartınız
                  </span>
                </span>
              </AutocompleteItem>
            ) : (() => { const a = s.article; return (
              <AutocompleteItem
                key={suggestionKey(s)}
                value={s}
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
                  {/* OEM numarasıyla arandığında satırın neden çıktığı görünsün (#312). */}
                  {a.matchedOems.length > 0 && (
                    <span className="block text-[11px] text-muted-foreground truncate">
                      OEM: <span className="font-mono">{a.matchedOems.join(", ")}</span>
                    </span>
                  )}
                </span>
                {onShowDetail && (
                  <button
                    type="button"
                    aria-label="Parça detayı"
                    title="Özellikler, görsel ve uygunluk"
                    // Satır seçimini TETİKLEMEMELİ: mouseDown input'u blur edip
                    // popup'ı kapatırdı, click ise Autocomplete'in kendi seçim
                    // handler'ına baloncuklanırdı.
                    onMouseDown={(e) => e.preventDefault()}
                    onClick={(e) => {
                      // stopPropagation yeter: buton düz bir DOM child, Base UI'ın
                      // seçim handler'ı AutocompleteItem üzerinde ve baloncuklanma
                      // ile tetikleniyor.
                      e.stopPropagation()
                      onShowDetail(a)
                    }}
                    className="inline-flex size-11 shrink-0 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
                  >
                    <Info className="size-4" />
                  </button>
                )}
              </AutocompleteItem>
            ) })())}
          </AutocompleteList>
          {renderCreateActions(query)}
        </AutocompleteContent>
      )}
    </Autocomplete>
  )
}
