"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { StockStatusBadge } from "@/components/app/stock-status-badge"
import { formatPrice, formatStockQty } from "@/lib/parts/format"
import type { PartKPIs } from "@/lib/parts/queries"
import { Plus, Search, X, Package, AlertTriangle, Eye, Edit3, Archive, Trash2, Boxes } from "lucide-react"
import { cn } from "@/lib/utils"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

type PartWithDates = {
  id: string
  name: string
  sku: string | null
  oemNo: string | null
  brand: string | null
  category: string | null
  stockQty: number
  criticalStockQty: number
  salePrice: number | null
  unit: string
  shelfLocation: string | null
  supplierName: string | null
  supplierId: string | null
  supplier: { id: string; name: string } | null
  isActive: boolean
  createdAt: string
}

type PartsListProps = {
  parts: PartWithDates[]
  kpis: PartKPIs
  brands: string[]
  categories: string[]
  currentFilters: {
    q: string
    status: string
    category: string
    brand: string
  }
}

export function PartsList({ parts, kpis, brands, categories, currentFilters }: PartsListProps) {
  const router = useRouter()
  const [search, setSearch] = useState(currentFilters.q)
  const [deleting, setDeleting] = useState<string | null>(null)

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (currentFilters.q) params.set("q", currentFilters.q)
    if (key === "q" && value) params.set("q", value)
    if (key === "status" && value && value !== "all") params.set("status", value)
    if (key === "category" && value) params.set("category", value)
    if (key === "brand" && value) params.set("brand", value)
    if (key !== "q" && currentFilters.q) params.set("q", currentFilters.q)
    const qs = params.toString()
    router.push(`/parts${qs ? `?${qs}` : ""}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    applyFilter("q", search)
  }

  function clearFilters() {
    setSearch("")
    router.push("/parts")
  }

  const hasFilters = currentFilters.q || currentFilters.status !== "all" || currentFilters.category || currentFilters.brand

  async function handleDeactivate(id: string) {
    const { deactivatePartAction } = await import("@/app/(app)/parts/actions")
    await deactivatePartAction(id)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { deletePartAction } = await import("@/app/(app)/parts/actions")
    const res = await deletePartAction(id) as { error?: string }
    if (res?.error) {
      toast.error(res.error)
    } else {
      router.refresh()
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Stok / Parçalar</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <Package className="size-5 text-primary" />
          Stok / Parçalar
        </h2>
        <Button nativeButton={false} size="sm" className="w-full sm:w-auto" render={<Link href="/parts/new" />}>
          <Plus className="size-3.5 mr-1" /> Yeni Parça
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiStat label="Toplam Parça" value={kpis.total} icon={Boxes} accent="text-primary" accentBg="bg-primary/10" />
        <KpiStat label="Stokta Olan" value={kpis.inStock} icon={Package} accent="text-success" accentBg="bg-success/10" />
        <KpiStat label="Kritik Stokta" value={kpis.critical} icon={AlertTriangle} accent="text-destructive" accentBg="bg-destructive/10" />
        <KpiStat label="Stokta Yok" value={kpis.outOfStock} icon={AlertTriangle} accent="text-muted-foreground" accentBg="bg-muted" />
        <KpiStat label="Pasif Parça" value={kpis.inactive} icon={Archive} accent="text-muted-foreground" accentBg="bg-muted" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Parça adı, kod, OEM, marka, kategori, tedarikçi ara..."
                className="pl-9"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Ara
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Select
              value={currentFilters.status}
              onValueChange={(v) => applyFilter("status", v ?? "all")}
            >
              <SelectTrigger>
                <SelectValue placeholder="Tümü" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tümü</SelectItem>
                <SelectItem value="in_stock">Stokta</SelectItem>
                <SelectItem value="critical">Kritik Stokta</SelectItem>
                <SelectItem value="out_of_stock">Stokta Yok</SelectItem>
                <SelectItem value="inactive">Pasif</SelectItem>
              </SelectContent>
            </Select>

            {categories.length > 0 && (
              <Select
                value={currentFilters.category}
                onValueChange={(v) => applyFilter("category", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tüm Kategoriler" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tüm Kategoriler</SelectItem>
                  {categories.map((c) => (
                    <SelectItem key={c} value={c}>{c}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {brands.length > 0 && (
              <Select
                value={currentFilters.brand}
                onValueChange={(v) => applyFilter("brand", v ?? "")}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Tüm Markalar" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tüm Markalar</SelectItem>
                  {brands.map((b) => (
                    <SelectItem key={b} value={b}>{b}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}

            {hasFilters && (
              <Button variant="ghost" size="sm" onClick={clearFilters}>
                <X className="size-3" />
                Filtreleri Temizle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="hidden md:block">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parça</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kod / OEM</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Marka</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kategori</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Stok</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Kritik</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Satış Fiyatı</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Lokasyon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tedarikçi</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Durum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {parts.map((part) => (
                <tr key={part.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/parts/${part.id}`} className="font-medium text-foreground hover:text-primary">
                      {part.name}
                    </Link>
                    <span className="block text-[11px] text-muted-foreground">{part.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-muted-foreground">
                    {part.sku && <div>{part.sku}</div>}
                    {part.oemNo && <div className="text-[10px]">{part.oemNo}</div>}
                    {!part.sku && !part.oemNo && <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground">{part.brand || <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-4 py-3 text-sm text-foreground">{part.category || <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      "font-semibold text-sm",
                       part.stockQty <= 0 ? "text-muted-foreground/70" : part.stockQty <= part.criticalStockQty ? "text-destructive" : "text-foreground"
                     )}>
                       {formatStockQty(part.stockQty)}
                     </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-muted-foreground">
                    {part.criticalStockQty > 0 ? formatStockQty(part.criticalStockQty) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-foreground">
                    {part.salePrice != null ? formatPrice(part.salePrice) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-muted-foreground">{part.shelfLocation || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {part.supplier ? (
                       <Link href={`/suppliers/${part.supplier.id}`} className="text-primary hover:text-primary/80">{part.supplier.name}</Link>
                    ) : part.supplierName ? (
                      <span className="text-foreground">{part.supplierName}</span>
                    ) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <StockStatusBadge
                      stockQty={part.stockQty}
                      criticalStockQty={part.criticalStockQty}
                      isActive={part.isActive}
                    />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger render={<Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/parts/${part.id}`} />} />}>
                          <Eye className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top">Görüntüle</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger render={<Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/parts/${part.id}/edit`} />} />}>
                          <Edit3 className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top">Düzenle</TooltipContent>
                      </Tooltip>
                      {part.isActive ? (
                        <Tooltip>
                          <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => handleDeactivate(part.id)} />}>
                            <Archive className="size-3.5" />
                          </TooltipTrigger>
                          <TooltipContent side="top">Pasifleştir</TooltipContent>
                        </Tooltip>
                      ) : null}
                      <Tooltip>
                        <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => handleDelete(part.id)} disabled={deleting === part.id} />}>
                          <Trash2 className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top">Sil</TooltipContent>
                      </Tooltip>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {parts.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Package className="size-10 mx-auto mb-2 text-muted-foreground/50" />
              {hasFilters ? "Aramanızla eşleşen parça bulunamadı" : "Henüz parça eklenmedi"}
            </div>
          )}
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {parts.map((part) => (
          <Link key={part.id} href={`/parts/${part.id}`}>
            <Card size="sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{part.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {part.sku && <span className="text-[10px] font-mono text-muted-foreground bg-muted px-1.5 py-0.5 rounded">{part.sku}</span>}
                      {part.oemNo && <span className="text-[10px] font-mono text-muted-foreground/70">{part.oemNo}</span>}
                    </div>
                  </div>
                  <StockStatusBadge stockQty={part.stockQty} criticalStockQty={part.criticalStockQty} isActive={part.isActive} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2">
                    {part.brand && <span>{part.brand}</span>}
                    {part.category && <span>• {part.category}</span>}
                  </div>
                  <span className="font-medium text-foreground">{part.salePrice != null ? formatPrice(part.salePrice) : ""}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={cn(
                    "font-semibold",
                    part.stockQty <= 0 ? "text-muted-foreground/70" : part.stockQty <= part.criticalStockQty ? "text-destructive" : "text-foreground"
                   )}>
                     Stok: {formatStockQty(part.stockQty)} {part.unit}
                   </span>
                  {(part.supplier || part.supplierName) && (
                    <span className="text-muted-foreground/70 truncate max-w-[120px]">
                      {part.supplier ? (
                         <Link href={`/suppliers/${part.supplier.id}`} className="text-primary hover:text-primary/80">{part.supplier.name}</Link>
                      ) : part.supplierName}
                    </span>
                  )}
                  {part.shelfLocation && !part.supplier && !part.supplierName && <span className="text-muted-foreground/70">Raf: {part.shelfLocation}</span>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {parts.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <Package className="size-10 mx-auto mb-2 text-muted-foreground/50" />
            {hasFilters ? "Aramanızla eşleşen parça bulunamadı" : "Henüz parça eklenmedi"}
          </div>
        )}
      </div>
    </div>
  )
}

function KpiStat({ label, value, icon: Icon, accent, accentBg }: {
  label: string
  value: number
  icon: React.ComponentType<{ className?: string }>
  accent: string
  accentBg: string
}) {
  return (
     <div className="rounded-lg border border-border bg-card p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-xs font-medium text-muted-foreground truncate">{label}</span>
        <div className={`size-7 sm:size-9 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 sm:size-4 ${accent}`} />
        </div>
      </div>
      <p className="text-lg sm:text-2xl font-bold text-foreground">{value}</p>
    </div>
  )
}
