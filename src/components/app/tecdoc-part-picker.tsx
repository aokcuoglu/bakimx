"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Sheet,
  SheetContent,
  SheetHeader,
  SheetTitle,
  SheetDescription,
} from "@/components/ui/sheet"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { ChevronLeft, ChevronRight, PackageSearch } from "lucide-react"
import type { ArticleSummary, CategoryNode } from "@/lib/tecdoc/types"

export type TecdocPartSelection = {
  name: string
  articleNo: string
  tecdocArticleId: number
  supplierName: string
}

/** Render cap for huge categories (the API has no pagination). */
const MAX_VISIBLE_ARTICLES = 100

/**
 * TecDoc vehicle-parts picker: category drill-down → article list → onSelect.
 * Depends only on the normalized CategoryNode/ArticleSummary shapes served by
 * /api/tecdoc/* — raw provider payloads never reach the client.
 */
export function TecdocPartPicker({
  vehicle,
  onSelect,
}: {
  vehicle: { id: string; catalogVehicleTypeId: number | null } | undefined
  onSelect: (sel: TecdocPartSelection) => void
}) {
  const [open, setOpen] = useState(false)
  const [tree, setTree] = useState<CategoryNode[] | null>(null)
  const [stack, setStack] = useState<CategoryNode[]>([]) // drill-down breadcrumb
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null)
  const [filter, setFilter] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const vehicleTypeId = vehicle?.catalogVehicleTypeId ?? null

  const loadCategories = useCallback(async () => {
    if (vehicleTypeId == null) return
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/tecdoc/categories?vehicleId=${vehicleTypeId}`)
      const data = await res.json()
      if (!res.ok) throw new Error(data.error || "Katalog yüklenemedi.")
      setTree(data.categories as CategoryNode[])
    } catch (err) {
      setError(err instanceof Error ? err.message : "Katalog yüklenemedi.")
    } finally {
      setLoading(false)
    }
  }, [vehicleTypeId])

  async function openLeaf(node: CategoryNode) {
    if (vehicleTypeId == null) return
    setStack((s) => [...s, node])
    setLoading(true)
    setError("")
    setFilter("")
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
      setFilter("")
    }
    setStack((s) => s.slice(0, -1))
  }

  function handleOpenChange(next: boolean) {
    setOpen(next)
    if (next && tree == null) void loadCategories()
    if (!next) {
      setStack([])
      setArticles(null)
      setFilter("")
      setError("")
    }
  }

  const currentNodes = stack.length === 0 ? tree ?? [] : stack[stack.length - 1].children
  const filteredArticles = useMemo(() => {
    if (!articles) return null
    const q = filter.trim().toLocaleLowerCase("tr")
    const list = q
      ? articles.filter(
          (a) =>
            a.productName.toLocaleLowerCase("tr").includes(q) ||
            a.articleNo.toLocaleLowerCase("tr").includes(q) ||
            a.supplierName.toLocaleLowerCase("tr").includes(q)
        )
      : articles
    return list
  }, [articles, filter])

  if (!vehicle) return null

  if (vehicleTypeId == null) {
    return (
      <p className="text-xs text-muted-foreground">
        Araç kataloğa bağlı değil —{" "}
        <Link href={`/vehicles/${vehicle.id}/edit`} className="text-primary underline underline-offset-2">
          ruhsat/VIN ile tanımlayın
        </Link>{" "}
        ve araca uygun parçaları buradan seçin.
      </p>
    )
  }

  return (
    <>
      <Button type="button" size="sm" variant="outline" onClick={() => handleOpenChange(true)} className="gap-1.5">
        <PackageSearch className="size-3.5" />
        Araca Uygun Parçalar
      </Button>

      <Sheet open={open} onOpenChange={handleOpenChange}>
        <SheetContent side="right" className="w-full sm:max-w-md p-0 gap-0">
          <SheetHeader className="border-b px-4 py-3">
            <div className="flex items-center gap-2 pr-8">
              {(stack.length > 0 || articles) && (
                <button type="button" onClick={goBack} className="p-1 -ml-1 text-muted-foreground hover:text-foreground" aria-label="Geri">
                  <ChevronLeft className="size-5" />
                </button>
              )}
              <div className="min-w-0">
                <SheetTitle className="text-sm truncate">
                  {stack.length === 0 ? "Araca Uygun Parçalar" : stack[stack.length - 1].name}
                </SheetTitle>
                <SheetDescription className="text-xs truncate">
                  {stack.length === 0
                    ? "Kategori seçin"
                    : stack.map((n) => n.name).join(" / ")}
                </SheetDescription>
              </div>
            </div>
          </SheetHeader>

          <div className="flex-1 overflow-y-auto">
            {loading && (
              <div className="flex justify-center py-10">
                <BrandSpinner />
              </div>
            )}

            {!loading && error && (
              <div className="px-4 py-6 text-center text-sm text-muted-foreground space-y-2">
                <p>{error}</p>
                <Button type="button" size="sm" variant="outline" onClick={() => (articles == null && stack.length === 0 ? loadCategories() : setError(""))}>
                  Tekrar dene
                </Button>
              </div>
            )}

            {!loading && !error && articles == null && (
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

            {!loading && !error && filteredArticles && (
              <div>
                <div className="sticky top-0 bg-popover px-3 py-2 border-b">
                  <Input
                    value={filter}
                    onChange={(e) => setFilter(e.target.value)}
                    placeholder={`${articles!.length} parça içinde ara...`}
                  />
                </div>
                {filteredArticles.slice(0, MAX_VISIBLE_ARTICLES).map((a) => (
                  <button
                    key={a.tecdocArticleId}
                    type="button"
                    onClick={() => {
                      onSelect({
                        name: a.productName,
                        articleNo: a.articleNo,
                        tecdocArticleId: a.tecdocArticleId,
                        supplierName: a.supplierName,
                      })
                      handleOpenChange(false)
                    }}
                    className="w-full min-h-11 flex items-center gap-3 px-3 py-2 text-left border-b border-border/60 hover:bg-muted"
                  >
                    {a.imageUrl ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img src={a.imageUrl} alt="" loading="lazy" className="size-10 shrink-0 rounded object-contain bg-white border border-border/60" />
                    ) : (
                      <span className="size-10 shrink-0 rounded bg-muted flex items-center justify-center">
                        <PackageSearch className="size-4 text-muted-foreground/50" />
                      </span>
                    )}
                    <span className="min-w-0 flex-1">
                      <span className="block text-sm text-foreground truncate">{a.productName}</span>
                      <span className="block text-xs text-muted-foreground truncate">
                        <span className="font-mono">{a.articleNo}</span>
                        {a.supplierName && <> · {a.supplierName}</>}
                      </span>
                    </span>
                  </button>
                ))}
                {filteredArticles.length === 0 && (
                  <p className="px-4 py-6 text-center text-sm text-muted-foreground">
                    {filter ? "Aramanızla eşleşen parça yok." : "Bu kategoride araca uygun parça bulunamadı."}
                  </p>
                )}
                {filteredArticles.length > MAX_VISIBLE_ARTICLES && (
                  <p className="px-4 py-3 text-center text-xs text-muted-foreground">
                    İlk {MAX_VISIBLE_ARTICLES} parça gösteriliyor — daraltmak için arama kutusunu kullanın.
                  </p>
                )}
              </div>
            )}
          </div>
        </SheetContent>
      </Sheet>
    </>
  )
}
