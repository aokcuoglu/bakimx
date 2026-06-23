"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { Car, Search, X, Filter, Calendar, Gauge } from "lucide-react"
import { EmptyState } from "@/components/shared/empty-state"
import { PlateBadge } from "@/components/app/status-badge"
import { ActionsMenu, MobileActionsMenu } from "@/components/app/actions-menu"
import { Input } from "@/components/ui/input"
import { Button } from "@/components/ui/button"
import { formatDate } from "@/lib/utils-client"
import { VEHICLE_TYPES } from "@/lib/constants"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { StatCard } from "@/components/shared/stat-card"
import { FilterSheet, type FilterField } from "@/components/shared/filter-sheet"

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
  hasExpiringDocs?: boolean
  hasServiceDue?: boolean
}

type VehicleKpis = {
  total: number
  active: number
  documentsExpiring: number
  serviceDue: number
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
  kpis,
  onDelete,
}: {
  vehicles: VehicleRow[]
  brands: string[]
  initialFilters: Filters
  kpis?: VehicleKpis
  onDelete?: (id: string, label: string) => void
}) {
  const [q, setQ] = useState(initialFilters.q)
  const [vehicleType, setVehicleType] = useState(initialFilters.vehicleType)
  const [brand, setBrand] = useState(initialFilters.brand)

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

  const vehicleFilterFields: FilterField[] = [
    {
      name: "vehicleType",
      label: "Araç Tipi",
      options: [
        { value: "", label: "Tüm Tipler" },
        ...VEHICLE_TYPES.map((t) => ({ value: t.value, label: t.label })),
      ],
    },
    ...(brands.length > 0
      ? [
          {
            name: "brand",
            label: "Marka",
            options: [
              { value: "", label: "Tüm Markalar" },
              ...brands.map((b) => ({ value: b, label: b })),
            ],
          },
        ]
      : []),
  ]

  return (
    <div className="space-y-4">
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <StatCard label="Toplam" value={kpis.total} />
          <StatCard
            label="Aktif"
            value={kpis.active}
            accent="bg-primary/10 text-primary border-primary/20"
          />
          {/* TODO: Enable when documents/muayene tracking is implemented */}
          {kpis.documentsExpiring > 0 && (
            <StatCard
              label="Belge Bitiyor"
              value={kpis.documentsExpiring}
              accent="bg-warning/10 text-warning border-warning/20"
            />
          )}
          {/* TODO: Enable when maintenance reminders are linked to vehicles */}
          {kpis.serviceDue > 0 && (
            <StatCard
              label="Bakım Gerekli"
              value={kpis.serviceDue}
              accent="bg-destructive/10 text-destructive border-destructive/20"
            />
          )}
        </div>
      )}

      <form
        action="/vehicles"
        method="get"
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Plaka, marka, model veya müşteri ara..."
            className="pl-10"
          />
        </div>
        <div className="lg:hidden">
          <FilterSheet
            fields={vehicleFilterFields}
            initialValues={{ vehicleType, brand }}
            onApply={(v) => {
              setVehicleType(v.vehicleType ?? "")
              setBrand(v.brand ?? "")
            }}
            onClear={() => {
              setVehicleType("")
              setBrand("")
            }}
          />
        </div>
        <div className="hidden lg:flex gap-2 flex-wrap">
          <Select
            value={vehicleType}
            onValueChange={(v) => setVehicleType(v ?? "")}
          >
            <SelectTrigger aria-label="Araç tipi filtresi">
              <SelectValue placeholder="Araç Tipi" />
            </SelectTrigger>
            <SelectContent>
              {VEHICLE_TYPES.map((t) => (
                <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
              ))}
            </SelectContent>
          </Select>
          {brands.length > 0 && (
            <Select
              value={brand}
              onValueChange={(v) => setBrand(v ?? "")}
            >
              <SelectTrigger aria-label="Marka filtresi">
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
          {hasFilter ? (
            <Button variant="ghost" size="default" type="button" onClick={clearFilters}>
              <X className="size-4" />
              <span className="hidden sm:inline">Temizle</span>
            </Button>
          ) : null}
          <Button variant="outline" size="default" type="submit">
            <Filter className="size-4" />
            <span className="hidden sm:inline">Filtrele</span>
          </Button>
        </div>
      </form>

      <div className="flex items-center justify-between text-xs text-muted-foreground px-1">
        <span>
          {filtered.length} araç{hasFilter ? " (filtreli)" : ""}
        </span>
        {hasFilter ? (
          <Button variant="link" size="sm" type="button" onClick={clearFilters}>
            Filtreleri temizle
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Car}
          title={hasFilter ? "Aramanızla eşleşen araç bulunamadı" : "Henüz araç kaydı yok"}
          description={
            hasFilter
              ? "Farklı bir arama veya filtre deneyin"
              : "Yeni bir araç ekleyerek başlayabilirsiniz"
          }
          action={{ label: "+ Yeni Araç", href: "/vehicles/new" }}
        />
      ) : (
        <>
          <DesktopTable
            rows={filtered}
            onDelete={onDelete}
          />
          <MobileCards rows={filtered} />
        </>
      )}
    </div>
  )
}

function DesktopTable({
  rows,
}: {
  rows: VehicleRow[]
  confirmingId?: string | null
  setConfirmingId?: (id: string | null) => void
  onDelete?: (id: string, label: string) => void
}) {
  return (
    <div className="hidden lg:block rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border text-muted-foreground text-xs uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Plaka</th>
              <th className="px-4 py-3 text-left font-semibold">Araç</th>
              <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
              <th className="px-4 py-3 text-right font-semibold">Kilometre</th>
              <th className="px-4 py-3 text-right font-semibold">İş Emri</th>
              <th className="px-4 py-3 text-left font-semibold">Son İşlem</th>
              <th className="px-4 py-3 text-left font-semibold">Kayıt Tarihi</th>
              <th className="px-4 py-3 text-right font-semibold sticky right-0 bg-muted">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/60 transition-colors group">
                <td className="px-4 py-3">
                  <Link href={`/vehicles/${row.id}`}>
                    <PlateBadge plate={row.plate} />
                  </Link>
                </td>
                <td className="px-4 py-3">
                  <div className="flex flex-col">
                    <span className="text-sm font-semibold text-foreground truncate max-w-[180px]">
                      {row.brand} {row.model}
                    </span>
                    {row.modelYear ? (
                      <span className="text-xs text-muted-foreground">{row.modelYear}</span>
                    ) : null}
                  </div>
                </td>
                <td className="px-4 py-3">
                  <Link
                    href={`/customers/${row.customer.id}`}
                    className="text-sm font-medium text-foreground hover:text-primary transition-colors"
                  >
                    {row.customer.displayName}
                  </Link>
                  <div className="text-xs text-muted-foreground">{row.customer.phone}</div>
                </td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">
                  {row.mileage ? (
                    <span className="inline-flex items-center gap-1">
                      <Gauge className="size-3.5 text-muted-foreground/70" />
                      {row.mileage.toLocaleString("tr-TR")} km
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-right tabular-nums">
                  <span className={row.workOrdersCount > 0 ? "text-foreground font-medium" : "text-muted-foreground/70"}>
                    {row.workOrdersCount}
                  </span>
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {row.lastServiceDate ? (
                    <span className="inline-flex items-center gap-1">
                      <Calendar className="size-3 text-muted-foreground/70" />
                      {formatDate(row.lastServiceDate)}
                    </span>
                  ) : (
                    <span className="text-muted-foreground/70">—</span>
                  )}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </td>
                <td className="px-4 py-3 sticky right-0 bg-card group-hover:bg-muted/60">
                  <div className="flex items-center justify-end">
                    <ActionsMenu
                      viewHref={`/vehicles/${row.id}`}
                      editHref={`/vehicles/${row.id}/edit`}
                      workOrderHref={`/orders/new?vehicleId=${row.id}`}
                      appointmentHref={`/appointments/new?vehicleId=${row.id}`}
                      passportHref={`/vehicles/${row.id}/passport`}
                    />
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MobileCards({
  rows,
}: {
  rows: VehicleRow[]
  onDelete?: (id: string, label: string) => void
}) {

  return (
    <div className="lg:hidden space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-lg border border-border bg-card p-3.5 hover:border-border transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <Link href={`/vehicles/${row.id}`}>
                <PlateBadge plate={row.plate} />
              </Link>
              <p className="mt-1.5 text-sm font-semibold text-foreground truncate">
                {row.brand} {row.model}
                {row.modelYear ? ` (${row.modelYear})` : ""}
              </p>
              <Link
                href={`/customers/${row.customer.id}`}
                className="text-xs text-muted-foreground hover:text-primary cursor-pointer"
              >
                {row.customer.displayName}
              </Link>
            </div>
            <MobileActionsMenu
              viewHref={`/vehicles/${row.id}`}
              editHref={`/vehicles/${row.id}/edit`}
              workOrderHref={`/orders/new?vehicleId=${row.id}`}
              appointmentHref={`/appointments/new?vehicleId=${row.id}`}
              passportHref={`/vehicles/${row.id}/passport`}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-muted px-2 py-1.5">
              <p className="text-muted-foreground">Kilometre</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {row.mileage ? `${row.mileage.toLocaleString("tr-TR")} km` : "—"}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-2 py-1.5">
              <p className="text-muted-foreground">İş Emri</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {row.workOrdersCount}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-2 py-1.5">
              <p className="text-muted-foreground">Son İşlem</p>
              <p className="text-sm font-semibold text-foreground">
                {row.lastServiceDate ? formatDate(row.lastServiceDate) : "—"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}