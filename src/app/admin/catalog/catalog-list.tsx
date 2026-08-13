"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Plus, Search, X, Loader2, Percent, Boxes, Package } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Badge } from "@/components/ui/badge"
import { Card, CardContent } from "@/components/ui/card"
import { Checkbox } from "@/components/ui/checkbox"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { formatKurus, grossFromNetKurus } from "@/lib/money"
import { BAKIMX_CATEGORIES, bakimxStockStatus } from "@/lib/catalog/bakimx-catalog"
import { BULK_SELECTION_LIMIT } from "@/lib/validations/bakimx-product"
import type { AdminCatalogProductRow, CatalogBrandOption, CatalogFilters } from "@/app/admin/catalog/data"
import {
  bulkSetBakimxProductActiveAction,
  bulkUpdateBakimxProductPricesAction,
  bulkUpdateBakimxProductStockAction,
} from "@/app/admin/catalog/actions"

const STATUS_LABELS: Record<string, string> = {
  all: "Tüm durumlar",
  active: "Aktif",
  passive: "Pasif",
  low_stock: "Kritik stok",
  out_of_stock: "Stokta yok",
}

const STOCK_BADGE: Record<string, { label: string; className: string }> = {
  in_stock: { label: "Stokta", className: "bg-success/10 text-success-strong" },
  low_stock: { label: "Kritik", className: "bg-warning/10 text-warning-strong" },
  out_of_stock: { label: "Stok yok", className: "bg-destructive/10 text-destructive-strong" },
}

export function CatalogList({
  rows,
  total,
  truncated,
  brands,
  filters,
}: {
  rows: AdminCatalogProductRow[]
  total: number
  truncated: boolean
  brands: CatalogBrandOption[]
  filters: CatalogFilters
}) {
  const router = useRouter()
  const [search, setSearch] = useState(filters.q)
  const [selected, setSelected] = useState<string[]>([])
  const [priceOpen, setPriceOpen] = useState(false)
  const [stockOpen, setStockOpen] = useState(false)
  const [pending, startTransition] = useTransition()

  const selectedSet = new Set(selected)
  const allSelected = rows.length > 0 && rows.every((r) => selectedSet.has(r.id))
  const hasFilters = Boolean(filters.q || filters.brandId || filters.categoryKey || filters.status !== "all")

  function pushFilters(next: Partial<CatalogFilters>) {
    const merged = { ...filters, ...next }
    const params = new URLSearchParams()
    if (merged.q) params.set("q", merged.q)
    if (merged.brandId) params.set("brand", merged.brandId)
    if (merged.categoryKey) params.set("category", merged.categoryKey)
    if (merged.status !== "all") params.set("status", merged.status)
    const qs = params.toString()
    setSelected([])
    router.push(`/admin/catalog${qs ? `?${qs}` : ""}`)
  }

  function toggleRow(id: string) {
    setSelected((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  function toggleAll() {
    // Seçim yalnız EKRANDAKİ satırları kapsar; "tümünü seç" gizli satırları almaz.
    setSelected(allSelected ? [] : rows.slice(0, BULK_SELECTION_LIMIT).map((r) => r.id))
  }

  function runBulk(label: string, run: () => Promise<{ ok: true } | { ok: false; error: string }>) {
    startTransition(async () => {
      const result = await run()
      if (!result.ok) {
        toast.error(result.error)
        return
      }
      toast.success(label)
      setSelected([])
      setPriceOpen(false)
      setStockOpen(false)
      router.refresh()
    })
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Ürün Kataloğu</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            BakımX’in kendi ürünleri — fiyat ve stok yönetimi. Fiyatlar KDV hariç girilir.
          </p>
        </div>
        <div className="flex gap-2">
          <Button nativeButton={false} size="sm" variant="outline" render={<Link href="/admin/catalog/brands" />}>
            <Package className="size-3.5 mr-1" /> Markalar
          </Button>
          <Button nativeButton={false} size="sm" render={<Link href="/admin/catalog/new" />}>
            <Plus className="size-3.5 mr-1" /> Yeni Ürün
          </Button>
        </div>
      </div>

      <Card>
        <CardContent className="p-4 space-y-3">
          <form
            onSubmit={(e) => {
              e.preventDefault()
              pushFilters({ q: search })
            }}
            className="flex gap-2"
          >
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
              <Input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ürün adı, kod, marka, OEM ara..."
                className="pl-9"
              />
            </div>
            <Button type="submit" size="sm" variant="outline">
              Ara
            </Button>
          </form>

          <div className="flex flex-wrap gap-2">
            <Select value={filters.status} onValueChange={(v) => pushFilters({ status: (v ?? "all") as CatalogFilters["status"] })}>
              <SelectTrigger>
                <SelectValue placeholder="Tüm durumlar">
                  {(value: string | null) => (value ? STATUS_LABELS[value] ?? value : null)}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {Object.entries(STATUS_LABELS).map(([value, label]) => (
                  <SelectItem key={value} value={value}>
                    {label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.brandId} onValueChange={(v) => pushFilters({ brandId: v ?? "" })}>
              <SelectTrigger>
                <SelectValue placeholder="Tüm markalar">
                  {(value: string | null) =>
                    value ? brands.find((b) => b.id === value)?.name ?? value : null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tüm markalar</SelectItem>
                {brands.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name}
                    {!b.isActive && " (pasif)"}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <Select value={filters.categoryKey} onValueChange={(v) => pushFilters({ categoryKey: v ?? "" })}>
              <SelectTrigger>
                <SelectValue placeholder="Tüm kategoriler">
                  {(value: string | null) =>
                    value ? BAKIMX_CATEGORIES.find((c) => c.key === value)?.label ?? value : null
                  }
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">Tüm kategoriler</SelectItem>
                {BAKIMX_CATEGORIES.map((c) => (
                  <SelectItem key={c.key} value={c.key}>
                    {c.label}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            {hasFilters && (
              <Button
                variant="ghost"
                size="sm"
                onClick={() => {
                  setSearch("")
                  pushFilters({ q: "", brandId: "", categoryKey: "", status: "all" })
                }}
              >
                <X className="size-3" /> Filtreleri temizle
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {selected.length > 0 && (
        <div className="flex flex-wrap items-center gap-2 rounded-lg border bg-card p-3">
          <span className="text-sm font-medium text-foreground">{selected.length} ürün seçildi</span>
          <div className="ml-auto flex flex-wrap gap-2">
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                runBulk("Seçilen ürünler aktifleştirildi", () =>
                  bulkSetBakimxProductActiveAction({ productIds: selected, isActive: true }),
                )
              }
            >
              Aktif yap
            </Button>
            <Button
              size="sm"
              variant="outline"
              disabled={pending}
              onClick={() =>
                runBulk("Seçilen ürünler pasifleştirildi", () =>
                  bulkSetBakimxProductActiveAction({ productIds: selected, isActive: false }),
                )
              }
            >
              Pasif yap
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setPriceOpen(true)}>
              <Percent className="size-3.5 mr-1" /> Fiyat güncelle
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => setStockOpen(true)}>
              <Boxes className="size-3.5 mr-1" /> Stok güncelle
            </Button>
            <Button size="sm" variant="ghost" disabled={pending} onClick={() => setSelected([])}>
              Seçimi temizle
            </Button>
          </div>
        </div>
      )}

      <div className="rounded-lg border bg-card">
        {rows.length === 0 ? (
          <p className="p-6 text-sm text-muted-foreground">
            {hasFilters ? "Filtrelere uyan ürün yok." : "Katalogda henüz ürün yok. “Yeni Ürün” ile başlayın."}
          </p>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-10">
                  <Checkbox checked={allSelected} onCheckedChange={toggleAll} aria-label="Tümünü seç" />
                </TableHead>
                <TableHead>Ürün</TableHead>
                <TableHead>Marka / Kategori</TableHead>
                <TableHead className="text-right">Fiyat (KDV hariç)</TableHead>
                <TableHead className="text-right">KDV dahil</TableHead>
                <TableHead className="text-right">Stok</TableHead>
                <TableHead>Durum</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row) => {
                const stock = STOCK_BADGE[bakimxStockStatus(row)]
                return (
                  <TableRow key={row.id}>
                    <TableCell>
                      <Checkbox
                        checked={selectedSet.has(row.id)}
                        onCheckedChange={() => toggleRow(row.id)}
                        aria-label={`${row.name} seç`}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/catalog/${row.id}`} className="font-medium text-foreground hover:text-primary hover:underline">
                        {row.name}
                      </Link>
                      <p className="text-xs text-muted-foreground">{row.sku}</p>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      {row.brandName}
                      <p className="text-xs">{row.categoryLabel}</p>
                    </TableCell>
                    <TableCell className="text-right tabular-nums">{formatKurus(row.workshopPriceKurus)}</TableCell>
                    <TableCell className="text-right tabular-nums text-muted-foreground">
                      {formatKurus(grossFromNetKurus(row.workshopPriceKurus, row.vatRateBps))}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {row.stockQty}
                      {row.backorderable && <p className="text-xs text-muted-foreground">siparişe açık</p>}
                    </TableCell>
                    <TableCell>
                      <div className="flex flex-wrap gap-1">
                        <Badge variant={row.isActive ? "default" : "secondary"}>
                          {row.isActive ? "Aktif" : "Pasif"}
                        </Badge>
                        <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[11px] font-medium ${stock.className}`}>
                          {stock.label}
                        </span>
                      </div>
                    </TableCell>
                  </TableRow>
                )
              })}
            </TableBody>
          </Table>
        )}
      </div>

      <p className="text-xs text-muted-foreground">
        {truncated
          ? `${total} üründen ilk ${rows.length} tanesi gösteriliyor — aramayı daraltın.`
          : `${total} ürün`}
      </p>

      {/* Yalnız açıkken monte edilir — her açılış boş bir formla başlar. */}
      {priceOpen && (
        <BulkPriceDialog
          onOpenChange={setPriceOpen}
          count={selected.length}
          pending={pending}
          onSubmit={(percent) =>
            runBulk("Fiyatlar güncellendi", () =>
              bulkUpdateBakimxProductPricesAction({ productIds: selected, percent }),
            )
          }
        />
      )}
      {stockOpen && (
        <BulkStockDialog
          onOpenChange={setStockOpen}
          count={selected.length}
          pending={pending}
          onSubmit={(mode, quantity) =>
            runBulk("Stoklar güncellendi", () =>
              bulkUpdateBakimxProductStockAction({ productIds: selected, mode, quantity }),
            )
          }
        />
      )}
    </div>
  )
}

function BulkPriceDialog({
  onOpenChange,
  count,
  pending,
  onSubmit,
}: {
  onOpenChange: (v: boolean) => void
  count: number
  pending: boolean
  onSubmit: (percent: number) => void
}) {
  const [value, setValue] = useState("")
  const percent = Number(value.replace(",", "."))
  const valid = value.trim() !== "" && Number.isFinite(percent) && percent !== 0

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Yüzdesel fiyat güncelleme</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          <p className="text-sm text-muted-foreground">
            Seçilen {count} ürünün KDV hariç fiyatı bu oranda değişir. Zam için pozitif, indirim için negatif değer girin.
          </p>
          <Input
            type="number"
            step="0.1"
            inputMode="decimal"
            placeholder="Örn. 10 veya -5"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={() => onSubmit(percent)} disabled={!valid || pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Uygula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}

function BulkStockDialog({
  onOpenChange,
  count,
  pending,
  onSubmit,
}: {
  onOpenChange: (v: boolean) => void
  count: number
  pending: boolean
  onSubmit: (mode: "set" | "increase" | "decrease", quantity: number) => void
}) {
  const [mode, setMode] = useState<"set" | "increase" | "decrease">("set")
  const [value, setValue] = useState("")
  const quantity = Number(value)
  const valid = value.trim() !== "" && Number.isInteger(quantity) && quantity >= 0

  return (
    <Dialog open onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Toplu stok güncelleme</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <p className="text-sm text-muted-foreground">Seçilen {count} ürünün stok adedi güncellenir.</p>
          <Select value={mode} onValueChange={(v) => setMode((v ?? "set") as "set" | "increase" | "decrease")}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="İşlem">
                {(v: string | null) =>
                  v === "increase" ? "Artır" : v === "decrease" ? "Azalt" : "Şu değere ayarla"
                }
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="set">Şu değere ayarla</SelectItem>
              <SelectItem value="increase">Artır</SelectItem>
              <SelectItem value="decrease">Azalt</SelectItem>
            </SelectContent>
          </Select>
          <Input
            type="number"
            min="0"
            step="1"
            inputMode="numeric"
            placeholder="Adet"
            value={value}
            onChange={(e) => setValue(e.target.value)}
          />
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={pending}>
            Vazgeç
          </Button>
          <Button onClick={() => onSubmit(mode, quantity)} disabled={!valid || pending}>
            {pending && <Loader2 className="size-4 animate-spin" />}
            Uygula
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  )
}
