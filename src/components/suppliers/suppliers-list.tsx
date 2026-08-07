"use client"

import { useCallback, useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent } from "@/components/ui/card"
import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge"
import type { SupplierKPIs } from "@/lib/suppliers/queries"
import { Plus, Search, X, Truck, Users, Eye, Edit3, Archive, Trash2, RotateCcw, AlertCircle } from "lucide-react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Tooltip, TooltipTrigger, TooltipContent } from "@/components/ui/tooltip"

const STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  passive: "Pasif",
}

type SupplierRow = {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  phone2: string | null
  email: string | null
  city: string | null
  district: string | null
  categories: string[]
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

  // Değişen alanı mevcut filtrelerin üzerine yazar: boş değer o filtreyi kaldırır,
  // diğer filtre korunur (önceden q her koşulda geri yazılıyor → temizlenemiyordu,
  // arama yapınca da seçili durum filtresi düşüyordu).
  // replace: otomatik arama her tuşta geçmişe kayıt bırakmasın.
  const applyFilter = useCallback(
    (key: "q" | "status", value: string) => {
      const next = { ...currentFilters, [key]: value }
      const params = new URLSearchParams()
      if (next.q) params.set("q", next.q)
      if (next.status && next.status !== "all") params.set("status", next.status)
      const qs = params.toString()
      router.replace(`/suppliers${qs ? `?${qs}` : ""}`)
    },
    [currentFilters, router]
  )

  // Yazdıkça otomatik ara (400ms). "Ara" butonu anında tetikleyen kısayol olarak kalır.
  useEffect(() => {
    if (search === currentFilters.q) return
    const timer = setTimeout(() => applyFilter("q", search), 400)
    return () => clearTimeout(timer)
  }, [search, currentFilters.q, applyFilter])

  function handleSearch(e: React.FormEvent) {
    e.preventDefault()
    applyFilter("q", search)
  }

  function clearFilters() {
    setSearch("")
    router.push("/suppliers")
  }

  const hasFilters = currentFilters.q || currentFilters.status !== "all"

  async function handleToggleActive(id: string, isActive: boolean) {
    const mod = await import("@/app/(app)/suppliers/actions")
    if (isActive) {
      await mod.deactivateSupplierAction(id)
    } else {
      await mod.reactivateSupplierAction(id)
    }
    router.refresh()
  }

  async function handleDelete(id: string) {
    setDeleting(id)
    const { deleteSupplierAction } = await import("@/app/(app)/suppliers/actions")
    const res = await deleteSupplierAction(id) as { error?: string }
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
        <span className="text-foreground font-medium">Tedarikçiler</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h2 className="text-lg sm:text-xl font-bold text-foreground flex items-center gap-2">
          <Truck className="size-5 text-primary" />
          Tedarikçiler
        </h2>
        <Button nativeButton={false} size="sm" className="w-full sm:w-auto" render={<Link href="/suppliers/new" />}>
          <Plus className="size-3.5 mr-1" /> Yeni Tedarikçi
        </Button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KpiStat label="Toplam Tedarikçi" value={kpis.total} icon={Truck} accent="text-primary" accentBg="bg-primary/10" />
        <KpiStat label="Aktif" value={kpis.active} icon={Users} accent="text-success-strong" accentBg="bg-success/10" />
        <KpiStat label="Pasif" value={kpis.passive} icon={Archive} accent="text-muted-foreground" accentBg="bg-muted" />
        <KpiStat label="Parça Bağlı" value={kpis.withParts} icon={AlertCircle} accent="text-primary" accentBg="bg-primary/10" />
      </div>

      {/* Arama + durum filtresi + Ara tek satırda (müşteri listesi konvansiyonu).
          Durum Select'i "all" yerine "" kullanır: Base UI placeholder yalnız falsy değerde görünür,
          "all" truthy olduğu için tetikleyici boş görünüyordu. */}
      <form onSubmit={handleSearch} className="flex flex-col sm:flex-row sm:items-center gap-2">
        <div className="relative flex-1 min-w-0">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
          <Input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Tedarikçi adı, yetkili, telefon, e-posta, şehir, kategori ara…"
            aria-label="Tedarikçi ara"
            className="pl-9 pr-9"
          />
          {search && (
            <button
              type="button"
              onClick={() => { setSearch(""); if (currentFilters.q) applyFilter("q", "") }}
              aria-label="Aramayı temizle"
              className="absolute right-2 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground/70 hover:bg-muted hover:text-foreground"
            >
              <X className="size-3.5" />
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <Select
            value={currentFilters.status === "all" ? "" : currentFilters.status}
            onValueChange={(v) => applyFilter("status", v || "all")}
          >
            <SelectTrigger aria-label="Durum filtresi" className="w-full sm:w-40">
              {/* Base UI placeholder'ı yalnız değer null iken gösterir; "" (Tümü) seçiliyken
                  tetikleyici boş kalıyordu → etiketi render fonksiyonundan döndürüyoruz. */}
              <SelectValue placeholder="Tüm Durumlar">
                {(value: string | null) => (value ? STATUS_LABELS[value] ?? value : "Tüm Durumlar")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="">Tüm Durumlar</SelectItem>
              <SelectItem value="active">Aktif</SelectItem>
              <SelectItem value="passive">Pasif</SelectItem>
            </SelectContent>
          </Select>
          <Button type="submit" variant="outline" className="h-11 md:h-8">
            Ara
          </Button>
          {hasFilters && (
            <Button type="button" variant="ghost" onClick={clearFilters} className="h-11 md:h-8">
              <X className="size-3.5" />
              Temizle
            </Button>
          )}
        </div>
      </form>

      {hasFilters && (
        <p className="-mt-3 text-xs text-muted-foreground">
          {suppliers.length} sonuç
          {currentFilters.q && <> · “{currentFilters.q}”</>}
          {currentFilters.status !== "all" && <> · {STATUS_LABELS[currentFilters.status] ?? currentFilters.status}</>}
        </p>
      )}

      {/* Tablo 8 sütunlu: lg altında kart görünümü kullanılır, lg-1180px arasında yatay kaydırılır
          (önceden overflow-hidden idi → Durum/İşlem sütunları erişilemeden kırpılıyordu). */}
      <div className="hidden lg:block">
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border bg-muted">
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Tedarikçi</th>
                {/* Yetkili + e-posta yalnız çok geniş ekranda: 8 sütun ancak 2xl'de kaydırmasız sığıyor,
                    dar ekranda bu ikisi gizlenince tablo tam oturur (bilgiler kartta/detayda mevcut). */}
                <th className="hidden 2xl:table-cell text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Yetkili</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Telefon</th>
                <th className="hidden 2xl:table-cell text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">E-posta</th>
                <th className="text-left px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">İl / İlçe</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Parça</th>
                <th className="text-center px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">Durum</th>
                <th className="text-right px-4 py-3 text-xs font-semibold text-muted-foreground uppercase tracking-wider">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {suppliers.map((s) => (
                <tr key={s.id} className="hover:bg-muted transition-colors">
                  <td className="px-4 py-3 min-w-[200px]">
                    <Link href={`/suppliers/${s.id}`} className="font-medium text-foreground hover:text-primary">
                      {s.name}
                    </Link>
                    {s.categories.length > 0 && (
                      <span className="block text-[11px] text-muted-foreground">{s.categories.join(", ")}</span>
                    )}
                  </td>
                  <td className="hidden 2xl:table-cell px-4 py-3 text-sm text-foreground whitespace-nowrap">{s.contactPerson || <span className="text-muted-foreground/50">—</span>}</td>
                  <td className="px-4 py-3 text-sm whitespace-nowrap">
                    {s.phone ? (
                      <a href={`tel:${s.phone}`} className="text-primary hover:text-primary/80">{s.phone}</a>
                    ) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="hidden 2xl:table-cell px-4 py-3 text-sm">
                    {s.email ? (
                      <a href={`mailto:${s.email}`} className="text-primary hover:text-primary/80 truncate block max-w-[180px]">{s.email}</a>
                    ) : <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-sm text-foreground whitespace-nowrap">
                    {[s.city, s.district].filter(Boolean).join(" / ") || <span className="text-muted-foreground/50">—</span>}
                  </td>
                  <td className="px-4 py-3 text-center">
                    <span className="inline-flex items-center justify-center size-6 rounded-full bg-muted text-xs font-semibold text-foreground">
                      {s.partCount}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-center">
                    <SupplierStatusBadge isActive={s.isActive} />
                  </td>
                  <td className="px-4 py-3 text-right whitespace-nowrap">
                    <div className="flex items-center justify-end gap-1">
                      <Tooltip>
                        <TooltipTrigger render={<Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/suppliers/${s.id}`} />} />}>
                          <Eye className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top">Görüntüle</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger render={<Button variant="ghost" size="icon" nativeButton={false} render={<Link href={`/suppliers/${s.id}/edit`} />} />}>
                          <Edit3 className="size-3.5" />
                        </TooltipTrigger>
                        <TooltipContent side="top">Düzenle</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => handleToggleActive(s.id, s.isActive)} />}>
                          {s.isActive ? <Archive className="size-3.5" /> : <RotateCcw className="size-3.5" />}
                        </TooltipTrigger>
                        <TooltipContent side="top">{s.isActive ? "Pasifleştir" : "Aktifleştir"}</TooltipContent>
                      </Tooltip>
                      <Tooltip>
                        <TooltipTrigger render={<Button variant="ghost" size="icon" onClick={() => handleDelete(s.id)} disabled={deleting === s.id} />}>
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
          </div>
          {suppliers.length === 0 && (
            <div className="text-center py-12 text-sm text-muted-foreground">
              <Truck className="size-10 mx-auto mb-2 text-muted-foreground/50" />
              {hasFilters ? "Aramanızla eşleşen tedarikçi bulunamadı" : "Henüz tedarikçi eklenmedi"}
            </div>
          )}
        </div>
      </div>

      <div className="lg:hidden space-y-3">
        {suppliers.map((s) => (
          <Link key={s.id} href={`/suppliers/${s.id}`}>
            <Card size="sm">
              <CardContent className="p-3 space-y-2">
                <div className="flex items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-semibold text-foreground truncate">{s.name}</p>
                    {s.categories.length > 0 && (
                      <p className="text-[11px] text-muted-foreground truncate">{s.categories.join(", ")}</p>
                    )}
                    {s.contactPerson && <p className="text-[11px] text-muted-foreground">{s.contactPerson}</p>}
                  </div>
                  <SupplierStatusBadge isActive={s.isActive} />
                </div>
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-2 min-w-0">
                    {s.phone && <span>{s.phone}</span>}
                    {s.city && (
                      <span className="truncate">
                        {s.phone && "• "}
                        {[s.city, s.district].filter(Boolean).join(" / ")}
                      </span>
                    )}
                  </div>
                  <span className="inline-flex items-center gap-1 font-medium text-foreground">
                    <Truck className="size-3" /> {s.partCount} parça
                  </span>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
        {suppliers.length === 0 && (
          <div className="text-center py-12 text-sm text-muted-foreground">
            <Truck className="size-10 mx-auto mb-2 text-muted-foreground/50" />
            {hasFilters ? "Aramanızla eşleşen tedarikçi bulunamadı" : "Henüz tedarikçi eklenmedi"}
          </div>
        )}
      </div>

      <p className="text-[11px] text-muted-foreground/70">Tedarikçi teklif/satın alma entegrasyonu ilerleyen sürümlerde eklenecektir.</p>
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