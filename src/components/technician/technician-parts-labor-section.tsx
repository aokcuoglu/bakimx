"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Wrench } from "lucide-react"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PartsLaborGrid } from "@/components/orders/parts-labor-grid"
import type { OrderItem } from "@/components/orders/order-management-panel"
import type { PickerVehicle } from "@/components/parts/tecdoc-part-picker"
import type { LaborCatalogRow } from "@/lib/labor/types"
import {
  REQUEST_ONLY_MESSAGE,
  technicianItemEditorMode,
} from "@/lib/technician/item-editing"

/**
 * Teknisyen panelinin "Parça & İşçilik" bölümü (BAK-141).
 *
 * Kendi tablosu YOKTUR: ofis tarafındaki `/orders/<id>?tab=parca` ekranını
 * çalıştıran `PartsLaborGrid` adaptörünü olduğu gibi render eder. Yani parça
 * araması, TecDoc picker'ı, manuel parça diyalogu, işçilik/dış işçilik
 * autocomplete'i, stok düşümü ve satır KDV'si sahada da ofistekiyle BİREBİR
 * aynı davranır — tek kaynak, iki arayüz. Kopya bir düzenleyici yazılırsa
 * `src/lib/technician/item-editing.test.ts` kırmızıya düşer.
 *
 * Buradaki tek fark çerçevede: iş emrinin KDV oranını belgeye yazan
 * `onApplyStandardTax` BİLİNÇLİ olarak bağlanmaz. O bir fiyatlandırma kararıdır
 * ve iş emri meta ucundan geçer (`/api/orders/<id>/meta`); sahadaki teknisyenin
 * bir kalem eklerken belgenin vergi oranını sessizce değiştirmesi beklenmez.
 * Satırın "+₺X KDV" ipucu standart orandan (%20) okunmaya devam eder.
 */
export function TechnicianPartsLaborSection({
  orderId,
  status,
  items,
  vehicle,
  laborCatalog,
  taxRateBps,
  canEditOrder,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle: PickerVehicle
  laborCatalog: LaborCatalogRow[]
  taxRateBps: number | null
  /** `order.edit` izni — sunucu kapısının UI'daki ikizi (bkz. item-editing.ts). */
  canEditOrder: boolean
}) {
  const [loading, setLoading] = useState(false)

  if (technicianItemEditorMode(canEditOrder) === "request-only") {
    return (
      <Alert>
        <Wrench />
        <AlertTitle>Kalem ekleme yetkiniz yok</AlertTitle>
        <AlertDescription>{REQUEST_ONLY_MESSAGE}</AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="rounded-lg border border-border bg-card p-4">
      <div className="mb-3 flex items-center justify-between gap-2">
        <h3 className="flex items-center gap-1.5 text-sm font-semibold text-foreground">
          <Wrench className="size-4 text-muted-foreground" />
          Kullanılan Parçalar &amp; İşçilikler
        </h3>
        <span className="text-xs text-muted-foreground">{items.length} kalem</span>
      </div>
      {/* Hata TOAST ile — ofis tarafıyla aynı gerekçe: uzun kalem listesinde
          sayfa-üstü banner viewport dışında kalıyor ve görülmüyor. */}
      <PartsLaborGrid
        orderId={orderId}
        status={status}
        items={items}
        vehicle={vehicle}
        onError={(msg) => toast.error(msg)}
        onLoading={setLoading}
        loading={loading}
        laborCatalog={laborCatalog}
        taxRateBps={taxRateBps}
      />
    </div>
  )
}
