"use client"

import { useCallback, useEffect, useMemo, useRef, useState } from "react"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from "@/components/ui/dialog"
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { ChevronLeft, ChevronRight, PackageSearch, Search, X } from "lucide-react"
import { TecdocArticleRow } from "./tecdoc-article-row"
import { TecdocSearchResults } from "./tecdoc-search-results"
import { VinLinkPrompt } from "./vin-link-prompt"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { ArticleSummary, CategoryMatch, CategoryNode } from "@/lib/tecdoc/types"
import { CATEGORY_MATCH_LIMIT, searchCategoryTree } from "@/lib/tecdoc/tree"
import { partSearchIncludes, trIncludes } from "@/lib/tr-search"

/** Vehicle fields the picker needs: the catalog link + VIN/hints to build it. */
export type PickerVehicle = {
  id: string
  catalogVehicleTypeId: number | null
  vin: string | null
  modelYear: number | null
  engineDisplacement: string | null
  enginePower: string | null
  fuelType: string | null
  firstRegistrationDate: string | null
}

export type TecdocPartSelection = {
  name: string
  articleNo: string
  tecdocArticleId: number
  supplierName: string
  categoryName: string
  categoryId: number
}

/** Render cap for huge categories (the API has no pagination). */
const MAX_VISIBLE_ARTICLES = 100
/** Global aramada istenen parça sayısı (server 50'ye kırpar). */
const SEARCH_LIMIT = 50
/** Global arama için gereken en az karakter (server tarafıyla aynı eşik). */
const MIN_SEARCH_LEN = 2

/**
 * TecDoc vehicle-parts picker: category drill-down → article list → onSelect,
 * ARTI her seviyeden çalışan birleşik arama (kategori/alt kategori adı + parça
 * no/ad + marka).
 *
 * Arama iki kipte çalışır:
 *  • Kategori içindeyken (parça listesi yüklü): yüklü listeyi client-side süzer —
 *    ek istek yok. Kapsam çipiyle global aramaya çıkılır.
 *  • Kök/ara seviyede: kategori eşleşmeleri client'taki ağaçtan, parça eşleşmeleri
 *    /api/tecdoc/articles/search'ten (DB-only, kotasız → yalnız daha önce
 *    getirilmiş parçaları bulur; bu yüzden kategori eşleşmeleri hep gösterilir).
 *
 * Depends only on the normalized CategoryNode/ArticleSummary shapes served by
 * /api/tecdoc/* — raw provider payloads never reach the client.
 */
export function TecdocPartPicker({
  vehicle,
  onSelect,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
  initialCategoryId,
  initialCategoryName,
  initialSupplierId,
  initialSupplierName,
  onShowDetail,
}: {
  vehicle: PickerVehicle | undefined
  onSelect: (sel: TecdocPartSelection) => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
  hideTrigger?: boolean
  /** Satırda kategori seçiliyse açılışta doğrudan o kategorinin parçalarına atla. */
  initialCategoryId?: number | null
  initialCategoryName?: string | null
  /** Satırda yalnız marka seçiliyse kategori ağacını bu markaya göre buda (best-effort). */
  initialSupplierId?: number | null
  /** Satırda marka seçiliyse parça listesini bu markaya ön-filtrele (temizlenebilir). */
  initialSupplierName?: string | null
  /** Verilirse parça satırında ⓘ çıkar → detay modalını açar (parçayı SEÇMEDEN). */
  onShowDetail?: (a: ArticleSummary) => void
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen
  const [tree, setTree] = useState<CategoryNode[] | null>(null)
  const [stack, setStack] = useState<CategoryNode[]>([]) // drill-down breadcrumb
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null)
  const [query, setQuery] = useState("")
  const [supplierFilter, setSupplierFilter] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // Global arama durumu (yalnız kategori dışındayken kullanılır).
  const [searchResults, setSearchResults] = useState<ArticleSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchBrand, setSearchBrand] = useState("")

  const vehicleTypeId = vehicle?.catalogVehicleTypeId ?? null
  /** Parça listesi yüklü → arama o kategoriye kapsamlı. */
  const inCategory = articles != null
  const trimmedQuery = query.trim()
  const globalSearch = !inCategory && trimmedQuery.length >= MIN_SEARCH_LEN

  const loadCategories = useCallback(async (supplierId?: number | null) => {
    if (vehicleTypeId == null) return
    setLoading(true)
    setError("")
    try {
      const base = `/api/tecdoc/categories?vehicleId=${vehicleTypeId}`
      const res = await fetch(supplierId != null ? `${base}&supplierId=${supplierId}` : base)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Katalog yüklenemedi.")
      let cats = (data.categories as CategoryNode[]) ?? []
      // Marka-filtreli ağaç best-effort (yalnız daha önce keşfedilmiş kategoriler;
      // sağlayıcıda marka→kategori ters-indeksi yok). Boş dönerse çıkmaz sokak
      // olmasın diye tam ağaca düş.
      if (supplierId != null && cats.length === 0) {
        const full = await fetch(base)
        const fullData = await full.json()
        if (full.ok) cats = (fullData.categories as CategoryNode[]) ?? []
      }
      setTree(cats)
    } catch (err) {
      setError(err instanceof Error ? err.message : "Katalog yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [vehicleTypeId])

  // Açılış davranışı (her açılışta bir kez — initedRef guard'ı). `open` controlled
  // prop'tan (grid'in 🔍 butonu setTecdocOpen(true) ile doğrudan set eder) gelince
  // Base UI onOpenChange'i çağırmaz → yükleme handleOpenChange'e bağlanamaz; bu
  // yüzden open'ı doğrudan izliyoruz.
  //  • Kategori seçiliyse: doğrudan o kategorinin parçalarına atla (marka da
  //    seçiliyse listeyi o markaya ön-filtrele). Ağaç, geri tuşunda tembel yüklenir.
  //  • Yalnız marka seçiliyse: kategori ağacını o markaya göre buda (best-effort;
  //    boşsa tam ağaca düşer — loadCategories içinde).
  //  • Hiçbiri seçili değilse: tam kök kategori ağacını yükle (mevcut davranış).
  const initedRef = useRef(false)
  useEffect(() => {
    if (!open) {
      initedRef.current = false
      return
    }
    if (initedRef.current) return
    initedRef.current = true
    // Her açılış tamamen sıfırdan başlar — satır seçimi (kategori/marka) açılışlar
    // arası değişmiş olabilir; bayat ağaç/breadcrumb/parça listesi/arama taşınmasın.
    // Marka seçiliyse parça listesini o markaya ön-filtrele (temizlenebilir).
    // (Senkron setState — açılışta API'den veri çekmek için, fetch-on-open kalıbı.)
    /* eslint-disable react-hooks/set-state-in-effect */
    setTree(null)
    setStack([])
    setArticles(null)
    setQuery("")
    setError("")
    setSearchResults(null)
    setSearching(false)
    setSupplierFilter(initialSupplierName || "")
    setSearchBrand(initialSupplierName || "")
    if (initialCategoryId != null) {
      // Kategori seçili → doğrudan o kategorinin parçalarına atla. Ağaç null kalır,
      // geri tuşunda goBack içinde tam ağaç tembel yüklenir.
      void openLeaf({ id: initialCategoryId, name: initialCategoryName || "Kategori", children: [] })
    } else if (initialSupplierId != null) {
      void loadCategories(initialSupplierId) // yalnız marka → markaya budanmış ağaç
    } else {
      void loadCategories() // hiçbiri → tam ağaç
    }
    /* eslint-enable react-hooks/set-state-in-effect */
    // Kasıtlı olarak yalnız `open`'a tepki verir (açılış-başına-tek-sefer).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  // Global arama: DB'de cache'li parçalarda ara (kotasız, sağlayıcıya gitmez).
  // Debounce 300 ms — part-search-input ile aynı kalıp. Kategori içindeyken
  // çalışmaz (orada yüklü liste client-side süzülür).
  useEffect(() => {
    if (!open || vehicleTypeId == null || !globalSearch) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setSearching(false)
      return
    }
    let active = true
    const t = setTimeout(async () => {
      // Spinner debounce'tan SONRA açılır: her tuş vuruşunda yanıp sönmesin ve
      // effect gövdesinde senkron setState olmasın.
      setSearching(true)
      try {
        const qs = new URLSearchParams({
          vehicleId: String(vehicleTypeId),
          q: trimmedQuery,
          limit: String(SEARCH_LIMIT),
        })
        const res = await fetch(`/api/tecdoc/articles/search?${qs.toString()}`)
        const data = await res.json()
        if (!active) return
        const list: ArticleSearchResult[] = res.ok && Array.isArray(data.articles) ? data.articles : []
        setSearchResults(list)
        // Ön-seçili marka bu sonuç kümesinde yoksa çipi bırak — aksi halde liste
        // sebepsiz boş görünürdü.
        setSearchBrand((b) => (b && !list.some((a) => a.supplierName === b) ? "" : b))
      } catch {
        if (active) setSearchResults([]) // arama hatası sessiz — modal kullanılabilir kalır
      } finally {
        if (active) setSearching(false)
      }
    }, 300)
    return () => {
      active = false
      clearTimeout(t)
    }
  }, [open, vehicleTypeId, globalSearch, trimmedQuery])

  // NOT: Kategori eşleşmeleri client'taki ağaçtan gelir. Ağaç, "kategoriye atla"
  // açılışında atlandığı için null olabilir; tembel yüklemesi goBack/clearScope/
  // "Tekrar dene" yollarında yapılır (global aramaya ancak bunlardan biriyle
  // geçilir) — bunun için ayrı bir effect'e gerek yok.
  async function openLeaf(node: CategoryNode) {
    if (vehicleTypeId == null) return
    setStack((s) => [...s, node])
    setLoading(true)
    setError("")
    setQuery("")
    try {
      const res = await fetch(`/api/tecdoc/articles?vehicleId=${vehicleTypeId}&categoryId=${node.id}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Parçalar yüklenemedi.")
      setArticles(data.articles as ArticleSummary[])
    } catch (err) {
      setStack((s) => s.slice(0, -1))
      setError(err instanceof Error ? err.message : "Parçalar yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }

  function goBack() {
    setError("")
    if (articles) {
      setArticles(null)
      setQuery("")
      setSupplierFilter("") // yeni kategoride marka ön-filtresi taşınmasın
    }
    // Köke (tam ağaca) dönüyorsak ve ağaç henüz yüklenmediyse (kategoriye-atla
    // durumu ağacı atlamıştı) tembel yükle.
    if (stack.length <= 1 && tree == null) void loadCategories()
    setStack((s) => s.slice(0, -1))
  }

  /** Kapsam çipi ×: kategoriden çık ama yazılan sorguyu KORU → global aramaya geç. */
  function clearScope() {
    setArticles(null)
    setStack([])
    setSupplierFilter("")
    setError("")
    if (tree == null) void loadCategories()
  }

  /** Arama sonucundaki kategoriye gir: breadcrumb atalardan yeniden kurulur. */
  function openCategoryMatch(match: CategoryMatch) {
    setSearchResults(null)
    setSearchBrand("")
    setError("")
    if (match.node.children.length > 0) {
      setQuery("") // ağaç görünümüne dön
      setStack([...match.ancestors, match.node])
    } else {
      // openLeaf düğümü yığına kendisi iter (ve sorguyu temizler) → önce yalnız
      // ataları kur.
      setStack(match.ancestors)
      void openLeaf(match.node)
    }
  }

  function selectArticle(a: ArticleSummary, categoryId: number, categoryName: string) {
    onSelect({
      name: a.productName,
      articleNo: a.articleNo,
      tecdocArticleId: a.tecdocArticleId,
      supplierName: a.supplierName,
      categoryName,
      categoryId,
    })
    handleOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Yükleme artık open'ı izleyen useEffect'te (controlled + uncontrolled ortak yol).
    if (!next) {
      setStack([])
      setArticles(null)
      setQuery("")
      setSupplierFilter("")
      setError("")
      setSearchResults(null)
      setSearchBrand("")
      setSearching(false)
    }
  }

  const currentNodes = stack.length === 0 ? tree ?? [] : stack[stack.length - 1].children
  const supplierOptions = useMemo(() => {
    if (!articles) return []
    const names = Array.from(new Set(articles.map((a) => a.supplierName).filter(Boolean)))
    return names.sort((x, y) => x.localeCompare(y, "tr"))
  }, [articles])

  const filteredArticles = useMemo(() => {
    if (!articles) return null
    const q = query.trim()
    let list = supplierFilter ? articles.filter((a) => a.supplierName === supplierFilter) : articles
    // Parça no/ad ayraç-duyarsız eşleşir ("C27125" ↔ "C 27 125"); marka adı
    // için harf-katlamalı trIncludes yeterli. (bkz. searchVehicleArticles server tarafı)
    if (q) list = list.filter((a) => partSearchIncludes(a.productName, q) || partSearchIncludes(a.articleNo, q) || trIncludes(a.supplierName, q))
    return list
  }, [articles, query, supplierFilter])

  // Kategori eşleşmeleri: gösterilen limitin ÜSTÜNDE bir tavanla arayıp keseriz ki
  // "+n kategori daha" notu gerçek toplamı verebilsin.
  const categoryMatches = useMemo(() => {
    if (!globalSearch || !tree) return { visible: [] as CategoryMatch[], overflow: 0 }
    const all = searchCategoryTree(tree, trimmedQuery, 200)
    return {
      visible: all.slice(0, CATEGORY_MATCH_LIMIT),
      overflow: Math.max(0, all.length - CATEGORY_MATCH_LIMIT),
    }
  }, [globalSearch, tree, trimmedQuery])

  if (!vehicle) return null

  if (vehicleTypeId == null) {
    if (hideTrigger) return null
    return <VinLinkPrompt vehicle={vehicle} />
  }

  const scopeName = inCategory ? stack[stack.length - 1]?.name : null
  const searchPlaceholder = inCategory
    ? `${articles.length} parça içinde ara...`
    : "Kategori, parça, marka veya OEM no ara..."

  return (
    <>
      {!hideTrigger && (
        <Button type="button" size="sm" variant="outline" onClick={() => handleOpenChange(true)} className="gap-1.5">
          <PackageSearch className="size-3.5" />
          Araca Uygun Parçalar
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="p-0 gap-0 sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b px-4 py-3 gap-0">
            <div className="flex items-center gap-2 pr-8">
              {(stack.length > 0 || articles) && (
                <Button type="button" variant="ghost" size="icon" onClick={goBack} className="-ml-2" aria-label="Geri">
                  <ChevronLeft className="size-5" />
                </Button>
              )}
              <div className="min-w-0">
                <DialogTitle className="text-sm truncate">
                  {stack.length === 0 ? "Araca Uygun Parçalar" : stack[stack.length - 1].name}
                </DialogTitle>
                <DialogDescription className="text-xs truncate">
                  {stack.length === 0
                    ? "Kategori seçin veya arayın"
                    : stack.map((n) => n.name).join(" / ")}
                </DialogDescription>
              </div>
            </div>
            {/* Arama her seviyede erişilebilir — parçanın hangi kategoride olduğunu
                bilmeyen kullanıcı ağaçta dolaşmak zorunda kalmasın. */}
            <div className="mt-3 space-y-2">
              <div className="relative">
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground/70" />
                <Input
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder={searchPlaceholder}
                  aria-label="Kategori, parça, marka veya OEM numarası ara"
                  className="pl-8"
                />
              </div>
              {scopeName && (
                <span className="inline-flex min-h-7 max-w-full items-center gap-1 rounded-full border border-border bg-muted/60 pl-2.5 pr-1 text-xs text-muted-foreground">
                  <span className="truncate">{scopeName} içinde</span>
                  <button
                    type="button"
                    onClick={clearScope}
                    aria-label="Kategori kapsamını kaldır, tüm araçta ara"
                    title="Tüm araçta ara"
                    className="inline-flex size-5 shrink-0 items-center justify-center rounded-full hover:bg-muted-foreground/20 hover:text-foreground"
                  >
                    <X className="size-3" />
                  </button>
                </span>
              )}
            </div>
          </DialogHeader>

          <div className="flex-1 overflow-y-auto">
            {/* Global aramada ağaç arka planda yüklenebilir — tam ekran spinner
                arama sonuçlarını gizlemesin. */}
            {loading && !globalSearch && (
              <div className="flex justify-center py-10">
                <BrandSpinner />
              </div>
            )}

            {!loading && error && !globalSearch && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground space-y-2">
                <p>{error}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => (articles == null && stack.length === 0 ? loadCategories() : setError(""))}>
                  Tekrar dene
                </Button>
              </div>
            )}

            {globalSearch && (
              <TecdocSearchResults
                query={trimmedQuery}
                categories={categoryMatches.visible}
                categoryOverflow={categoryMatches.overflow}
                articles={searchResults}
                searching={searching}
                brandFilter={searchBrand}
                onBrandFilterChange={setSearchBrand}
                onCategorySelect={openCategoryMatch}
                onArticleSelect={(a) => selectArticle(a, a.categoryId, a.categoryName)}
                onShowDetail={onShowDetail}
              />
            )}

            {!globalSearch && !loading && !error && articles == null && (
              <div>
                {currentNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => (node.children.length > 0 ? setStack((s) => [...s, node]) : void openLeaf(node))}
                    className="w-full min-h-11 flex items-center justify-between gap-2 px-4 py-2.5 text-left text-sm border-b border-border/60 hover:bg-muted"
                  >
                    <span className="min-w-0 flex-1">{node.name}</span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground/60" />
                  </button>
                ))}
                {currentNodes.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">Alt kategori bulunamadı.</p>
                )}
              </div>
            )}

            {!globalSearch && !loading && !error && filteredArticles && (
              <div>
                {supplierOptions.length > 1 && (
                  <div className="sticky top-0 z-10 bg-popover px-3 py-2 border-b">
                    <Select value={supplierFilter || "all"} onValueChange={(v) => setSupplierFilter(v && v !== "all" ? v : "")}>
                      <SelectTrigger className="h-9">
                        {/* Base UI Select.Value HAM değeri basar → "all" seçiliyken
                            tetikleyicide "all" yazıyordu; etiketi render-fn ile veriyoruz. */}
                        <SelectValue>
                          {(v: string | null) => (v && v !== "all" ? v : "Tüm markalar")}
                        </SelectValue>
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm markalar</SelectItem>
                        {supplierOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {filteredArticles.slice(0, MAX_VISIBLE_ARTICLES).map((a) => {
                  const cat = stack[stack.length - 1]
                  return (
                    <TecdocArticleRow
                      key={a.tecdocArticleId}
                      article={a}
                      onSelect={() => selectArticle(a, cat?.id ?? 0, cat?.name ?? "")}
                      onShowDetail={onShowDetail}
                    />
                  )
                })}
                {filteredArticles.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground space-y-2">
                    <p>{query ? "Aramanızla eşleşen parça yok." : "Bu kategoride araca uygun parça bulunamadı."}</p>
                    {query && (
                      <Button type="button" size="sm" variant="outline" onClick={clearScope}>
                        Tüm araçta ara
                      </Button>
                    )}
                  </div>
                )}
                {filteredArticles.length > MAX_VISIBLE_ARTICLES && (
                  <p className="px-4 py-3 text-center text-xs text-muted-foreground">
                    İlk {MAX_VISIBLE_ARTICLES} parça gösteriliyor — daraltmak için arama kutusunu kullanın.
                  </p>
                )}
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </>
  )
}
