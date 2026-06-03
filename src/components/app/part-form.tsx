"use client"

import { useActionState, useEffect } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { createPartAction, updatePartAction } from "@/app/app/parts/actions"
import { ArrowLeft, Loader2, Save } from "lucide-react"

type PartData = {
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
}

type ActionState = {
  error?: string
  success?: boolean
  id?: string
}

export function PartForm({ part }: { part?: PartData }) {
  const router = useRouter()
  const isEdit = !!part

  const action = async (_prev: ActionState | null, formData: FormData): Promise<ActionState | null> => {
    if (isEdit && part) {
      return updatePartAction(part.id, formData) as unknown as Promise<ActionState | null>
    }
    return createPartAction(formData) as unknown as Promise<ActionState | null>
  }

  const [state, formAction, pending] = useActionState(action, null as ActionState | null)

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/app/parts/${state.id}`)
    }
  }, [state, router])

  return (
    <form action={formAction}>
      {state?.error && (
        <div className="mb-5 p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm">{state.error}</div>
      )}

      <div className="flex items-center gap-3 mb-5">
        <Link href={isEdit ? `/app/parts/${part?.id}` : "/app/parts"} className="text-slate-400 hover:text-slate-600">
          <ArrowLeft className="size-4" />
        </Link>
        <h2 className="text-lg font-bold text-slate-900">{isEdit ? "Parça Düzenle" : "Yeni Parça"}</h2>
      </div>

      <div className="space-y-5 max-w-3xl">
        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Parça Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="space-y-2">
              <Label htmlFor="name">Parça Adı *</Label>
              <Input id="name" name="name" defaultValue={part?.name || ""} placeholder="Fren balatası, yağ filtresi..." required />
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="sku">Parça Kodu / SKU</Label>
                <Input id="sku" name="sku" defaultValue={part?.sku || ""} placeholder="Opsiyonel" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="oemNo">OEM No</Label>
                <Input id="oemNo" name="oemNo" defaultValue={part?.oemNo || ""} placeholder="Opsiyonel" />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="brand">Marka</Label>
                <Input id="brand" name="brand" defaultValue={part?.brand || ""} placeholder="Bosch, Mann, OEM..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="category">Kategori</Label>
                <Input id="category" name="category" defaultValue={part?.category || ""} placeholder="Fren, Motor, Filtre..." />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="description">Açıklama</Label>
              <Textarea id="description" name="description" defaultValue={part?.description || ""} rows={2} placeholder="Opsiyonel açıklama..." />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Stok Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="stockQty">Stok Miktarı</Label>
                <Input id="stockQty" name="stockQty" type="number" min="0" defaultValue={part?.stockQty ?? 0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="criticalStockQty">Kritik Stok Miktarı</Label>
                <Input id="criticalStockQty" name="criticalStockQty" type="number" min="0" defaultValue={part?.criticalStockQty ?? 0} />
              </div>
              <div className="space-y-2">
                <Label htmlFor="unit">Birim</Label>
                <Input id="unit" name="unit" defaultValue={part?.unit || "adet"} placeholder="adet, litre, kg..." />
              </div>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="shelfLocation">Raf / Lokasyon</Label>
                <Input id="shelfLocation" name="shelfLocation" defaultValue={part?.shelfLocation || ""} placeholder="A-01, B-12..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="barcode">Barkod</Label>
                <Input id="barcode" name="barcode" defaultValue={part?.barcode || ""} placeholder="Opsiyonel" />
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Fiyat Bilgileri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-2">
                <Label htmlFor="purchasePrice">Alış Fiyatı</Label>
                <Input id="purchasePrice" name="purchasePrice" type="number" min="0" step="0.01" defaultValue={part?.purchasePrice ?? ""} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="salePrice">Satış Fiyatı</Label>
                <Input id="salePrice" name="salePrice" type="number" min="0" step="0.01" defaultValue={part?.salePrice ?? ""} placeholder="0" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="currency">Para Birimi</Label>
                <select
                  id="currency"
                  name="currency"
                  defaultValue={part?.currency || "TRY"}
                  className="h-8 w-full rounded-lg border border-input bg-transparent px-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                >
                  <option value="TRY">₺ TRY</option>
                  <option value="USD">$ USD</option>
                  <option value="EUR">€ EUR</option>
                </select>
              </div>
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-sm font-semibold">Tedarikçi Bilgisi</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            <p className="text-[11px] text-slate-400">Tedarikçi bilgileri metin alanı olarak kaydedilir. Tam tedarikçi yönetimi sonraki sürümlerde eklenecektir.</p>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-2">
                <Label htmlFor="supplierName">Tedarikçi Adı</Label>
                <Input id="supplierName" name="supplierName" defaultValue={part?.supplierName || ""} placeholder="Tedarikçi adı..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="supplierPhone">Tedarikçi Telefonu</Label>
                <Input id="supplierPhone" name="supplierPhone" defaultValue={part?.supplierPhone || ""} placeholder="05XX XXX XX XX" />
              </div>
            </div>
          </CardContent>
        </Card>

        <div className="flex gap-3 pb-24 lg:pb-0">
          <Button type="submit" disabled={pending} className="flex-1 sm:flex-none">
            {pending ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : <Save className="size-3.5 mr-1" />}
            {isEdit ? "Güncelle" : "Parça Oluştur"}
          </Button>
          <Link href={isEdit ? `/app/parts/${part?.id}` : "/app/parts"}>
            <Button type="button" variant="outline">
              İptal
            </Button>
          </Link>
        </div>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-3 safe-area-bottom flex gap-2">
        <Button type="submit" disabled={pending} className="flex-1">
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          {isEdit ? "Güncelle" : "Parça Oluştur"}
        </Button>
        <Link href={isEdit ? `/app/parts/${part?.id}` : "/app/parts"} className="flex-1">
          <Button type="button" variant="outline" className="w-full">
            İptal
          </Button>
        </Link>
      </div>
    </form>
  )
}
