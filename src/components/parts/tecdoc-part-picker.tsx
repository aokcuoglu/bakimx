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
import { ChevronLeft, ChevronRight, PackageSearch, Search, Store, X } from "lucide-react"
import { TecdocArticleRow } from "./tecdoc-article-row"
import { BakimxProductRow } from "./bakimx-product-row"
import { TecdocSearchResults } from "./tecdoc-search-results"
import { VinLinkPrompt } from "./vin-link-prompt"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import { fetchBakimxProducts, useBakimxCategories, useBakimxProductSearch, fetchBakimxProductsByTecdocCategory } from "@/lib/parts/bakimx-client"
import { buildBakimxCategoryBranch, isBakimxNode } from "@/lib/parts/bakimx-tree"
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
 * BAK-35 — `onSelectBakimx` verilirse kök kategori listesinin SONUNA "BakımX
 * Ürünleri" dalı, arama sonuçlarına da aynı adlı bölüm eklenir. BakımX ürünleri
 * araçtan bağımsız olduğu için bu dal araç kataloğa BAĞLI OLMASA DA çalışır:
 * `catalogVehicleTypeId` null iken modal artık VinLinkPrompt'a düşmez, yalnız
 * BakımX dalını (ve VIN bağlama yolunu) gösterir. `bakimxCatalog` kapısı kapalı
 * atölyede kategori/arama uçları 403 döner, dal ve bölüm hiç render edilmez —
 * TecDoc akışı hiç etkilenmez (bkz. bakimx-client.ts).
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
  onSelectBakimx,
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
  /**
   * BakımX ürünü seçildi (BAK-35). VERİLMEZSE BakımX dalı/bölümü hiç kurulmaz ve
   * uçlara istek atılmaz — kalemi yazamayan çağıran (teknisyenin parça talebi,
   * mevcut satırın parçasını değiştiren satır-içi seçici) ürünü göstermemeli.
   */
  onSelectBakimx?: (product: BakimxProductSummary) => void
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
  // BakımX yaprağına girildiğinde dolan ürün listesi — `articles`'ın kardeşi;
  // ikisi aynı anda dolu OLMAZ (bir seferde tek yaprak açık).
  const [bakimxLeafProducts, setBakimxLeafProducts] = useState<BakimxProductSummary[] | null>(null)
  const [categoryLinkedBakimxProducts, setCategoryLinkedBakimxProducts] = useState<BakimxProductSummary[] | null>(null)
  const [query, setQuery] = useState("")
  const [supplierFilter, setSupplierFilter] = useState<string>("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  // Global arama durumu (yalnız kategori dışındayken kullanılır).
  const [searchResults, setSearchResults] = useState<ArticleSearchResult[] | null>(null)
  const [searching, setSearching] = useState(false)
  const [searchBrand, setSearchBrand] = useState("")

  const vehicleTypeId = vehicle?.catalogVehicleTypeId ?? null
  /** Parça/ürün listesi yüklü → arama o kategoriye kapsamlı. */
  const inCategory = articles != null || bakimxLeafProducts != null
  const trimmedQuery = query.trim()
  const globalSearch = !inCategory && trimmedQuery.length >= MIN_SEARCH_LEN

  // BakımX taksonomisi — modal açıkken bir kez okunur. Kapı kapalıysa (403) liste
  // boş gelir, dolayısıyla dal hiç kurulmaz ve hata gösterilmez.
  const bakimxEnabled = !!onSelectBakimx
  const { categories: bakimxCategories } = useBakimxCategories(open && bakimxEnabled, vehicleTypeId)
  const bakimxBranch = useMemo(
    () => (bakimxEnabled ? buildBakimxCategoryBranch(bakimxCategories) : null),
    [bakimxEnabled, bakimxCategories],
  )
  // Global aramanın BakımX ayağı. TecDoc aramasından bağımsız: araç kataloğa
  // bağlı olmasa da çalışır.
  const { products: bakimxSearchResults, searching: bakimxSearching } = useBakimxProductSearch({
    enabled: open && bakimxEnabled && globalSearch,
    q: trimmedQuery,
    limit: SEARCH_LIMIT,
    vehicleTypeId,
  })

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
    setBakimxLeafProducts(null)
    setCategoryLinkedBakimxProducts(null)
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
    // BakımX yaprağı: parçalar TecDoc'tan değil kendi kataloğumuzdan gelir ve
    // araç bağı aranmaz.
    if (isBakimxNode(node)) return openBakimxLeaf(node)
    if (vehicleTypeId == null) return
    setStack((s) => [...s, node])
    setLoading(true)
    setError("")
    setQuery("")
    try {
      // TecDoc parçalarını ve kategoriyle bağlı BakımX ürünlerini paralel yükle
      const [articlesRes, bakimxRes] = await Promise.all([
        fetch(`/api/tecdoc/articles?vehicleId=${vehicleTypeId}&categoryId=${node.id}`),
        fetchBakimxProductsByTecdocCategory(node.id, vehicleTypeId),
      ])

      if (!articlesRes.ok) {
        const articlesData = await articlesRes.json()
        throw new Error(articlesData.error || "Parçalar yüklenemedi.")
      }
      const articlesData = await articlesRes.json()
      setArticles(articlesData.articles as ArticleSummary[])

      // BakımX ürünleri yüklenemezse devam et (kapı kapalıysa veya hata varsa)
      if (bakimxRes.status === "ok") {
        setCategoryLinkedBakimxProducts(bakimxRes.data)
      }
    } catch (err) {
      setStack((s) => s.slice(0, -1))
      setError(err instanceof Error ? err.message : "Parçalar yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }

  async function openBakimxLeaf(node: CategoryNode) {
    if (!node.bakimxKey) return
    setStack((s) => [...s, node])
    setLoading(true)
    setError("")
    setQuery("")
    const result = await fetchBakimxProducts({ categoryKey: node.bakimxKey, limit: SEARCH_LIMIT, vehicleTypeId })
    if (result.status === "ok") {
      setBakimxLeafProducts(result.data)
    } else {
      // Kapı arada kapandıysa ya da uç okunamadıysa yaprağı açma — kullanıcı
      // kategori listesinde kalır (TecDoc dalları çalışmaya devam eder).
      setStack((s) => s.slice(0, -1))
      setError("BakımX ürünleri yüklenemedi.")
    }
    setLoading(false)
  }

  function goBack() {
    setError("")
    if (articles || bakimxLeafProducts || categoryLinkedBakimxProducts) {
      setArticles(null)
      setBakimxLeafProducts(null)
      setCategoryLinkedBakimxProducts(null)
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
    setBakimxLeafProducts(null)
    setCategoryLinkedBakimxProducts(null)
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

  function selectBakimx(product: BakimxProductSummary) {
    onSelectBakimx?.(product)
    handleOpenChange(false)
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    // Yükleme artık open'ı izleyen useEffect'te (controlled + uncontrolled ortak yol).
    if (!next) {
      setStack([])
      setArticles(null)
      setBakimxLeafProducts(null)
      setCategoryLinkedBakimxProducts(null)
      setQuery("")
      setSupplierFilter("")
      setError("")
      setSearchResults(null)
      setSearchBrand("")
      setSearching(false)
    }
  }

  // Kök liste: TecDoc ağacı + (varsa) BakımX dalı EN SONDA — araca uygunluğu
  // doğrulanmış TecDoc kategorileri önce görünmeli.
  const currentNodes =
    stack.length === 0
      ? [...(tree ?? []), ...(bakimxBranch ? [bakimxBranch] : [])]
      : stack[stack.length - 1].children
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

  // BakımX yaprağındaki ürünler de yüklü liste üzerinde client-side süzülür
  // (TecDoc kategorisindeki davranışın aynısı — ek istek yok).
  const filteredBakimxProducts = useMemo(() => {
    if (!bakimxLeafProducts) return null
    const q = query.trim()
    if (!q) return bakimxLeafProducts
    return bakimxLeafProducts.filter(
      (p) =>
        partSearchIncludes(p.name, q) ||
        partSearchIncludes(p.sku, q) ||
        trIncludes(p.brandName, q),
    )
  }, [bakimxLeafProducts, query])

  // Kategoriyle bağlı BakımX ürünlerini (TecDoc kategorisi açıldığında yüklenen) filtrele
  const filteredCategoryLinkedBakimxProducts = useMemo(() => {
    if (!categoryLinkedBakimxProducts) return null
    const q = query.trim()
    if (!q) return categoryLinkedBakimxProducts
    return categoryLinkedBakimxProducts.filter(
      (p) =>
        partSearchIncludes(p.name, q) ||
        partSearchIncludes(p.sku, q) ||
        trIncludes(p.brandName, q),
    )
  }, [categoryLinkedBakimxProducts, query])

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

  // Araç kataloğa bağlı değil: TecDoc tarafı yok. BakımX yazımı açıksa modal yine
  // de kullanılabilir (ürünler araçtan bağımsız) ve VIN bağlama yolu içeride
  // durur; değilse eski davranış — yalnız VinLinkPrompt.
  const bakimxOnly = vehicleTypeId == null
  if (bakimxOnly && !bakimxEnabled) {
    if (hideTrigger) return null
    return <VinLinkPrompt vehicle={vehicle} />
  }

  const leafCount = articles?.length ?? bakimxLeafProducts?.length ?? 0
  const scopeName = inCategory ? stack[stack.length - 1]?.name : null
  const searchPlaceholder = inCategory
    ? `${leafCount} parça içinde ara...`
    : bakimxOnly
      ? "BakımX ürünlerinde ara..."
      : "Kategori, parça, marka veya OEM no ara..."

  return (
    <>
      {!hideTrigger && (
        <Button type="button" size="sm" variant="outline" onClick={() => handleOpenChange(true)} className="gap-1.5">
          <PackageSearch className="size-3.5" />
          {bakimxOnly ? "BakımX Ürünleri" : "Araca Uygun Parçalar"}
        </Button>
      )}

      <Dialog open={open} onOpenChange={handleOpenChange}>
        <DialogContent className="p-0 gap-0 sm:max-w-md max-h-[85vh] flex flex-col">
          <DialogHeader className="border-b px-4 py-3 gap-0">
            <div className="flex items-center gap-2 pr-8">
              {(stack.length > 0 || inCategory) && (
                <Button type="button" variant="ghost" size="icon" onClick={goBack} className="-ml-2" aria-label="Geri">
                  <ChevronLeft className="size-5" />
                </Button>
              )}
              <div className="min-w-0">
                <DialogTitle className="text-sm truncate">
                  {stack.length > 0
                    ? stack[stack.length - 1].name
                    : bakimxOnly
                      ? "BakımX Ürünleri"
                      : "Araca Uygun Parçalar"}
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
                <Search className="pointer-events-none absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
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
                {/* Hata HER durumda temizlenir: araç kataloğa bağlı değilken
                    loadCategories erken dönüyor ve buton "takılı" kalıyordu. */}
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  onClick={() => {
                    setError("")
                    if (!bakimxOnly && !inCategory && stack.length === 0) void loadCategories()
                  }}
                >
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
                bakimxProducts={bakimxSearchResults}
                bakimxSearching={bakimxSearching}
                onBakimxSelect={onSelectBakimx ? selectBakimx : undefined}
                vehicleTypeId={vehicleTypeId}
                brandFilter={searchBrand}
                onBrandFilterChange={setSearchBrand}
                onCategorySelect={openCategoryMatch}
                onArticleSelect={(a) => selectArticle(a, a.categoryId, a.categoryName)}
                onShowDetail={onShowDetail}
              />
            )}

            {!globalSearch && !loading && !error && !inCategory && (
              <div>
                {/* Araç kataloğa bağlı değilken TecDoc dalı yok; kullanıcı neden
                    yalnız BakımX gördüğünü ve VIN'i nasıl bağlayacağını burada
                    görsün (composer'daki notun modal içindeki karşılığı). */}
                {bakimxOnly && stack.length === 0 && (
                  <div className="space-y-2 border-b border-border/60 bg-muted/40 px-4 py-3">
                    <p className="text-xs text-muted-foreground">
                      Araç katalogla eşleşmediği için araca özel parçalar listelenemiyor —
                      aşağıdaki BakımX ürünleri her araçta kullanılabilir.
                    </p>
                    <VinLinkPrompt vehicle={vehicle} />
                  </div>
                )}
                {currentNodes.map((node) => (
                  <button
                    key={node.id}
                    type="button"
                    onClick={() => (node.children.length > 0 ? setStack((s) => [...s, node]) : void openLeaf(node))}
                    className="w-full min-h-8 flex items-center justify-between gap-2 px-4 py-2 text-left text-sm border-b border-border/60 hover:bg-muted"
                  >
                    <span className="flex min-w-0 flex-1 items-center gap-2">
                      {isBakimxNode(node) && <Store className="size-3.5 shrink-0 text-primary" />}
                      <span className="min-w-0 flex-1 truncate">{node.name}</span>
                      {node.productCount != null && (
                        <span className="shrink-0 text-xs text-muted-foreground">{node.productCount}</span>
                      )}
                    </span>
                    <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
                  </button>
                ))}
                {currentNodes.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {bakimxOnly ? "Listelenecek ürün bulunamadı." : "Alt kategori bulunamadı."}
                  </p>
                )}
              </div>
            )}

            {/* BakımX yaprağı: kendi kataloğumuzun ürün listesi (fiyat + stok). */}
            {!globalSearch && !loading && !error && filteredBakimxProducts && (
              <div>
                {filteredBakimxProducts.map((p) => (
                  <BakimxProductRow key={p.id} product={p} onSelect={() => selectBakimx(p)} />
                ))}
                {filteredBakimxProducts.length === 0 && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground space-y-2">
                    <p>{query ? "Aramanızla eşleşen ürün yok." : "Bu kategoride ürün bulunamadı."}</p>
                    {query && (
                      <Button type="button" size="sm" variant="outline" onClick={clearScope}>
                        Tüm katalogda ara
                      </Button>
                    )}
                  </div>
                )}
              </div>
            )}

            {!globalSearch && !loading && !error && (filteredArticles || filteredCategoryLinkedBakimxProducts) && (
              <div>
                {supplierOptions.length > 1 && (
                  <div className="sticky top-0 z-10 bg-popover px-3 py-2 border-b">
                    <Select value={supplierFilter || "all"} onValueChange={(v) => setSupplierFilter(v && v !== "all" ? v : "")}>
                      <SelectTrigger className="h-9">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm markalar</SelectItem>
                        {supplierOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  </div>
                )}
                {/* TecDoc parçaları ve kategoriyle bağlı BakımX ürünlerini beraber göster (BAK-45) */}
                {filteredArticles && filteredArticles.slice(0, MAX_VISIBLE_ARTICLES).map((a) => {
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
                {filteredCategoryLinkedBakimxProducts && filteredCategoryLinkedBakimxProducts.map((p) => (
                  <BakimxProductRow key={p.id} product={p} onSelect={() => selectBakimx(p)} />
                ))}
                {(!filteredArticles || filteredArticles.length === 0) && (!filteredCategoryLinkedBakimxProducts || filteredCategoryLinkedBakimxProducts.length === 0) && (
                  <div className="px-4 py-6 text-center text-sm text-muted-foreground space-y-2">
                    <p>{query ? "Aramanızla eşleşen parça yok." : "Bu kategoride araca uygun parça bulunamadı."}</p>
                    {query && (
                      <Button type="button" size="sm" variant="outline" onClick={clearScope}>
                        Tüm araçta ara
                      </Button>
                    )}
                  </div>
                )}
                {filteredArticles && filteredArticles.length > MAX_VISIBLE_ARTICLES && (
                  <p className="px-4 py-3 text-center text-xs text-muted-foreground">
                    İlk {MAX_VISIBLE_ARTICLES} parça gösteriliyor — daraltmak için arama kutosunu kullanın.
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
