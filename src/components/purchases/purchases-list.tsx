"use client"

import { useState } from "react"
import Link from "next/link"
import { PlateBadge } from "@/components/shared/status-badge"
import { StatCard } from "@/components/shared/stat-card"
import { formatTRY } from "@/lib/format"
import { Button } from "@/components/ui/button"
import { PurchaseDetailDialog } from "@/components/purchases/purchase-detail-dialog"
import { EmptyState } from "@/components/shared/empty-state"
import { Eye, PackageSearch } from "lucide-react"

export type PurchaseRow = {
  id: string
  orderId: string
  workOrderNo: string
  name: string
  sku: string | null
  quantity: number
  purchasePriceKurus: number | null
  supplierName: string | null
  purchasedByName: string | null
  purchasedAt: string | null
  photoId: string | null
  orderLocked: boolean
  vehicle: { id: string; plate: string; vin: string | null; brand: string; model: string }
}

type Kpis = {
  count: number
  totalKurus: number
  supplierCount: number
  thisMonthCount: number
}

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  const d = new Date(iso)
  return Number.isNaN(d.getTime())
    ? "—"
    : d.toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

/**
 * Dış alım (source=purchase) kalemlerinin çarşaf listesi — KPI kartları + masaüstü
 * tablo + mobil kart. Her satır ilgili iş emrine link + detay/düzenle modalını açar.
 * Kilitli (teslim/iptal) iş emrine ait alım salt-görünür açılır (orderLocked);
 * server-side de updatePurchaseItemAction kilidi ayrıca zorlar.
 */
export function PurchasesList({ rows, kpis }: { rows: PurchaseRow[]; kpis: Kpis }) {
  const [selected, setSelected] = useState<PurchaseRow | null>(null)

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
        <StatCard label="Toplam Alım" value={kpis.count} accent="bg-primary/10 text-primary-strong border-primary/20" />
        <StatCard label="Toplam Tutar" value={formatTRY(kpis.totalKurus)} accent="bg-success/10 text-success-strong border-success/20" />
        <StatCard label="Tedarikçi" value={kpis.supplierCount} accent="bg-muted text-muted-foreground border-border" />
        <StatCard label="Bu Ay" value={kpis.thisMonthCount} accent="bg-warning/10 text-warning-strong border-warning/20" />
      </div>

      {rows.length === 0 && (
        <EmptyState
          icon={PackageSearch}
          title="Henüz satın alma kaydı yok"
          description="İş emrine dışarıdan alınan bir parça eklendiğinde burada görünür."
        />
      )}

      {/* Masaüstü tablo */}
      <div className={rows.length === 0 ? "hidden" : "hidden lg:block rounded-lg border border-border bg-card overflow-hidden"}>
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-muted-foreground text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-2 text-left font-semibold">İş No</th>
                <th className="px-4 py-2 text-left font-semibold">Plaka</th>
                <th className="px-4 py-2 text-left font-semibold">Parça</th>
                <th className="px-4 py-2 text-left font-semibold">Tedarikçi</th>
                <th className="px-4 py-2 text-center font-semibold">Adet</th>
                <th className="px-4 py-2 text-right font-semibold">Alış Fiyatı</th>
                <th className="px-4 py-2 text-left font-semibold">Tarih</th>
                <th className="px-4 py-2 text-right font-semibold sticky right-0 bg-muted">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-muted/60 transition-colors group">
                  <td className="px-4 py-2">
                    <Link href={`/orders/${r.orderId}`} className="font-mono text-sm font-bold text-foreground hover:text-primary transition-colors">
                      {r.workOrderNo}
                    </Link>
                  </td>
                  <td className="px-4 py-2">
                    <Link href={`/vehicles/${r.vehicle.id}`}>
                      <PlateBadge plate={r.vehicle.plate} size="sm" />
                    </Link>
                  </td>
                  <td className="px-4 py-2 min-w-[12rem]">
                    <div className="text-foreground font-medium">{r.name}</div>
                    {r.sku && <div className="text-[11px] text-muted-foreground">{r.sku}</div>}
                  </td>
                  <td className="px-4 py-2 text-foreground">
                    {r.supplierName || <span className="text-muted-foreground">—</span>}
                  </td>
                  <td className="px-4 py-2 text-center tabular-nums text-foreground">{r.quantity}</td>
                  <td className="px-4 py-2 text-right font-semibold text-foreground tabular-nums">
                    {r.purchasePriceKurus != null ? formatTRY(r.purchasePriceKurus) : <span className="text-muted-foreground font-normal">—</span>}
                  </td>
                  <td className="px-4 py-2 text-xs text-muted-foreground whitespace-nowrap">{formatDate(r.purchasedAt)}</td>
                  <td className="px-4 py-2 sticky right-0 bg-card group-hover:bg-muted/60">
                    <div className="flex items-center justify-end">
                      <Button type="button" variant="ghost" size="icon-sm" aria-label="Detay" onClick={() => setSelected(r)}>
                        <Eye className="size-4" />
                      </Button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Mobil kart */}
      <div className={rows.length === 0 ? "hidden" : "lg:hidden space-y-2.5"}>
        {rows.map((r) => (
          <Button
            type="button"
            variant="outline"
            key={r.id}
            onClick={() => setSelected(r)}
            className="h-auto w-full justify-start whitespace-normal p-3.5 text-left"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-sm font-bold text-foreground">{r.workOrderNo}</span>
                  <PlateBadge plate={r.vehicle.plate} size="sm" />
                </div>
                <p className="mt-1.5 text-sm font-semibold text-foreground truncate">{r.name}</p>
                <p className="text-xs text-muted-foreground truncate">
                  {r.supplierName ? `${r.supplierName} · ` : ""}
                  {r.quantity} adet · {formatDate(r.purchasedAt)}
                </p>
              </div>
              {r.purchasePriceKurus != null && (
                <span className="text-sm font-semibold text-foreground shrink-0">{formatTRY(r.purchasePriceKurus)}</span>
              )}
            </div>
          </Button>
        ))}
      </div>

      {selected && (
        <PurchaseDetailDialog
          open={!!selected}
          onOpenChange={(o) => {
            if (!o) setSelected(null)
          }}
          orderId={selected.orderId}
          editable={!selected.orderLocked}
          item={{
            id: selected.id,
            name: selected.name,
            sku: selected.sku,
            brand: null,
            quantity: selected.quantity,
            purchasePriceKurus: selected.purchasePriceKurus,
            supplierName: selected.supplierName,
            purchasedAt: selected.purchasedAt,
            purchasedByName: selected.purchasedByName,
            purchasePhotoId: selected.photoId,
            tecdocArticleId: null,
          }}
        />
      )}
    </div>
  )
}
