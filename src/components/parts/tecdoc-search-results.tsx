"use client"

import { useEffect, useMemo, useRef, useState } from "react"
import { ChevronRight, Search } from "lucide-react"
import { cn } from "@/lib/utils"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { TecdocArticleRow, TECDOC_SOURCE_LABEL } from "./tecdoc-article-row"
import { BakimxProductRow } from "./bakimx-product-row"
import { GetirbakimProductRow } from "./getirbakim-product-row"
import type { ArticleSearchResult } from "@/lib/tecdoc/catalog"
import type { BakimxProductSummary } from "@/lib/parts/bakimx-catalog"
import type { GetirbakimProduct } from "@/lib/parts/getirbakim/types"
import type { ArticleSummary, CategoryMatch } from "@/lib/tecdoc/types"
import { fetchBakimxMatches } from "@/lib/parts/bakimx-client"
import { nestGetirbakimUnderArticles } from "@/lib/parts/getirbakim/match"
import { GETIRBAKIM_SOURCE_LABEL } from "@/lib/parts/getirbakim/labels"

const EMPTY_GETIRBAKIM: GetirbakimProduct[] = []

/**
 * Parça seçicinin global arama sonuçları: KATEGORİLER (ağaçtan, client-side) +
 * PARÇALAR (TecDoc / RapidAPI) + BAKIMX ÜRÜNLERİ + GETİRBAKIM.
 *
 * TecDoc ve GetirBakım AYRI bölümlerde durur; parça no/OEM örtüşen GetirBakım
 * satırı TecDoc makalesinin altına yuvalanır. BakımX ile karıştırılmaz —
 * atölye stoğu bizim depomuz sanmasın.
 */
export function TecdocSearchResults({
  query,
  categories,
  categoryOverflow,
  articles,
  searching,
  bakimxProducts,
  bakimxSearching,
  onBakimxSelect,
  getirbakimProducts,
  getirbakimSearching,
  onGetirbakimSelect,
  vehicleTypeId,
  brandFilter,
  onBrandFilterChange,
  onCategorySelect,
  onArticleSelect,
  onShowDetail,
}: {
  query: string
  categories: CategoryMatch[]
  /** searchCategoryTree limitinin dışında kalan eşleşme sayısı (0 ise not gösterilmez). */
  categoryOverflow: number
  /** null: arama henüz tamamlanmadı (ilk yükleme). */
  articles: ArticleSearchResult[] | null
  searching: boolean
  /** BakımX katalog eşleşmeleri; `onBakimxSelect` yoksa bölüm hiç çıkmaz. */
  bakimxProducts?: BakimxProductSummary[]
  bakimxSearching?: boolean
  onBakimxSelect?: (p: BakimxProductSummary) => void
  getirbakimProducts?: GetirbakimProduct[]
  getirbakimSearching?: boolean
  onGetirbakimSelect?: (p: GetirbakimProduct) => void
  /** Rozet eşleşmesi araca bağlı ürünleri de kapsasın diye (BAK-46). */
  vehicleTypeId?: number | null
  brandFilter: string
  onBrandFilterChange: (v: string) => void
  onCategorySelect: (c: CategoryMatch) => void
  onArticleSelect: (a: ArticleSearchResult) => void
  onShowDetail?: (a: ArticleSummary) => void
}) {
  const [bakimxMatches, setBakimxMatches] = useState<Record<string, BakimxProductSummary>>({})
  const lastArticlesRef = useRef<typeof articles>(null)

  useEffect(() => {
    if (!articles?.length) return
    if (lastArticlesRef.current === articles) return

    lastArticlesRef.current = articles
    let active = true
    const articleNumbers = articles.map((a) => a.articleNo)
    void fetchBakimxMatches(articleNumbers, vehicleTypeId).then((result) => {
      if (!active) return
      setBakimxMatches(result.status === "ok" ? result.data : {})
    })

    return () => {
      active = false
    }
  }, [articles, vehicleTypeId])

  const brands = useMemo(() => {
    if (!articles) return []
    const counts = new Map<string, number>()
    for (const a of articles) {
      if (!a.supplierName) continue
      counts.set(a.supplierName, (counts.get(a.supplierName) ?? 0) + 1)
    }
    // Çok parçalı marka önce; eşitlikte tr alfabetik.
    return [...counts.entries()]
      .map(([name, count]) => ({ name, count }))
      .sort((x, y) => y.count - x.count || x.name.localeCompare(y.name, "tr"))
  }, [articles])

  const visibleArticles = useMemo(() => {
    if (!articles) return null
    return brandFilter ? articles.filter((a) => a.supplierName === brandFilter) : articles
  }, [articles, brandFilter])

  const visibleBakimx = onBakimxSelect ? (bakimxProducts ?? []) : []
  const visibleGetirbakim = getirbakimProducts ?? EMPTY_GETIRBAKIM
  const getirbakimLayout = useMemo(
    () => nestGetirbakimUnderArticles(visibleArticles ?? [], visibleGetirbakim),
    [visibleArticles, visibleGetirbakim],
  )
  // "Sonuç yok" ancak BÜTÜN bölümler boşken doğrudur. TecDoc araması hiç
  // çalışmamış olabilir (araç kataloğa bağlı değil → `articles` null kalır); o
  // durumda karar yalnız katalog taraflarına bakar.
  const anyPending = searching || !!bakimxSearching || !!getirbakimSearching
  const nothingFound =
    categories.length === 0 &&
    visibleBakimx.length === 0 &&
    visibleGetirbakim.length === 0 &&
    (visibleArticles == null ? !!onBakimxSelect : visibleArticles.length === 0)

  return (
    <div>
      {categories.length > 0 && (
        <section>
          <SectionHeading>Kategoriler ({categories.length + categoryOverflow})</SectionHeading>
          {categories.map((c) => (
            <button
              key={`${c.node.id}-${c.path}`}
              type="button"
              onClick={() => onCategorySelect(c)}
              className="w-full min-h-8 flex items-center justify-between gap-2 px-4 py-2 text-left border-b border-border/60 hover:bg-muted"
            >
              <span className="min-w-0 flex-1">
                <span className="block text-sm truncate">{c.node.name}</span>
                {c.path && (
                  <span className="block text-xs text-muted-foreground truncate">{c.path}</span>
                )}
              </span>
              <ChevronRight className="size-4 shrink-0 text-muted-foreground" />
            </button>
          ))}
          {categoryOverflow > 0 && (
            <p className="px-4 py-2 text-xs text-muted-foreground">
              +{categoryOverflow} kategori daha — aramayı daraltın.
            </p>
          )}
        </section>
      )}

      {searching && visibleArticles == null && (
        <div className="flex justify-center py-8">
          <BrandSpinner />
        </div>
      )}

      {visibleArticles != null && visibleArticles.length > 0 && (
        <section>
          <SectionHeading>
            {TECDOC_SOURCE_LABEL} ({visibleArticles.length}
            {searching ? "…" : ""})
          </SectionHeading>
          {brands.length > 1 && (
            <div className="flex flex-wrap gap-1.5 px-3 pb-2">
              <BrandChip active={!brandFilter} onClick={() => onBrandFilterChange("")}>
                Tüm markalar
              </BrandChip>
              {brands.map((b) => (
                <BrandChip
                  key={b.name}
                  active={brandFilter === b.name}
                  onClick={() => onBrandFilterChange(brandFilter === b.name ? "" : b.name)}
                >
                  {b.name} <span className="text-muted-foreground">{b.count}</span>
                </BrandChip>
              ))}
            </div>
          )}
          {visibleArticles.map((a) => (
            <TecdocArticleRow
              key={a.tecdocArticleId}
              article={a}
              context={a.categoryName || null}
              matchedOems={a.matchedOems}
              bakimxMatch={bakimxMatches[a.articleNo] || null}
              getirbakimMatches={getirbakimLayout.nested[a.tecdocArticleId]}
              onSelect={() => onArticleSelect(a)}
              onGetirbakimSelect={onGetirbakimSelect}
              onShowDetail={onShowDetail}
            />
          ))}
        </section>
      )}

      {visibleBakimx.length > 0 && (
        <section>
          <SectionHeading>
            BakımX Ürünleri ({visibleBakimx.length}
            {bakimxSearching ? "…" : ""})
          </SectionHeading>
          {visibleBakimx.map((p) => (
            <BakimxProductRow key={p.id} product={p} onSelect={() => onBakimxSelect?.(p)} />
          ))}
        </section>
      )}

      {getirbakimLayout.standalone.length > 0 && (
        <section>
          <SectionHeading>
            {GETIRBAKIM_SOURCE_LABEL} ({getirbakimLayout.standalone.length}
            {getirbakimSearching ? "…" : ""})
          </SectionHeading>
          {getirbakimLayout.standalone.map((p) => (
            <GetirbakimProductRow
              key={`gb-${p.id}`}
              product={p}
              onSelect={onGetirbakimSelect ? () => onGetirbakimSelect(p) : undefined}
            />
          ))}
        </section>
      )}

      {!anyPending && nothingFound && (
        <div className="px-4 py-8 text-center space-y-2">
          <Search className="size-5 mx-auto text-muted-foreground/50" />
          <p className="text-sm text-muted-foreground">
            &ldquo;{query}&rdquo; için sonuç bulunamadı.
          </p>
          {/* Kapsam notu yalnız TecDoc araması GERÇEKTEN çalıştıysa doğrudur;
              araç kataloğa bağlı değilken (`articles` null) yanıltıcı olurdu. */}
          {visibleArticles != null && (
            <p className="text-xs text-muted-foreground max-w-xs mx-auto">
              Parça araması, kataloğa daha önce çekilmiş parçalarda yapılır; OEM numarası ise
              detayı bir kez açılmış parçalarda aranır. Aradığınız parçayı kategorilerden
              ilerleyerek getirebilirsiniz.
            </p>
          )}
        </div>
      )}

      {/* Kategori eşleşmesi var ama hiç parça yok: kullanıcı çıkmaz sokakta
          kalmasın diye aynı kapsam notunu daha kısa göster. */}
      {!anyPending && categories.length > 0 && visibleBakimx.length === 0 && visibleArticles != null && visibleArticles.length === 0 && (
        <p className="px-4 py-3 text-xs text-muted-foreground">
          Bu aramayla eşleşen kayıtlı parça yok — yukarıdaki kategoriye girerek parçaları
          getirebilirsiniz.
        </p>
      )}
    </div>
  )
}

function SectionHeading({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="px-4 pt-3 pb-1.5 text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
      {children}
    </h3>
  )
}

function BrandChip({
  active,
  onClick,
  children,
}: {
  active: boolean
  onClick: () => void
  children: React.ReactNode
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={cn(
        "inline-flex min-h-8 max-w-[12rem] items-center gap-1 truncate rounded-full border px-2.5 text-xs font-medium transition-colors touch-manipulation",
        active
          ? "border-primary bg-primary text-primary-foreground [&_span]:text-primary-foreground"
          : "border-border bg-background text-foreground hover:bg-muted",
      )}
    >
      {children}
    </button>
  )
}
