"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { SupplierStatusBadge } from "@/components/app/supplier-status-badge"
import type { SupplierKPIs } from "@/lib/suppliers/queries"
import { Plus, Search, X, Truck, Users, Eye, Edit3, Archive, Trash2, RotateCcw, AlertCircle } from "lucide-react"

type SupplierRow = {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  phone2: string | null
  email: string | null
  city: string | null
  category: string | null
  isActive: boolean
  partCount: number
  createdAt: string
  updatedAt: string
}

type SuppliersListProps = {
  suppliers: SupplierRow[]
  kpis: SupplierKPIs
  currentFilters: {
    q: string
    status: string
  }
}

export function SuppliersList({ suppliers, kpis, currentFilters }: SuppliersListProps) {
  const router = useRouter()
  const [search, setSearch] = useState(currentFilters.q)
  const [deleting, setDeleting] = useState<string | null>(null)

  function applyFilter(key: string, value: string) {
    const params = new URLSearchParams()
    if (currentFilters.q) params.set("q", currentFilters.q)
    if (key === "q" && value) params.set("q", value)
    if (key === "status" && value && value !== "all") params.set("status", value)
    if (key !== "q" && currentFilters.q) params.set("q", currentFilters.q)
    const qs = params.toString()
    router.push(`/app/suppliers${qs ? `?${qs}` : ""}`)
  }

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    applyFilter("q", search)
  }

  function clearFilters() {
    setSearch("")
    router.push("/app/suppliers")
  }

  const hasFilters = currentFilters.q || currentFilters.status !== "all"

  async function handleToggleActive(id: string, isActive: boolean) {
    const mod = await import("@/app/app/suppliers/actions")
    if (isActive) {
      await mod.deactivateSupplierAction(id)
    } else {
      await mod.reactivateSupplierAction(id)
    }
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { deleteSupplierAction } = await import("@/app/app/suppliers/actions")
    const res = await deleteSupplierAction(id) as { error?: string }
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
        <span className="text-slate-700 font-medium">Tedarikçiler</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-slate-900 flex items-center gap-2">
          <Truck className="size-5 text-blue-600" />
          Tedarikçiler
        </h2>
        <Link href="/app/suppliers/new">
          <Button size="sm" className="w-full sm:w-auto">
            <Plus className="size-3.5 mr-1" /> Yeni Tedarikçi
          </Button>
        </Link>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiStat label="Toplam Tedarikçi" value={kpis.total} icon={Truck} accent="text-blue-600" accentBg="bg-blue-100" />
        <KpiStat label="Aktif" value={kpis.active} icon={Users} accent="text-emerald-600" accentBg="bg-emerald-100" />
        <KpiStat label="Pasif" value={kpis.passive} icon={Archive} accent="text-slate-500" accentBg="bg-slate-100" />
        <KpiStat label="Parça Bağlı" value={kpis.withParts} icon={AlertCircle} accent="text-indigo-600" accentBg="bg-indigo-100" />
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <form onSubmit={handleSearch} className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Tedarikçi adı, yetkili, telefon, e-posta, şehir, kategori ara..."
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
              <option value="active">Aktif</option>
              <option value="passive">Pasif</option>
            </select>

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

          <p className="text-[11px] text-slate-400">Tedarikçi teklif/satın alma entegrasyonu ilerleyen sürümlerde eklenecektir.</p>
        </CardContent>
      </Card>

      <div className="hidden md:block">
        <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-200 bg-slate-50">
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Tedarikçi</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Yetkili</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Telefon</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">E-posta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Şehir</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Parça</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">Durum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-slate-500 uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-slate-50 transition-colors">
                  <td className="px-4 py-3">
                    <Link href={`/app/suppliers/${s.id}`} className="font-medium text-slate-900 hover:text-blue-600">
                      {s.name}
                    </Link>
                    {s.category && <span className="block text-[11px] text-slate-500">{s.category}</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{s.contactPerson || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-sm">
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="text-blue-600 hover:text-blue-700">{s.phone}</a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm">
                    {s.email ? (
                      <a href={`mailto:${s.email}`} className="text-blue-600 hover:text-blue-700 truncate block max-w-[180px]">{s.email}</a>
                    ) : <span className="text-slate-300">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-slate-700">{s.city || <span className="text-slate-300">—</span>}</td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center size-6 rounded-full bg-slate-100 text-xs font-semibold text-slate-700">
                      {s.partCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <SupplierStatusBadge isActive={s.isActive} />
                  </td>
                  <td className="px-4 py-3 text-right">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/app/suppliers/${s.id}`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Görüntüle"
                      >
                        <Eye className="size-3.5" />
                      </Link>
                      <Link
                        href={`/app/suppliers/${s.id}/edit`}
                        className="p-1.5 text-slate-400 hover:text-blue-600 hover:bg-blue-50 rounded-md transition-colors"
                        title="Düzenle"
                      >
                        <Edit3 className="size-3.5" />
                      </Link>
                      <button
                        onClick={() => handleToggleActive(s.id, s.isActive)}
                        className="p-1.5 text-slate-400 hover:text-orange-600 hover:bg-orange-50 rounded-md transition-colors"
                        title={s.isActive ? "Pasifleştir" : "Aktifleştir"}
                      >
                        {s.isActive ? <Archive className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                      </button>
                      <button
                        onClick={() => handleDelete(s.id)}
                        disabled={deleting === s.id}
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
          {suppliers.length === 0 && (
            <div className="text-center py-12 text-sm text-slate-500">
              <Truck className="size-10 mx-auto mb-2 text-slate-300" />
              {hasFilters ? "Aramanızla eşleşen tedarikçi bulunamadı" : "Henüz tedarikçi eklenmedi"}
            </div>
          )}
        </div>
      </div>

      <div className="md:hidden space-y-3">
        {suppliers.map((s) => (
          <Link key={s.id} href={`/app/suppliers/${s.id}`}>
            <Card size="sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-slate-900 truncate">{s.name}</p>
                    {s.contactPerson && <p className="text-[11px] text-slate-500">{s.contactPerson}</p>}
                  </div>
                  <SupplierStatusBadge isActive={s.isActive} />
                </div>
                <div className="flex items-center justify-between text-xs text-slate-500">
                  <div className="flex items-center gap-2">
                    {s.phone && <span>{s.phone}</span>}
                    {s.city && <span>• {s.city}</span>}
                  </div>
                  <span className="inline-flex items-center gap-1 font-medium text-slate-700">
                    <Truck className="size-3" /> {s.partCount} parça
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {suppliers.length === 0 && (
          <div className="text-center py-12 text-sm text-slate-500">
            <Truck className="size-10 mx-auto mb-2 text-slate-300" />
            {hasFilters ? "Aramanızla eşleşen tedarikçi bulunamadı" : "Henüz tedarikçi eklenmedi"}
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