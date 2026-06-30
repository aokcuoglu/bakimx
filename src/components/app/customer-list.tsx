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
import { Button } from "@/components/ui/button"
import { CustomerTypeBadge, CustomerTagBadge } from "@/components/app/customer-badges"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { ActionsMenu, MobileActionsMenu } from "@/components/app/actions-menu"
import { EmptyState } from "@/components/shared/empty-state"
import { StatCard } from "@/components/shared/stat-card"
import { FilterSheet, type FilterField } from "@/components/shared/filter-sheet"
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

const CUSTOMER_FILTER_FIELDS: FilterField[] = [
  {
    name: "type",
    label: "Müşteri Tipi",
    options: [
      { value: "", label: "Tüm Tipler" },
      { value: "individual", label: "Bireysel" },
      { value: "corporate", label: "Kurumsal" },
    ],
  },
  {
    name: "tag",
    label: "Etiket",
    options: [
      { value: "", label: "Tüm Etiketler" },
      { value: "standard", label: "Standart" },
      { value: "vip", label: "VIP" },
      { value: "risky", label: "Riskli" },
      { value: "fleet", label: "Filo" },
    ],
  },
  {
    name: "source",
    label: "Kaynak",
    options: [
      { value: "", label: "Tüm Kaynaklar" },
      { value: "referral", label: "Tavsiye" },
      { value: "google", label: "Google" },
      { value: "social_media", label: "Sosyal Medya" },
      { value: "walk_in", label: "Yoldan Geldi" },
      { value: "existing", label: "Mevcut Müşteri" },
      { value: "other", label: "Diğer" },
    ],
  },
]

const TYPE_LABELS: Record<string, string> = {
  individual: "Bireysel",
  corporate: "Kurumsal",
}

const TAG_LABELS: Record<string, string> = {
  standard: "Standart",
  vip: "VIP",
  risky: "Riskli",
  fleet: "Filo",
}

const SOURCE_LABELS: Record<string, string> = {
  referral: "Tavsiye",
  google: "Google",
  social_media: "Sosyal Medya",
  walk_in: "Yoldan Geldi",
  existing: "Mevcut Müşteri",
  other: "Diğer",
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
          <StatCard label="Toplam" value={kpis.total} />
          <StatCard
            label="Yeni"
            value={kpis.newThisMonth}
            accent="bg-primary/10 text-primary border-primary/20"
          />
          <StatCard
            label="Tekrar Eden"
            value={kpis.returning}
            accent="bg-success/10 text-success border-success/20"
          />
        </div>
      )}

      <form
        action="/customers"
        method="get"
        className="flex items-center gap-2"
      >
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            name="q"
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Ad, telefon, e-posta veya plaka ara…"
            className="pl-10"
          />
        </div>
        <div className="lg:hidden">
          <FilterSheet
            fields={CUSTOMER_FILTER_FIELDS}
            initialValues={{ type, tag, source }}
            onApply={(v) => {
              setType((v.type ?? "") as Filters["type"])
              setTag(v.tag ?? "")
              setSource(v.source ?? "")
            }}
            onClear={() => {
              setType("")
              setTag("")
              setSource("")
            }}
          />
        </div>
        <div className="hidden lg:flex gap-2">
          <Select
            value={type}
            onValueChange={(v) => setType((v ?? "") as Filters["type"])}
          >
            <SelectTrigger aria-label="Müşteri tipi filtresi">
              <SelectValue placeholder="Tüm Tipler">
                {(value: string | null) => (value ? TYPE_LABELS[value] ?? value : null)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm Tipler</SelectItem>
              <SelectItem value="individual">Bireysel</SelectItem>
              <SelectItem value="corporate">Kurumsal</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={tag}
            onValueChange={(v) => setTag(v ?? "")}
          >
            <SelectTrigger aria-label="Etiket filtresi">
              <SelectValue placeholder="Tüm Etiketler">
                {(value: string | null) => (value ? TAG_LABELS[value] ?? value : null)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm Etiketler</SelectItem>
              <SelectItem value="standard">Standart</SelectItem>
              <SelectItem value="vip">VIP</SelectItem>
              <SelectItem value="risky">Riskli</SelectItem>
              <SelectItem value="fleet">Filo</SelectItem>
            </SelectContent>
          </Select>
          <Select
            value={source}
            onValueChange={(v) => setSource(v ?? "")}
          >
            <SelectTrigger aria-label="Müşteri kaynağı filtresi">
              <SelectValue placeholder="Tüm Kaynaklar">
                {(value: string | null) => (value ? SOURCE_LABELS[value] ?? value : null)}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm Kaynaklar</SelectItem>
              <SelectItem value="referral">Tavsiye</SelectItem>
              <SelectItem value="google">Google</SelectItem>
              <SelectItem value="social_media">Sosyal Medya</SelectItem>
              <SelectItem value="walk_in">Yoldan Geldi</SelectItem>
              <SelectItem value="existing">Mevcut Müşteri</SelectItem>
              <SelectItem value="other">Diğer</SelectItem>
            </SelectContent>
          </Select>
          {hasFilter ? (
            <Button variant="ghost" size="default" type="button" onClick={clearFilters}>
              <X className="size-4" />
              <span className="hidden sm:inline">Filtreleri temizle</span>
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
          {filtered.length} müşteri{hasFilter ? " (filtreli)" : ""}
        </span>
        {hasFilter ? (
          <Button variant="link" size="sm" type="button" onClick={clearFilters}>
            Filtreleri temizle
          </Button>
        ) : null}
      </div>

      {filtered.length === 0 ? (
        <EmptyState
          icon={Users}
          title={hasFilter ? "Aramanızla eşleşen müşteri bulunamadı" : "Henüz müşteri kaydı yok"}
          description={
            hasFilter
              ? "Farklı bir arama veya filtre deneyin"
              : "Yeni bir müşteri ekleyerek başlayabilirsiniz"
          }
          action={{ label: "+ Yeni Müşteri", href: "/customers/new" }}
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
  onDelete,
}: {
  rows: CustomerRow[]
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
              <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
              <th className="px-4 py-3 text-left font-semibold">Telefon</th>
              <th className="px-4 py-3 text-left font-semibold">Tip</th>
              <th className="px-4 py-3 text-left font-semibold">Etiket</th>
              <th className="px-4 py-3 text-right font-semibold">Araç</th>
              <th className="px-4 py-3 text-right font-semibold">İş Emri</th>
              <th className="px-4 py-3 text-right font-semibold">Toplam İşlem</th>
              <th className="px-4 py-3 text-left font-semibold">Kayıt Tarihi</th>
              <th className="px-4 py-3 text-right font-semibold sticky right-0 bg-muted">İşlem</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/60 transition-colors group">
                <td className="px-4 py-3">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="size-9 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                      {row.type === "corporate" ? (
                        <Building2 className="size-4" />
                      ) : (
                        initialsFor(row)
                      )}
                    </div>
                    <div className="min-w-0">
                      <Link
                        href={`/customers/${row.id}`}
                        className="text-sm font-semibold text-foreground hover:text-primary transition-colors truncate block"
                      >
                        {nameFor(row)}
                      </Link>
                      {row.email ? (
                        <div className="text-xs text-muted-foreground truncate">{row.email}</div>
                      ) : null}
                    </div>
                  </div>
                </td>
                <td className="px-4 py-3 text-foreground whitespace-nowrap">
                  <a
                    href={`tel:${row.phone}`}
                    className="inline-flex items-center gap-1.5 hover:text-primary"
                  >
                    <Phone className="size-3.5 text-muted-foreground/70" />
                    {row.phone}
                  </a>
                </td>
                <td className="px-4 py-3">
                  <CustomerTypeBadge type={row.type} />
                </td>
                <td className="px-4 py-3">
                  <CustomerTagBadge tag={row.tag} />
                </td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">{row.vehiclesCount}</td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">{row.workOrdersCount}</td>
                <td className="px-4 py-3 text-right font-semibold text-foreground tabular-nums">
                  {row.grandTotal > 0 ? formatTRY(row.grandTotal) : <span className="text-muted-foreground/70 font-normal">—</span>}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {formatDate(row.createdAt)}
                </td>
                <td className="px-4 py-3 sticky right-0 bg-card group-hover:bg-muted/60">
                  <div className="flex items-center justify-end">
                    <ActionsMenu
                      viewHref={`/customers/${row.id}`}
                      editHref={`/customers/${row.id}?edit=1`}
                      workOrderHref={`/intakes/new?customerId=${row.id}`}
                      appointmentHref={`/appointments/new?customerId=${row.id}`}
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
          className="rounded-lg border border-border bg-card p-3.5 hover:border-border transition-colors"
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-3">
                <div className="size-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold shrink-0">
                  {row.type === "corporate" ? (
                    <Building2 className="size-4" />
                  ) : (
                    initialsFor(row)
                  )}
                </div>
                <div className="min-w-0">
                  <Link
                    href={`/customers/${row.id}`}
                    className="text-sm font-semibold text-foreground truncate block hover:text-primary transition-colors"
                  >
                    {nameFor(row)}
                  </Link>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <CustomerTypeBadge type={row.type} />
                    {row.tag && row.tag !== "standard" ? <CustomerTagBadge tag={row.tag} /> : null}
                  </div>
                </div>
              </div>
              <div className="mt-2 flex items-center gap-3 text-xs text-muted-foreground">
                <a
                  href={`tel:${row.phone}`}
                  className="inline-flex items-center gap-1 hover:text-primary"
                >
                  <Phone className="size-3" />
                  {row.phone}
                </a>
              </div>
            </div>
            <MobileActionsMenu
              viewHref={`/customers/${row.id}`}
              editHref={`/customers/${row.id}?edit=1`}
              workOrderHref={`/intakes/new?customerId=${row.id}`}
              appointmentHref={`/appointments/new?customerId=${row.id}`}
            />
          </div>
          <div className="mt-3 grid grid-cols-3 gap-2 text-[11px]">
            <div className="rounded-lg bg-muted px-2 py-1.5">
              <p className="text-muted-foreground flex items-center gap-1">
                Araç
              </p>
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {row.vehiclesCount}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-2 py-1.5">
              <p className="text-muted-foreground">İş Emri</p>
              <p className="text-sm font-semibold text-foreground tabular-nums">
                {row.workOrdersCount}
              </p>
            </div>
            <div className="rounded-lg bg-muted px-2 py-1.5">
              <p className="text-muted-foreground">Toplam</p>
              <p className="text-sm font-semibold text-foreground truncate">
                {row.grandTotal > 0 ? formatTRY(row.grandTotal) : "—"}
              </p>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}