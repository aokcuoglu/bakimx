"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Car, Search, Eye, Plus, X, Filter, ChevronRight, Calendar, Gauge } from "lucide-react"
import { PlateBadge } from "@/components/app/plate-badge"
import { Input } from "@/components/ui/input"
import { formatDate } from "@/lib/utils-client"
import { VEHICLE_TYPES } from "@/lib/constants"

export type VehicleRow = {
  id: string
  plate: string
  brand: string
  model: string
  vehicleType: string | null
  modelYear: number | null
  mileage: number | null
  createdAt: string
  customer: {
    id: string
    displayName: string
    phone: string
    type: string
  }
  workOrdersCount: number
  lastServiceDate: string | null
}

type Filters = {
  q: string
  vehicleType: string
  brand: string
}

export function VehicleList({
  vehicles,
  brands,
  initialFilters,
  onDelete,
}: {
  vehicles: VehicleRow[]
  brands: string[]
  initialFilters: Filters
  onDelete?: (id: string, label: string) => void
}) {
  const [q, setQ] = useState(initialFilters.q)
  const [vehicleType, setVehicleType] = useState(initialFilters.vehicleType)
  const [brand, setBrand] = useState(initialFilters.brand)
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  const filtered = useMemo(() => {
    return vehicles.filter((row) => {
      if (vehicleType && row.vehicleType !== vehicleType) return false
      if (brand && row.brand !== brand) return false
      if (!q) return true
      const ql = q.toLowerCase()
      return (
        row.plate.toLowerCase().includes(ql) ||
        row.brand.toLowerCase().includes(ql) ||
        row.model.toLowerCase().includes(ql) ||
        row.customer.displayName.toLowerCase().includes(ql) ||
        row.customer.phone.includes(ql)
      )
    })
  }, [vehicles, q, vehicleType, brand])

  const hasFilter = !!(q || vehicleType || brand)

  function clearFilters() {
    setQ("")
    setVehicleType("")
    setBrand("")
  }

  return (
    <div className="space-y-4">
      <form
        action="/app/vehicles"
        method="get"
        className="flex flex-col sm:flex-row sm:items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Plaka, marka, model veya müşteri ara..."
            className="pl-10 h-11"
          />
        </div>
        <div className="flex gap-2 flex-wrap">
          <select
            name="vehicleType"
            value={vehicleType}
            onChange={(e) => setVehicleType(e.target.value)}
            className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            aria-label="Araç tipi filtresi"
          >
            {VEHICLE_TYPES.map((t) => (
              <option key={t.value} value={t.value}>{t.label}</option>
            ))}
          </select>
          {brands.length > 0 && (
            <select
              name="brand"
              value={brand}
              onChange={(e) => setBrand(e.target.value)}
              className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
              aria-label="Marka filtresi"
            >
              <option value="">Tüm Markalar</option>
              {brands.map((b) => (
                <option key={b} value={b}>{b}</option>
              ))}
            </select>
          )}
          {hasFilter ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors touch-manipulation cursor-pointer"
            >
              <X className="size-4" />
              <span className="hidden sm:inline">Temizle</span>
            </button>
          ) : null}
          <button
            type="submit"
            className="inline-flex items-center gap-1.5 h-11 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors touch-manipulation"
          >
            <Filter className="size-4" />
            <span className="hidden sm:inline">Filtrele</span>
          </button>
        </div>
      </form>

      <div className="flex items-center justify-between text-xs text-slate-500 px-1">
        <span>
          {filtered.length} araç{hasFilter ? " (filtreli)" : ""}
        </span>
        {hasFilter ? (
          <button
            onClick={clearFilters}
            type="button"
            className="text-blue-600 hover:text-blue-700 font-medium"
          >
            Filtreleri temizle
          </button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState hasFilter={hasFilter} />
      ) : (
        <>
          <DesktopTable
            rows={filtered}
            confirmingId={confirmingId}
            setConfirmingId={setConfirmingId}
            onDelete={onDelete}
          />
          <MobileCards rows={filtered} onDelete={onDelete} />
        </>
      )}
    </div>
  )
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="text-center py-16 px-4 text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl">
      <Car className="size-14 mx-auto mb-4 text-slate-300" />
      <p className="text-base font-medium text-slate-700">
        {hasFilter ? "Aramanızla eşleşen araç bulunamadı" : "Henüz araç kaydı yok"}
      </p>
      <p className="text-sm mt-1">
        {hasFilter
          ? "Farklı bir arama veya filtre deneyin"
          : "Yeni bir araç ekleyerek başlayabilirsiniz"}
      </p>
      <Link
        href="/app/vehicles/new"
        className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        <Plus className="size-4" />
        Yeni Araç
      </Link>
    </div>
  )
}

function DesktopTable({
  rows,
  confirmingId,
  setConfirmingId,
  onDelete,
}: {
  rows: VehicleRow[]
  confirmingId: string | null
  setConfirmingId: (id: string | null) => void
  onDelete?: (id: string, label: string) => void
}) {
  return (
    <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Plaka</th>
              <th className="px-4 py-3 text-left font-semibold">Araç</th>
              <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
              <th className="px-4 py-3 text-right font-semibold">Kilometre</th>
              <th className="px-4 py-3 text-right font-semibold">İş Emri</th>
              <th className="px-4 py-3 text-left font-semibold">Son İşlem</th>
              <th className="px-4 py-3 text-left font-semibold">Kayıt Tarihi</th>
              <th className="px-4 py-3 text-right font-semibold">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => {
              const isConfirming = confirmingId === row.id
              return (
                <tr key={row.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <PlateBadge plate={row.plate} />
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex flex-col">
                      <span className="text-sm font-semibold text-slate-900 truncate max-w-[180px]">
                        {row.brand} {row.model}
                      </span>
                      {row.modelYear ? (
                        <span className="text-xs text-slate-500">{row.modelYear}</span>
                      ) : null}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/customers/${row.customer.id}`}
                      className="text-sm font-medium text-slate-700 hover:text-blue-600 transition-colors"
                    >
                      {row.customer.displayName}
                    </Link>
                    <div className="text-xs text-slate-500">{row.customer.phone}</div>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                    {row.mileage ? (
                      <span className="inline-flex items-center gap-1">
                        <Gauge className="size-3.5 text-slate-400" />
                        {row.mileage.toLocaleString("tr-TR")} km
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right tabular-nums">
                    <span className={row.workOrdersCount > 0 ? "text-slate-700 font-medium" : "text-slate-400"}>
                      {row.workOrdersCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {row.lastServiceDate ? (
                      <span className="inline-flex items-center gap-1">
                        <Calendar className="size-3 text-slate-400" />
                        {formatDate(row.lastServiceDate)}
                      </span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {formatDate(row.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/app/vehicles/${row.id}`}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors touch-manipulation"
                      >
                        <Eye className="size-3.5" />
                        Görüntüle
                      </Link>
                      <Link
                        href={`/app/vehicles/${row.id}/edit`}
                        className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors touch-manipulation"
                      >
                        Düzenle
                      </Link>
                      {onDelete ? (
                        isConfirming ? (
                          <button
                            type="button"
                            onClick={() => {
                              onDelete(row.id, `${row.plate} ${row.brand} ${row.model}`)
                              setConfirmingId(null)
                            }}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors touch-manipulation"
                          >
                            Onayla
                          </button>
                        ) : (
                          <button
                            type="button"
                            onClick={() => setConfirmingId(row.id)}
                            className="inline-flex items-center gap-1 h-7 px-2 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors touch-manipulation"
                          >
                            Sil
                          </button>
                        )
                      ) : null}
                    </div>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MobileCards({
  rows,
  onDelete,
}: {
  rows: VehicleRow[]
  onDelete?: (id: string, label: string) => void
}) {
  const [confirmingId, setConfirmingId] = useState<string | null>(null)

  return (
    <div className="lg:hidden space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition-colors"
        >
          <Link href={`/app/vehicles/${row.id}`} className="block">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <PlateBadge plate={row.plate} />
                <p className="mt-1.5 text-sm font-semibold text-slate-900 truncate">
                  {row.brand} {row.model}
                  {row.modelYear ? ` (${row.modelYear})` : ""}
                </p>
                <Link
                  href={`/app/customers/${row.customer.id}`}
                  className="text-xs text-slate-500 hover:text-blue-600"
                  onClick={(e) => e.stopPropagation()}
                >
                  {row.customer.displayName}
                </Link>
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0 mt-1" />
            </div>
          </Link>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Kilometre</p>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                {row.mileage ? `${row.mileage.toLocaleString("tr-TR")} km` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">İş Emri</p>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                {row.workOrdersCount}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Son İşlem</p>
              <p className="text-sm font-semibold text-slate-900">
                {row.lastServiceDate ? formatDate(row.lastServiceDate) : "—"}
              </p>
            </div>
          </div>
          <div className="mt-3 flex items-center gap-1.5 flex-wrap">
            <Link
              href={`/app/vehicles/${row.id}`}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors touch-manipulation"
            >
              <Eye className="size-3.5" />
              Görüntüle
            </Link>
            <Link
              href={`/app/vehicles/${row.id}/edit`}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium text-slate-600 hover:bg-slate-100 transition-colors touch-manipulation"
            >
              Düzenle
            </Link>
            <Link
              href={`/app/intakes/new?vehicleId=${row.id}`}
              className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium text-emerald-600 hover:bg-emerald-50 transition-colors touch-manipulation"
            >
              <Plus className="size-3" />
              Kabul
            </Link>
            {onDelete ? (
              confirmingId === row.id ? (
                <button
                  type="button"
                  onClick={() => {
                    onDelete(row.id, `${row.plate} ${row.brand} ${row.model}`)
                    setConfirmingId(null)
                  }}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium text-white bg-rose-600 hover:bg-rose-700 transition-colors touch-manipulation"
                >
                  Onayla
                </button>
              ) : (
                <button
                  type="button"
                  onClick={() => setConfirmingId(row.id)}
                  className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md text-xs font-medium text-rose-600 hover:bg-rose-50 transition-colors touch-manipulation"
                >
                  Sil
                </button>
              )
            ) : null}
          </div>
        </div>
      ))}
    </div>
  )
}
