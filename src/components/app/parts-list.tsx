"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { StockStatusBadge } from "@/components/app/stock-status-badge"
import { formatPrice, formatStockQty } from "@/lib/parts/format"
import type { PartKPIs } from "@/lib/parts/queries"
import { Plus, Search, X, Package, AlertTriangle, Eye, Edit3, Archive, Trash2, Boxes } from "lucide-react"
import { cn } from "@/lib/utils"

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
    router.push(`/app/parts${qs ? `?${qs}` : ""}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    applyFilter("q", search)
  }

  function clearFilters() {
    setSearch("")
    router.push("/app/parts")
  }

  const hasFilters = currentFilters.q || currentFilters.status !== "all" || currentFilters.category || currentFilters.brand

  async function handleDeactivate(id: string) {
    const { deactivatePartAction } = await import("@/app/app/parts/actions")
    await deactivatePartAction(id)
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { deletePartAction } = await import("@/app/app/parts/actions")
    const res = await deletePartAction(id) as { error?: string }
    if (res?.error) {
      alert(res.error)
    } else {
      router.refresh()
    }
    setDeleting(null)
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-medium">Stok / Parçalar</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
          <Package className="size-5 text-blue-600" />
          Stok / Parçalar
        </h2>
        <Link href="/app/parts/new">
          <Button size="sm" className="w-full sm:w-auto">
            <Plus className="size-3.5 mr-1" /> Yeni Parça
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KpiStat label="Toplam Parça" value={kpis.total} icon={Boxes} accent="text-blue-600" accentBg="bg-blue-100" />
        <KpiStat label="Stokta Olan" value={kpis.inStock} icon={Package} accent="text-emerald-600" accentBg="bg-emerald-100" />
        <KpiStat label="Kritik Stokta" value={kpis.critical} icon={AlertTriangle} accent="text-red-600" accentBg="bg-red-100" />
        <KpiStat label="Stokta Yok" value={kpis.outOfStock} icon={AlertTriangle} accent="text-slate-600" accentBg="bg-slate-100" />
        <KpiStat label="Pasif Parça" value={kpis.inactive} icon={Archive} accent="text-slate-500" accentBg="bg-slate-50" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Parça adı, kod, OEM, marka, kategori, tedarikçi ara..."
                className="pl-9 h-9"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Ara
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <select
              value={currentFilters.status}
              onChange={(e) => applyFilter("status", e.target.value)}
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
            >
              <option value="all">Tümü</option>
              <option value="in_stock">Stokta</option>
              <option value="critical">Kritik Stokta</option>
              <option value="out_of_stock">Stokta Yok</option>
              <option value="inactive">Pasif</option>
            </select>

            {categories.length > 0 && (
              <select
                value={currentFilters.category}
                onChange={(e) => applyFilter("category", e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Tüm Kategoriler</option>
                {categories.map((c) => (
                  <option key={c} value={c}>{c}</option>
                ))}
              </select>
            )}

            {brands.length > 0 && (
              <select
                value={currentFilters.brand}
                onChange={(e) => applyFilter("brand", e.target.value)}
                className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
              >
                <option value="">Tüm Markalar</option>
                {brands.map((b) => (
                  <option key={b} value={b}>{b}</option>
                ))}
              </select>
            )}

            {hasFilters && (
              <button
                onClick={clearFilters}
                className="inline-flex items-center gap-1 h-8 px-2.5 rounded-lg border border-slate-200 text-xs font-medium text-slate-500 hover:bg-slate-50"
              >
                <X className="size-3" />
                Filtreleri Temizle
              </button>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="hidden md:block">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Parça</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kod / OEM</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Marka</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kategori</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Stok</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Kritik</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Satış Fiyatı</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Lokasyon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tedarikçi</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {parts.map((part) => (
                <tr key={part.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/app/parts/${part.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                      {part.name}
                    </Link>
                    <span className="block text-[11px] text-slate-500">{part.unit}</span>
                  </td>
                  <td className="px-4 py-3 text-xs font-mono text-slate-500">
                    {part.sku && <div>{part.sku}</div>}
                    {part.oemNo && <div className="text-[10px]">{part.oemNo}</div>}
                    {!part.sku && !part.oemNo && <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{part.brand || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-sm text-slate-700">{part.category || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-right">
                    <span className={cn(
                      "font-semibold text-sm",
                      part.stockQty <= 0 ? "text-slate-400" : part.stockQty <= part.criticalStockQty ? "text-red-600" : "text-slate-900"
                    )}>
                      {formatStockQty(part.stockQty)}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-right text-sm text-slate-500">
                    {part.criticalStockQty > 0 ? formatStockQty(part.criticalStockQty) : "—"}
                  </td>
                  <td className="px-4 py-3 text-right text-sm font-medium text-slate-900">
                    {part.salePrice != null ? formatPrice(part.salePrice) : "—"}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-500">{part.shelfLocation || "—"}</td>
                  <td className="px-4 py-3 text-sm">
                    {part.supplier ? (
                      <Link href={`/app/suppliers/${part.supplier.id}`} className="text-blue-600 hover:text-blue-700">{part.supplier.name}</Link>
                    ) : part.supplierName ? (
                      <span className="text-slate-700">{part.supplierName}</span>
                    ) : <span className="text-slate-300">—</span>}
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
                      <Link
                        href={`/app/parts/${part.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Görüntüle"
                      >
                        <Eye className="size-3.5" />
                      </Link>
                      <Link
                        href={`/app/parts/${part.id}/edit`}
                        className="p-1.5 text-slate-400 hover:text-amber-600 hover:bg-amber-50 rounded-md transition-colors"
                        title="Düzenle"
                      >
                        <Edit3 className="size-3.5" />
                      </Link>
                      {part.isActive ? (
                        <button
                          onClick={() => handleDeactivate(part.id)}
                          className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                          title="Pasifleştir"
                        >
                          <Archive className="size-3.5" />
                        </button>
                      ) : null}
                      <button
                        onClick={() => handleDelete(part.id)}
                        disabled={deleting === part.id}
                        className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-md transition-colors"
                        title="Sil"
                      >
                        <Trash2 className="size-3.5" />
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {parts.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-500">
              <Package className="size-10 mx-auto mb-2 text-slate-300" />
              {hasFilters ? "Aramanızla eşleşen parça bulunamadı" : "Henüz parça eklenmedi"}
            </div>
          )}
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {parts.map((part) => (
          <Link key={part.id} href={`/app/parts/${part.id}`}>
            <Card size="sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{part.name}</p>
                    <div className="flex items-center gap-2 mt-0.5">
                      {part.sku && <span className="text-[10px] font-mono text-slate-500 bg-slate-100 px-1.5 py-0.5 rounded">{part.sku}</span>}
                      {part.oemNo && <span className="text-[10px] font-mono text-slate-400">{part.oemNo}</span>}
                    </div>
                  </div>
                  <StockStatusBadge stockQty={part.stockQty} criticalStockQty={part.criticalStockQty} isActive={part.isActive} />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    {part.brand && <span>{part.brand}</span>}
                    {part.category && <span>• {part.category}</span>}
                  </div>
                  <span className="font-medium text-slate-900">{part.salePrice != null ? formatPrice(part.salePrice) : ""}</span>
                </div>
                <div className="flex items-center justify-between text-xs">
                  <span className={cn(
                    "font-semibold",
                    part.stockQty <= 0 ? "text-slate-400" : part.stockQty <= part.criticalStockQty ? "text-red-600" : "text-slate-900"
                  )}>
                    Stok: {formatStockQty(part.stockQty)} {part.unit}
                  </span>
                  {(part.supplier || part.supplierName) && (
                    <span className="text-slate-400 truncate max-w-[120px]">
                      {part.supplier ? (
                        <Link href={`/app/suppliers/${part.supplier.id}`} className="text-blue-500 hover:text-blue-600">{part.supplier.name}</Link>
                      ) : part.supplierName}
                    </span>
                  )}
                  {part.shelfLocation && !part.supplier && !part.supplierName && <span className="text-slate-400">Raf: {part.shelfLocation}</span>}
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {parts.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-500">
            <Package className="size-10 mx-auto mb-2 text-slate-300" />
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
    <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
      <div className="flex items-center justify-between mb-1">
        <span className="text-[10px] sm:text-xs font-medium text-slate-500 truncate">{label}</span>
        <div className={`size-7 sm:size-9 rounded-lg ${accentBg} flex items-center justify-center`}>
          <Icon className={`size-3.5 sm:size-4 ${accent}`} />
        </div>
      </div>
      <p className="text-lg sm:text-2xl font-bold text-slate-900">{value}</p>
    </div>
  )
}
