"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { StockStatusBadge } from "@/components/app/stock-status-badge"
import { StockMovementDialog } from "@/components/app/stock-movement-dialog"
import { formatPrice, formatStockQty } from "@/lib/parts/format"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { ArrowLeft, Edit3, Package, DollarSign, Truck, History, Boxes, Archive, RotateCcw } from "lucide-react"
import { cn } from "@/lib/utils"

type Movement = {
  id: string
  type: string
  quantity: number
  previousQty: number | null
  newQty: number | null
  reason: string | null
  sourceType: string | null
  createdAt: string
}

type PartType = {
  id: string
  name: string
  sku: string | null
  oemNo: string | null
  brand: string | null
  category: string | null
  description: string | null
  unit: string
  stockQty: number
  criticalStockQty: number
  purchasePrice: number | null
  salePrice: number | null
  currency: string
  supplierName: string | null
  supplierPhone: string | null
  shelfLocation: string | null
  barcode: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  movements: Movement[]
}

export function PartDetail({ part }: { part: PartType }) {
  const router = useRouter()
  const [showMovement, setShowMovement] = useState(false)

  async function handleDeactivate() {
    const { deactivatePartAction, reactivatePartAction } = await import("@/app/app/parts/actions")
    if (part.isActive) {
      await deactivatePartAction(part.id)
    } else {
      await reactivatePartAction(part.id)
    }
    router.refresh()
  }

  const movementLabels: Record<string, string> = {
    in: "Giriş",
    out: "Çıkış",
    adjustment: "Düzeltme",
  }

  const movementColors: Record<string, string> = {
    in: "text-emerald-600 bg-emerald-50",
    out: "text-red-600 bg-red-50",
    adjustment: "text-amber-600 bg-amber-50",
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/app/parts" className="hover:text-slate-700 inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Stok / Parçalar
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-medium">{part.name}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">{part.name}</h2>
            <StockStatusBadge stockQty={part.stockQty} criticalStockQty={part.criticalStockQty} isActive={part.isActive} size="md" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-slate-500">
            {part.sku && <span className="font-mono text-xs">Kod: {part.sku}</span>}
            {part.oemNo && <span className="font-mono text-xs">OEM: {part.oemNo}</span>}
            {part.brand && <span>Marka: {part.brand}</span>}
            {part.category && <span>Kategori: {part.category}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Button size="sm" variant="outline" onClick={() => setShowMovement(true)}>
            <Boxes className="size-3.5 mr-1" /> Stok Hareketi
          </Button>
          <Link href={`/app/parts/${part.id}/edit`}>
            <Button size="sm" variant="outline">
              <Edit3 className="size-3.5 mr-1" /> Düzenle
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={handleDeactivate}>
            {part.isActive ? <Archive className="size-3.5 mr-1" /> : <RotateCcw className="size-3.5 mr-1" />}
            {part.isActive ? "Pasifleştir" : "Aktifleştir"}
          </Button>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Package className="size-4 text-slate-500" />
                Parça Özeti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <SummaryItem label="Stok Miktarı" value={formatStockQty(part.stockQty)} unit={part.unit} />
                <SummaryItem label="Kritik Stok" value={formatStockQty(part.criticalStockQty)} unit={part.unit} />
                <SummaryItem
                  label="Durum"
                  value={
                    <StockStatusBadge stockQty={part.stockQty} criticalStockQty={part.criticalStockQty} isActive={part.isActive} />
                  }
                />
                <SummaryItem label="Birim" value={part.unit} />
                <SummaryItem label="Raf / Lokasyon" value={part.shelfLocation || "—"} />
                <SummaryItem label="Barkod" value={part.barcode || "—"} />
              </div>
              {part.description && (
                <div className="mt-4 pt-4 border-t">
                  <p className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-1">Açıklama</p>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap">{part.description}</p>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <History className="size-4 text-slate-500" />
                Stok Hareketleri
              </CardTitle>
            </CardHeader>
            <CardContent>
              {part.movements.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500">
                  <History className="size-8 mx-auto mb-2 text-slate-300" />
                  Henüz stok hareketi yok
                </div>
              ) : (
                <div className="space-y-1.5">
                  {part.movements.slice(0, 20).map((m) => (
                    <div key={m.id} className="flex items-center justify-between p-2.5 bg-slate-50 rounded-lg text-sm">
                      <div className="flex items-center gap-2 min-w-0">
                        <span className={cn("text-[10px] font-semibold uppercase px-1.5 py-0.5 rounded", movementColors[m.type] || "bg-slate-100 text-slate-600")}>
                          {movementLabels[m.type] || m.type}
                        </span>
                        <span className="text-slate-700 font-medium">{m.quantity} {part.unit}</span>
                        {m.reason && <span className="text-xs text-slate-500 truncate">— {m.reason}</span>}
                      </div>
                      <div className="text-right shrink-0">
                        <span className="text-[11px] text-slate-400">{formatDateTime(m.createdAt)}</span>
                        {m.previousQty != null && m.newQty != null && (
                          <div className="text-[10px] text-slate-400">
                            {m.previousQty} → {m.newQty}
                          </div>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <DollarSign className="size-4 text-slate-500" />
                Fiyat Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <PriceRow label="Alış Fiyatı" value={part.purchasePrice != null ? formatPrice(part.purchasePrice, part.currency) : "—"} />
              <PriceRow label="Satış Fiyatı" value={part.salePrice != null ? formatPrice(part.salePrice, part.currency) : "—"} />
              <PriceRow label="Para Birimi" value={part.currency} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="size-4 text-slate-500" />
                Tedarikçi Bilgisi
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <PriceRow label="Tedarikçi Adı" value={part.supplierName || "—"} />
              {part.supplierPhone && (
                <a href={`tel:${part.supplierPhone}`} className="flex items-center gap-1.5 text-sm text-blue-600 hover:text-blue-700">
                  {part.supplierPhone}
                </a>
              )}
              <p className="text-[11px] text-slate-400 mt-2">Tedarikçi yönetimi sonraki sürümlerde eklenecektir.</p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Kayıt Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-500">Oluşturulma</span>
                <span className="text-slate-900">{formatDate(part.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-500">Güncellenme</span>
                <span className="text-slate-900">{formatDate(part.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>

      {showMovement && (
        <StockMovementDialog
          partId={part.id}
          partName={part.name}
          currentStock={part.stockQty}
          unit={part.unit}
          onClose={() => {
            setShowMovement(false)
            router.refresh()
          }}
        />
      )}
    </div>
  )
}

function SummaryItem({ label, value, unit }: { label: string; value: React.ReactNode; unit?: string }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-slate-500 uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-slate-900 mt-0.5">{value}</p>
      {unit && <p className="text-[10px] text-slate-400">{unit}</p>}
    </div>
  )
}

function PriceRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-slate-500">{label}</span>
      <span className="font-medium text-slate-900">{value}</span>
    </div>
  )
}
