"use client"

import { useState } from "react"
import { toast } from "sonner"
import { Wrench } from "lucide-react"
import { useIsMobile } from "@/hooks/use-mobile"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { PartsLaborGrid, type PartsAddType } from "@/components/orders/parts-labor-grid"
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
 * Kendi tablosu YOKTUR: ofis tarafındaki `/orders/<id>` Kalemler bölümünü
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
 * Belgede KDV oranı yoksa satırda KDV ipucu/brüt tutar görünmez (totals.ts
 * ile aynı: oran yoksa KDV 0); oranı olan belgede satır o orandan okunur.
 */
export function TechnicianPartsLaborSection({
  orderId,
  status,
  items,
  vehicle,
  laborCatalog,
  taxRateBps,
  canEditOrder,
  addingType,
  onAddingTypeChange,
  editRequest,
}: {
  orderId: string
  status: string
  items: OrderItem[]
  vehicle: PickerVehicle
  laborCatalog: LaborCatalogRow[]
  taxRateBps: number | null
  /** `order.edit` izni — sunucu kapısının UI'daki ikizi (bkz. item-editing.ts). */
  canEditOrder: boolean
  /** Kutucuklar ekleme yüzeyini dışarıdan açar (iş ekranı). */
  addingType: PartsAddType | null
  onAddingTypeChange: (type: PartsAddType | null) => void
  /** "Yapılacaklar" satırına dokunma → o kalemin düzenleme penceresi. */
  editRequest: { rowId: string } | null
}) {
  const [loading, setLoading] = useState(false)
  // Telefonda alttan sayfa, lg+ masaüstünde ortalanmış pencere. Yüzey yalnız
  // etkileşimle açıldığı için hidrasyonda yanlış yüzey görünmez.
  const isMobile = useIsMobile()

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
    <section className="rounded-xl bg-card p-4">
      <div className="mb-3 flex items-start justify-between gap-3">
        <div className="min-w-0">
          <h2 className="text-sm font-semibold text-foreground">Parçalar &amp; İşçilikler</h2>
          <p className="mt-0.5 text-xs text-muted-foreground">Kaleme dokunarak düzenleyin; eklemek için yukarıdaki kutucukları kullanın.</p>
        </div>
        <span className="shrink-0 text-sm font-medium tabular-nums text-muted-foreground">{items.length} kalem</span>
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
        allowExternalLabor={false}
        hideAddToolbar
        addSurface={isMobile ? "sheet" : "dialog"}
        addingType={addingType}
        onAddingTypeChange={onAddingTypeChange}
        editRequest={editRequest}
      />
    </section>
  )
}
