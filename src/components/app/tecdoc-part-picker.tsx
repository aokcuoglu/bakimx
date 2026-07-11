"use client"

import { useCallback, useMemo, useState } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
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
import { ChevronLeft, ChevronRight, Loader2, PackageSearch, ScanLine } from "lucide-react"
import { VinCandidateList } from "./vin-resolve"
import { linkVehicleCatalogAction } from "@/app/(app)/vehicles/actions"
import { isValidVin, type VinCandidate, type VinResolution } from "@/lib/vin/types"
import type { ArticleSummary, CategoryNode } from "@/lib/tecdoc/types"

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

/** Case-insensitive contains that survives the Turkish dotted/dotless I:
 *  "aisin" must match "AISIN" (tr-lower → "aısın") and "İ" must match "i". */
function trIncludes(haystack: string, needle: string): boolean {
  return (
    haystack.toLocaleLowerCase("tr").includes(needle.toLocaleLowerCase("tr")) ||
    haystack.toLowerCase().includes(needle.toLowerCase())
  )
}

/**
 * TecDoc vehicle-parts picker: category drill-down → article list → onSelect.
 * Depends only on the normalized CategoryNode/ArticleSummary shapes served by
 * /api/tecdoc/* — raw provider payloads never reach the client.
 */
export function TecdocPartPicker({
  vehicle,
  onSelect,
  open: controlledOpen,
  onOpenChange: controlledOnOpenChange,
  hideTrigger,
}: {
  vehicle: PickerVehicle | undefined
  onSelect: (sel: TecdocPartSelection) => void
  open?: boolean
  onOpenChange?: (v: boolean) => void
  hideTrigger?: boolean
}) {
  const [uncontrolledOpen, setUncontrolledOpen] = useState(false)
  const open = controlledOpen ?? uncontrolledOpen
  const setOpen = controlledOnOpenChange ?? setUncontrolledOpen
  const [tree, setTree] = useState<CategoryNode[] | null>(null)
  const [stack, setStack] = useState<CategoryNode[]>([]) // drill-down breadcrumb
  const [articles, setArticles] = useState<ArticleSummary[] | null>(null)
  const [filter, setFilter] = useState("")
  const [supplierFilter, setSupplierFilter] = useState<string>("")
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
      setSupplierFilter("")
      setError("")
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
    const q = filter.trim()
    let list = supplierFilter ? articles.filter((a) => a.supplierName === supplierFilter) : articles
    if (q) list = list.filter((a) => trIncludes(a.productName, q) || trIncludes(a.articleNo, q) || trIncludes(a.supplierName, q))
    return list
  }, [articles, filter, supplierFilter])

  if (!vehicle) return null

  if (vehicleTypeId == null) {
    if (hideTrigger) return null
    return <VinLinkPrompt vehicle={vehicle} />
  }

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
          <DialogHeader className="border-b px-4 py-3">
            <div className="flex items-center gap-2 pr-8">
              {(stack.length > 0 || articles) && (
                <button type="button" onClick={goBack} className="p-1 -ml-1 text-muted-foreground hover:text-foreground" aria-label="Geri">
                  <ChevronLeft className="size-5" />
                </button>
              )}
              <div className="min-w-0">
                <DialogTitle className="text-sm truncate">
                  {stack.length === 0 ? "Araca Uygun Parçalar" : stack[stack.length - 1].name}
                </DialogTitle>
                <DialogDescription className="text-xs truncate">
                  {stack.length === 0
                    ? "Kategori seçin"
                    : stack.map((n) => n.name).join(" / ")}
                </DialogDescription>
              </div>
            </div>
          </DialogHeader>

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
                  {supplierOptions.length > 0 && (
                    <Select value={supplierFilter || "all"} onValueChange={(v) => setSupplierFilter(v && v !== "all" ? v : "")}>
                      <SelectTrigger className="h-9 mt-2"><SelectValue placeholder="Tüm markalar" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all">Tüm markalar</SelectItem>
                        {supplierOptions.map((s) => (<SelectItem key={s} value={s}>{s}</SelectItem>))}
                      </SelectContent>
                    </Select>
                  )}
                </div>
                {filteredArticles.slice(0, MAX_VISIBLE_ARTICLES).map((a) => (
                  <button
                    key={a.tecdocArticleId}
                    type="button"
                    onClick={() => {
                      const cat = stack[stack.length - 1]
                      onSelect({
                        name: a.productName,
                        articleNo: a.articleNo,
                        tecdocArticleId: a.tecdocArticleId,
                        supplierName: a.supplierName,
                        categoryName: cat?.name ?? "",
                        categoryId: cat?.id ?? 0,
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
        </DialogContent>
      </Dialog>
    </>
  )
}

/**
 * Shown on the Parça sekmesi when the vehicle has no catalogVehicleTypeId yet.
 * "VIN'den bağla" resolves the VIN against the local catalog and writes the
 * chosen engine variant back to the vehicle — no detour to the edit form. A
 * confident match links straight away; several variants surface a tappable
 * list; router.refresh() re-runs the page so the picker flips to the catalog.
 */
function VinLinkPrompt({ vehicle }: { vehicle: PickerVehicle }) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")
  const [notice, setNotice] = useState("")
  const [candidates, setCandidates] = useState<VinCandidate[]>([])

  const hasVin = isValidVin(vehicle.vin ?? "")

  async function link(c: { vehicleTypeId: number; brandId: number; modelId: number }) {
    setLoading(true)
    setError("")
    const res = await linkVehicleCatalogAction(vehicle.id, {
      catalogVehicleTypeId: c.vehicleTypeId,
      catalogBrandId: c.brandId,
      catalogModelId: c.modelId,
    })
    if (res.error) {
      setError(res.error)
      setLoading(false)
      return
    }
    // Server data now carries catalogVehicleTypeId → the picker re-renders with
    // the "Araca Uygun Parçalar" button. Stay loading through the refresh.
    router.refresh()
  }

  async function resolve() {
    const vin = vehicle.vin ?? ""
    if (!isValidVin(vin)) return
    setLoading(true)
    setError("")
    setNotice("")
    setCandidates([])
    try {
      const res = await fetch("/api/vin/resolve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          vin,
          hints: {
            engineDisplacement: vehicle.engineDisplacement || undefined,
            enginePower: vehicle.enginePower || undefined,
            fuelType: vehicle.fuelType || undefined,
            firstRegistrationDate: vehicle.firstRegistrationDate || undefined,
            modelYear: vehicle.modelYear ?? undefined,
          },
        }),
      })
      const data = await res.json()
      if (!res.ok) {
        setError(data.error || "VIN sorgulanamadı.")
        setLoading(false)
        return
      }
      const result = data as VinResolution
      if (result.status === "not_found") {
        setNotice("VIN katalogda bulunamadı — Araç düzenle sayfasından marka/model seçin.")
        setLoading(false)
        return
      }
      const auto =
        result.status === "resolved" && result.autoSelected != null
          ? result.candidates.find((c) => c.vehicleTypeId === result.autoSelected)
          : undefined
      if (auto) {
        // Confident single match — link() keeps loading=true through the refresh.
        await link({ vehicleTypeId: auto.vehicleTypeId, brandId: auto.brandId, modelId: auto.modelId })
        return
      }
      if (result.candidates.length > 0) {
        setCandidates(result.candidates)
        setLoading(false)
        return
      }
      // Brand/model matched but no engine variant → nothing to link parts to.
      setNotice("Marka/model tanındı ama motor varyantı belirlenemedi — Araç düzenle sayfasından motoru seçin.")
      setLoading(false)
    } catch {
      setError("VIN sorgulama sırasında bir hata oluştu. Lütfen tekrar deneyin.")
      setLoading(false)
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-xs text-muted-foreground">
        Araç henüz kataloğa bağlı değil. Şase (VIN) numarasından araca uygun parçaları getirmek için{" "}
        <span className="font-medium text-foreground">VIN&apos;den bağla</span>&apos;ya basın
        {hasVin ? "." : " — önce Araç düzenle sayfasından geçerli bir şase numarası girin."}
      </p>
      <div className="flex flex-wrap items-center gap-x-3 gap-y-2">
        <Button type="button" size="sm" variant="outline" disabled={!hasVin || loading} onClick={resolve} className="gap-1.5">
          {loading ? <Loader2 className="size-3.5 animate-spin" /> : <ScanLine className="size-3.5" />}
          VIN&apos;den bağla
        </Button>
        <Link
          href={`/vehicles/${vehicle.id}/edit`}
          className="text-xs text-muted-foreground underline underline-offset-2 hover:text-foreground"
        >
          Araç bilgilerini düzenle
        </Link>
      </div>
      {notice && <p className="text-xs text-muted-foreground">{notice}</p>}
      {error && <p className="text-xs text-destructive">{error}</p>}
      {candidates.length > 0 && (
        <VinCandidateList
          candidates={candidates}
          selectedId={null}
          onSelect={(c) => link({ vehicleTypeId: c.vehicleTypeId, brandId: c.brandId, modelId: c.modelId })}
          onDismiss={() => setCandidates([])}
        />
      )}
    </div>
  )
}
