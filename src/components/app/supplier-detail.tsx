"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { SupplierStatusBadge } from "@/components/app/supplier-status-badge"
import { StockStatusBadge } from "@/components/app/stock-status-badge"
import { formatPrice, formatStockQty } from "@/lib/parts/format"
import { formatDeliveryDays, formatPaymentTermDays } from "@/lib/suppliers/format"
import { formatDate } from "@/lib/utils-client"
import type { CriticalSupplierPart } from "@/lib/suppliers/queries"
import { ArrowLeft, Edit3, Truck, Settings2, FileText, Boxes, AlertTriangle, Archive, RotateCcw, DollarSign, ShoppingCart, HelpCircle } from "lucide-react"

type SupplierPart = {
  id: string
  name: string
  sku: string | null
  oemNo: string | null
  stockQty: number
  criticalStockQty: number
  salePrice: number | null
  unit: string
  isActive: boolean
  category: string | null
  brand: string | null
  createdAt: string
  updatedAt: string
}

type SupplierType = {
  id: string
  name: string
  contactPerson: string | null
  phone: string | null
  phone2: string | null
  email: string | null
  website: string | null
  city: string | null
  address: string | null
  taxNumber: string | null
  taxOffice: string | null
  category: string | null
  paymentTermDays: number | null
  averageDeliveryDays: number | null
  performanceNote: string | null
  internalNote: string | null
  isActive: boolean
  createdAt: string
  updatedAt: string
  parts: SupplierPart[]
}

export function SupplierDetail({
  supplier,
  criticalParts,
}: {
  supplier: SupplierType
  criticalParts: CriticalSupplierPart[]
}) {
  const router = useRouter()

  async function handleToggleActive() {
    const { deactivateSupplierAction, reactivateSupplierAction } = await import("@/app/app/suppliers/actions")
    if (supplier.isActive) {
      await deactivateSupplierAction(supplier.id)
    } else {
      await reactivateSupplierAction(supplier.id)
    }
    router.refresh()
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/app/suppliers" className="hover:text-foreground inline-flex items-center gap-1">
          <ArrowLeft className="size-3.5" />
          Tedarikçiler
        </Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">{supplier.name}</span>
      </div>

      <div className="flex flex-col sm:flex-row sm:items-start sm:justify-between gap-3">
        <div className="space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">{supplier.name}</h2>
            <SupplierStatusBadge isActive={supplier.isActive} size="md" />
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
            {supplier.category && <span>Kategori: {supplier.category}</span>}
            {supplier.contactPerson && <span>Yetkili: {supplier.contactPerson}</span>}
            {supplier.phone && <span>Telefon: {supplier.phone}</span>}
            {supplier.city && <span>İl: {supplier.city}</span>}
          </div>
        </div>
        <div className="flex gap-2">
          <Link href={`/app/suppliers/${supplier.id}/edit`}>
            <Button size="sm" variant="outline">
              <Edit3 className="size-3.5 mr-1" /> Düzenle
            </Button>
          </Link>
          <Button size="sm" variant="outline" onClick={handleToggleActive}>
            {supplier.isActive ? <Archive className="size-3.5 mr-1" /> : <RotateCcw className="size-3.5 mr-1" />}
            {supplier.isActive ? "Pasifleştir" : "Aktifleştir"}
          </Button>
          <Link href="/app/suppliers">
            <Button size="sm" variant="outline">
              <ArrowLeft className="size-3.5 mr-1" /> Geri
            </Button>
          </Link>
        </div>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Truck className="size-4 text-muted-foreground" />
                Tedarikçi Özeti
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
                <InfoItem label="Tedarikçi Adı" value={supplier.name} />
                <InfoItem label="Yetkili Kişi" value={supplier.contactPerson || "—"} />
                <InfoItem label="Kategori" value={supplier.category || "—"} />
                {supplier.phone && (
                  <InfoItem label="Telefon" value={<a href={`tel:${supplier.phone}`} className="text-primary hover:text-primary">{supplier.phone}</a>} />
                )}
                {supplier.phone2 && (
                  <InfoItem label="Telefon 2" value={<a href={`tel:${supplier.phone2}`} className="text-primary hover:text-primary">{supplier.phone2}</a>} />
                )}
                {supplier.email && (
                  <InfoItem label="E-posta" value={<a href={`mailto:${supplier.email}`} className="text-primary hover:text-primary break-all">{supplier.email}</a>} />
                )}
                {supplier.website && (
                  <InfoItem label="Web Sitesi" value={<a href={supplier.website.startsWith("http") ? supplier.website : `https://${supplier.website}`} target="_blank" rel="noopener noreferrer" className="text-primary hover:text-primary break-all">{supplier.website}</a>} />
                )}
                <InfoItem label="Şehir" value={supplier.city || "—"} />
                <InfoItem label="Adres" value={supplier.address || "—"} />
                <InfoItem label="Vergi No" value={supplier.taxNumber || "—"} />
                <InfoItem label="Vergi Dairesi" value={supplier.taxOffice || "—"} />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Boxes className="size-4 text-muted-foreground" />
                İlişkili Parçalar
              </CardTitle>
            </CardHeader>
            <CardContent>
              {supplier.parts.length === 0 ? (
                <div className="text-center py-6 text-sm text-muted-foreground">
                  <Boxes className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                  Bu tedarikçiye bağlı parça yok.
                </div>
              ) : (
                <div className="space-y-1.5">
                  {supplier.parts.map((p) => (
                    <Link key={p.id} href={`/app/parts/${p.id}`}>
                      <div className="flex items-center justify-between p-2.5 bg-muted rounded-lg text-sm hover:bg-muted transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <span className="font-medium text-foreground truncate">{p.name}</span>
                          {p.sku && <span className="text-[10px] font-mono text-muted-foreground bg-border px-1.5 py-0.5 rounded shrink-0">{p.sku}</span>}
                          {p.oemNo && <span className="text-[10px] font-mono text-muted-foreground/70 shrink-0">{p.oemNo}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <StockStatusBadge stockQty={p.stockQty} criticalStockQty={p.criticalStockQty} isActive={p.isActive} />
                          <span className="text-xs font-semibold text-foreground w-16 text-right">{formatStockQty(p.stockQty)} {p.unit}</span>
                          {p.salePrice != null && (
                            <span className="text-xs text-muted-foreground w-20 text-right">{formatPrice(p.salePrice)}</span>
                          )}
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {criticalParts.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <AlertTriangle className="size-4 text-destructive" />
                  Kritik Stok Parçaları
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-1.5">
                  {criticalParts.map((p) => (
                    <Link key={p.id} href={`/app/parts/${p.id}`}>
                      <div className="flex items-center justify-between p-2.5 bg-destructive/10 rounded-lg text-sm hover:bg-destructive/20 transition-colors">
                        <div className="flex items-center gap-2 min-w-0">
                          <AlertTriangle className="size-3.5 text-destructive shrink-0" />
                          <span className="font-medium text-foreground truncate">{p.name}</span>
                          {p.sku && <span className="text-[10px] font-mono text-muted-foreground shrink-0">{p.sku}</span>}
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <span className="text-xs font-semibold text-foreground">
                            {p.status === "out_of_stock" ? "Stokta Yok" : "Kritik"}
                          </span>
                          <span className="text-xs text-foreground">{formatStockQty(p.stockQty)} / {formatStockQty(p.criticalStockQty)}</span>
                        </div>
                      </div>
                    </Link>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}

          {criticalParts.length === 0 && (
            <div className="rounded-lg border border-border bg-muted p-4 text-sm text-muted-foreground">
              Bu tedarikçiye bağlı kritik stokta parça yok.
            </div>
          )}
        </div>

        <div className="lg:col-span-1 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <Settings2 className="size-4 text-muted-foreground" />
                Operasyon Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              <InfoRow label="Ortalama Teslimat Süresi" value={formatDeliveryDays(supplier.averageDeliveryDays)} />
              <InfoRow label="Ödeme Vadesi" value={formatPaymentTermDays(supplier.paymentTermDays)} />
              {supplier.performanceNote && (
                <div className="pt-2 border-t">
                  <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider mb-1">Performans Notu</p>
                  <p className="text-sm text-foreground whitespace-pre-wrap">{supplier.performanceNote}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {supplier.internalNote && (
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-muted-foreground" />
                  Dahili Notlar
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-foreground whitespace-pre-wrap">{supplier.internalNote}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <ShoppingCart className="size-4 text-muted-foreground" />
                Satın Alma / Teklif
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <Button variant="outline" className="w-full justify-start" disabled>
                <DollarSign className="size-3.5 mr-2" />
                Teklif İste
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">Yakında</span>
              </Button>
              <Button variant="outline" className="w-full justify-start" disabled>
                <ShoppingCart className="size-3.5 mr-2" />
                Satın Alma Talebi Oluştur
                <span className="ml-auto text-[10px] font-semibold text-muted-foreground/70 bg-muted px-1.5 py-0.5 rounded">Yakında</span>
              </Button>
              <p className="text-[11px] text-muted-foreground/70 flex items-center gap-1">
                <HelpCircle className="size-3" />
                Satın alma ve teklif modülleri ilerleyen sürümlerde eklenecektir.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Kayıt Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-1.5 text-sm">
              <div className="flex justify-between">
                <span className="text-muted-foreground">Oluşturulma</span>
                <span className="text-foreground">{formatDate(supplier.createdAt)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">Güncellenme</span>
                <span className="text-foreground">{formatDate(supplier.updatedAt)}</span>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}

function InfoItem({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">{label}</p>
      <p className="text-sm font-semibold text-foreground mt-0.5">{value}</p>
    </div>
  )
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-center justify-between text-sm">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium text-foreground">{value}</span>
    </div>
  )
}