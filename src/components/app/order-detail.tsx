"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Trash2, Car, Wrench } from "lucide-react"
import { ORDER_STATUS } from "@/lib/constants"
import { formatTRY } from "@/lib/format"
import { formatOrderSummary, calculateLineTotal } from "@/lib/totals"

type OrderDetailProps = {
  id: string
  status: string
  createdAt: Date
  intakeForm: {
    id: string
    customer: { firstName: string; lastName: string; phone: string }
    vehicle: { plate: string; brand: string; model: string }
  }
  items: {
    id: string
    type: string
    name: string
    quantity: number
    unitPrice: number | null
    totalPrice: number | null
    note: string | null
  }[]
}

export function OrderDetail({ order }: { order: OrderDetailProps }) {
  const router = useRouter()
  const [showAddForm, setShowAddForm] = useState(false)
  const [itemType, setItemType] = useState("part")
  const [itemName, setItemName] = useState("")
  const [itemQty, setItemQty] = useState("1")
  const [itemPrice, setItemPrice] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const statusInfo = ORDER_STATUS[order.status as keyof typeof ORDER_STATUS]

  async function handleAddItem() {
    setLoading(true)
    setError("")
    const formData = new FormData()
    formData.set("serviceOrderId", order.id)
    formData.set("type", itemType)
    formData.set("name", itemName)
    formData.set("quantity", itemQty)
    if (itemPrice) formData.set("unitPrice", itemPrice)

    try {
      const res = await fetch("/api/orders/items", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setShowAddForm(false)
        setItemName("")
        setItemQty("1")
        setItemPrice("")
        router.refresh()
      } else {
        setError(data.error || "Kalem eklenemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  async function handleRemoveItem(itemId: string) {
    try {
      await fetch(`/api/orders/items?id=${itemId}&orderId=${order.id}`, { method: "DELETE" })
      router.refresh()
    } catch {}
  }

  async function handleStatusChange(newStatus: string) {
    setLoading(true)
    setError("")
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      } else {
        setError(data.error || "Durum güncellenemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  const summary = formatOrderSummary(order.items)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/app/orders")} className="p-2.5 hover:bg-muted rounded-xl touch-manipulation">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Servis Emri</h2>
            <span className={`text-xs px-2 py-1 rounded-full font-medium shrink-0 ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
              {statusInfo?.label || order.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground truncate">
            {order.intakeForm.vehicle.plate} - {order.intakeForm.customer.firstName} {order.intakeForm.customer.lastName}
          </p>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Status actions */}
      <div className="flex gap-2 overflow-x-auto pb-1">
        {order.status === "draft" && (
          <Button size="sm" onClick={() => handleStatusChange("in_progress")} disabled={loading}>
            İşleme Başla
          </Button>
        )}
        {order.status === "in_progress" && (
          <Button size="sm" onClick={() => handleStatusChange("ready_for_delivery")} disabled={loading}>
            Teslimata Hazır
          </Button>
        )}
        {order.status === "ready_for_delivery" && (
          <Button size="sm" onClick={() => handleStatusChange("delivered")} disabled={loading}>
            Teslim Edildi
          </Button>
        )}
      </div>

      {/* Items */}
      <Card>
        <CardHeader className="pb-3">
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Kalemler</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="size-4 mr-1" /> Kalem Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {order.items.length === 0 ? (
            <div className="text-center py-8">
              <Wrench className="size-12 mx-auto mb-3 opacity-15" />
              <p className="text-sm text-muted-foreground">Henüz kalem eklenmedi</p>
            </div>
          ) : (
            <div className="space-y-3">
              {/* Part items */}
              {order.items.filter((i) => i.type === "part").length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">Parçalar</p>
                  {order.items
                    .filter((i) => i.type === "part")
                    .map((item) => {
                      return (
                        <ItemRow key={item.id} item={item} lineTotal={calculateLineTotal(item)} onRemove={handleRemoveItem} />
                      )
                    })}
                </div>
              )}

              {/* Labor items */}
              {order.items.filter((i) => i.type === "labor").length > 0 && (
                <div>
                  <p className="text-xs font-medium text-muted-foreground mb-2">İşçilik</p>
                  {order.items
                    .filter((i) => i.type === "labor")
                    .map((item) => {
                      return (
                        <ItemRow key={item.id} item={item} lineTotal={calculateLineTotal(item)} onRemove={handleRemoveItem} />
                      )
                    })}
                </div>
              )}

              {/* Summary */}
              <div className="border-t pt-3 space-y-1.5 text-sm">
                {summary.partsCount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>Parça Toplamı</span>
                    <span>{summary.partsTotal}</span>
                  </div>
                )}
                {summary.laborCount > 0 && (
                  <div className="flex justify-between text-muted-foreground">
                    <span>İşçilik Toplamı</span>
                    <span>{summary.laborTotal}</span>
                  </div>
                )}
                {summary.hasAnyPrice && (
                  <div className="flex justify-between pt-2 border-t font-bold text-base">
                    <span>Genel Toplam</span>
                    <span>{summary.grandTotal}</span>
                  </div>
                )}
              </div>
            </div>
          )}
        </CardContent>
      </Card>

      {showAddForm && (
        <Card>
          <CardHeader className="pb-3"><CardTitle className="text-base">Yeni Kalem Ekle</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Tip</Label>
              <select
                className="w-full h-10 rounded-lg border border-input bg-transparent px-3 py-2 text-sm"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
              >
                <option value="part">Parça</option>
                <option value="labor">İşçilik</option>
              </select>
            </div>
            <div>
              <Label>Kalem Adı</Label>
              <Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Fren balatası, Yağ değişimi..." />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <Label>Miktar</Label>
                <Input type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} min="1" />
              </div>
              <div>
                <Label>Birim Fiyat (TL)</Label>
                <Input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="0" min="0" step="0.01" />
              </div>
            </div>
            <div className="flex gap-2 pt-2">
              <Button onClick={handleAddItem} disabled={loading || !itemName} size="lg" className="flex-1 h-12">Ekle</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)} size="lg" className="h-12">İptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader className="pb-3"><CardTitle className="text-base">İlgili Araç Kabulü</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push(`/app/intakes/${order.intakeForm.id}`)} size="lg" className="w-full h-12">
            <Car className="size-4 mr-2" /> Kabul Detayına Git
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}

function ItemRow({
  item,
  lineTotal,
  onRemove,
}: {
  item: { id: string; type: string; name: string; quantity: number; unitPrice: number | null; totalPrice: number | null; note: string | null }
  lineTotal: number | null
  onRemove: (id: string) => void
}) {
  return (
    <div className="flex items-center justify-between p-3 bg-muted/50 rounded-lg">
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="text-sm font-medium truncate">{item.name}</span>
          <span className={`text-xs px-1.5 py-0.5 rounded-full shrink-0 ${item.type === "part" ? "bg-blue-100 text-blue-700" : "bg-purple-100 text-purple-700"}`}>
            {item.type === "part" ? "Parça" : "İşçilik"}
          </span>
        </div>
        <div className="text-xs text-muted-foreground mt-1">
          {item.quantity} adet {item.unitPrice ? `× ${formatTRY(item.unitPrice)}` : ""}
          {item.note && ` • ${item.note}`}
        </div>
      </div>
      <div className="text-right shrink-0 ml-3">
        <span className={`text-sm font-medium ${lineTotal == null ? "text-gray-400 italic text-xs" : ""}`}>
          {lineTotal != null ? formatTRY(lineTotal) : "Fiyat girilmedi"}
        </span>
        <button onClick={() => onRemove(item.id)} className="block text-destructive text-xs hover:underline mt-0.5 ml-auto">
          <Trash2 className="size-3" />
        </button>
      </div>
    </div>
  )
}
