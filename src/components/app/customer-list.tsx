"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import {
  Users,
  Search,
  Phone,
  X,
  Filter,
  Building2,
} from "lucide-react"
import { Input } from "@/components/ui/input"
import { CustomerTypeBadge, CustomerTagBadge } from "@/components/app/customer-badges"
import { ActionsMenu, MobileActionsMenu } from "@/components/app/actions-menu"
import { formatTRY } from "@/lib/format"
import { formatDate } from "@/lib/utils-client"

export type CustomerRow = {
  id: string
  type: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  phone: string
  email: string | null
  tag: string | null
  source: string | null
  createdAt: string
  vehiclesCount: number
  workOrdersCount: number
  grandTotal: number
  vehiclesPlates: string[]
}

type CustomerKpis = {
  total: number
  newThisMonth: number
  returning: number
}

type Filters = {
  q: string
  type: "" | "individual" | "corporate"
  tag: string
  source: string
}

function nameFor(row: CustomerRow) {
  if (row.type === "corporate") return row.companyName || "—"
  return row.fullName || [row.firstName, row.lastName].filter(Boolean).join(" ") || "—"
}

function initialsFor(row: CustomerRow) {
  const name = nameFor(row)
  if (!name) return "?"
  return name
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() || "")
    .join("") || "?"
}

export function CustomerList({
  customers,
  initialFilters,
  kpis,
  onDelete,
}: {
  customers: CustomerRow[]
  initialFilters: Filters
  kpis?: CustomerKpis
  onDelete?: (id: string, label: string) => void
}) {
  const [q, setQ] = useState(initialFilters.q)
  const [type, setType] = useState<Filters["type"]>(initialFilters.type)
  const [tag, setTag] = useState(initialFilters.tag)
  const [source, setSource] = useState(initialFilters.source)

  const filtered = useMemo(() => {
    return customers.filter((row) => {
      if (type && row.type !== type) return false
      if (tag && (row.tag || "") !== tag) return false
      if (source && (row.source || "") !== source) return false
      return true
    })
  }, [customers, type, tag, source])

  const hasFilter = !!(q || type || tag || source)

  function clearFilters() {
    setQ("")
    setType("")
    setTag("")
    setSource("")
  }

  return (
    <div className="space-y-4">
      {kpis && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Toplam</span>
              <span className="h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold bg-slate-50 text-slate-600 border-slate-200">
                {kpis.total}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-900">{kpis.total}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Yeni</span>
              <span className="h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold bg-blue-50 text-blue-700 border-blue-200">
                {kpis.newThisMonth}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-900">{kpis.newThisMonth}</p>
          </div>
          <div className="rounded-xl border border-slate-200 bg-white p-3 sm:p-4">
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">Tekrar Eden</span>
              <span className="h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold bg-emerald-50 text-emerald-700 border-emerald-200">
                {kpis.returning}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-900">{kpis.returning}</p>
          </div>
        </div>
      )}

      <form
        action="/app/customers"
        method="get"
        className="flex flex-col sm:flex-row sm:items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
          <Input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, telefon, e-posta veya plaka ara…"
            className="pl-10 h-11"
          />
        </div>
        <div className="flex gap-2">
          <select
            name="type"
            value={type}
            onChange={(e) => setType(e.target.value as Filters["type"])}
            className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            aria-label="Müşteri tipi filtresi"
          >
            <option value="">Tüm Tipler</option>
            <option value="individual">Bireysel</option>
            <option value="corporate">Kurumsal</option>
          </select>
          <select
            name="tag"
            value={tag}
            onChange={(e) => setTag(e.target.value)}
            className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            aria-label="Etiket filtresi"
          >
            <option value="">Tüm Etiketler</option>
            <option value="standard">Standart</option>
            <option value="vip">VIP</option>
            <option value="risky">Riskli</option>
            <option value="fleet">Filo</option>
          </select>
          <select
            name="source"
            value={source}
            onChange={(e) => setSource(e.target.value)}
            className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            aria-label="Müşteri kaynağı filtresi"
          >
            <option value="">Tüm Kaynaklar</option>
            <option value="referral">Tavsiye</option>
            <option value="google">Google</option>
            <option value="social_media">Sosyal Medya</option>
            <option value="walk_in">Yoldan Geldi</option>
            <option value="existing">Mevcut Müşteri</option>
            <option value="other">Diğer</option>
          </select>
          {hasFilter ? (
            <button
              type="button"
              onClick={clearFilters}
              className="inline-flex items-center gap-1.5 h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 hover:bg-slate-50 transition-colors touch-manipulation cursor-pointer"
            >
              <X className="size-4" />
              <span className="hidden sm:inline">Filtreleri temizle</span>
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
          {filtered.length} müşteri{hasFilter ? " (filtreli)" : ""}
        </span>
        {hasFilter ? (
          <button
            onClick={clearFilters}
            className="text-blue-600 hover:text-blue-700 font-medium"
            type="button"
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
            onDelete={onDelete}
          />
          <MobileCards rows={filtered} />
        </>
      )}
    </div>
  )
}

function EmptyState({ hasFilter }: { hasFilter: boolean }) {
  return (
    <div className="text-center py-16 px-4 text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl">
      <Users className="size-14 mx-auto mb-4 text-slate-300" />
      <p className="text-base font-medium text-slate-700">
        {hasFilter ? "Aramanızla eşleşen müşteri bulunamadı" : "Henüz müşteri kaydı yok"}
      </p>
      <p className="text-sm mt-1">
        {hasFilter
          ? "Farklı bir arama veya filtre deneyin"
          : "Yeni bir müşteri ekleyerek başlayabilirsiniz"}
      </p>
      <Link
        href="/app/customers/new"
        className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
      >
        + Yeni Müşteri
      </Link>
    </div>
  )
}

function DesktopTable({
  rows,
  onDelete,
}: {
  rows: CustomerRow[]
  confirmingId?: string | null
  setConfirmingId?: (id: string | null) => void
  onDelete?: (id: string, label: string) => void
}) {
  return (
    <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto max-h-[70vh]">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider sticky top-0 z-10">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
              <th className="px-4 py-3 text-left font-semibold">Telefon</th>
              <th className="px-4 py-3 text-left font-semibold">Tip</th>
              <th className="px-4 py-3 text-left font-semibold">Etiket</th>
              <th className="px-4 py-3 text-right font-semibold">Araç</th>
              <th className="px-4 py-3 text-right font-semibold">İş Emri</th>
              <th className="px-4 py-3 text-right font-semibold">Toplam İşlem</th>
              <th className="px-4 py-3 text-left font-semibold">Kayıt Tarihi</th>
              <th className="px-4 py-3 text-right font-semibold sticky right-0 bg-slate-50">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-slate-50/60 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-9 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold shrink-0">
                      {row.type === "corporate" ? (
                        <Building2 className="size-4" />
                      ) : (
                        initialsFor(row)
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/app/customers/${row.id}`}
                        className="text-sm font-semibold text-slate-900 hover:text-blue-600 transition-colors truncate block"
                      >
                        {nameFor(row)}
                      </Link>
                      {row.email ? (
                        <div className="text-xs text-slate-500 truncate">{row.email}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                  <a
                    href={`tel:${row.phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-blue-600"
                  >
                    <Phone className="size-3.5 text-slate-400" />
                    {row.phone}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <CustomerTypeBadge type={row.type} />
                </td>
                <td className="px-4 py-3">
                  <CustomerTagBadge tag={row.tag} />
                </td>
                <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{row.vehiclesCount}</td>
                <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{row.workOrdersCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-slate-900 tabular-nums">
                  {row.grandTotal > 0 ? formatTRY(row.grandTotal) : <span className="text-slate-400 font-normal">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </td>
                <td className="px-4 py-3 sticky right-0 bg-white group-hover:bg-slate-50/60">
                  <div className="flex items-center justify-end">
                    <ActionsMenu
                      viewHref={`/app/customers/${row.id}`}
                      editHref={`/app/customers/${row.id}?edit=1`}
                      workOrderHref={`/app/orders/new?customerId=${row.id}`}
                      appointmentHref={`/app/appointments/new?customerId=${row.id}`}
                      onArchive={onDelete ? () => onDelete(row.id, nameFor(row)) : undefined}
                      archiveLabel="Sil"
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

function MobileCards({ rows }: { rows: CustomerRow[]; onDelete?: (id: string, label: string) => void }) {

  return (
    <div className="lg:hidden space-y-2.5">
      {rows.map((row) => (
        <div
          key={row.id}
          className="rounded-xl border border-slate-200 bg-white p-3.5 hover:border-slate-300 transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
                  {row.type === "corporate" ? (
                    <Building2 className="size-4" />
                  ) : (
                    initialsFor(row)
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/app/customers/${row.id}`}
                    className="text-sm font-semibold text-slate-900 truncate block hover:text-blue-600 transition-colors"
                  >
                    {nameFor(row)}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CustomerTypeBadge type={row.type} />
                    {row.tag && row.tag !== "standard" ? <CustomerTagBadge tag={row.tag} /> : null}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-slate-500">
                <a
                  href={`tel:${row.phone}`}
                  className="inline-flex items-center gap-1 hover:text-blue-600"
                >
                  <Phone className="size-3" />
                  {row.phone}
                </a>
              </div>
            </div>
            <MobileActionsMenu
              viewHref={`/app/customers/${row.id}`}
              editHref={`/app/customers/${row.id}?edit=1`}
              workOrderHref={`/app/orders/new?customerId=${row.id}`}
              appointmentHref={`/app/appointments/new?customerId=${row.id}`}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500 flex items-center gap-1">
                Araç
              </p>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                {row.vehiclesCount}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">İş Emri</p>
              <p className="text-sm font-semibold text-slate-900 tabular-nums">
                {row.workOrdersCount}
              </p>
            </div>
            <div className="rounded-lg bg-slate-50 px-2 py-1.5">
              <p className="text-slate-500">Toplam</p>
              <p className="text-sm font-semibold text-slate-900 truncate">
                {row.grandTotal > 0 ? formatTRY(row.grandTotal) : "—"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}