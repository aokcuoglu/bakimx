"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ArrowLeft, Plus, Trash2, Car } from "lucide-react"
import { ORDER_STATUS } from "@/lib/constants"

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

  const total = order.items.reduce((sum, item) => {
    if (item.totalPrice) return sum + item.totalPrice
    if (item.unitPrice) return sum + item.unitPrice * item.quantity
    return sum
  }, 0)

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <button onClick={() => router.push("/app/orders")} className="p-2 hover:bg-muted rounded-lg">
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1">
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold">Servis Emri</h2>
            <span className={`text-xs px-2 py-1 rounded-full ${statusInfo?.color || "bg-gray-100 text-gray-800"}`}>
              {statusInfo?.label || order.status}
            </span>
          </div>
          <p className="text-sm text-muted-foreground">
            {order.intakeForm.vehicle.plate} - {order.intakeForm.customer.firstName} {order.intakeForm.customer.lastName}
          </p>
        </div>
      </div>

      {error && <div className="p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{error}</div>}

      {/* Status actions */}
      <div className="flex gap-2">
        {order.status === "draft" && (
          <Button size="sm" onClick={() => handleStatusChange("in_progress")} disabled={loading}>
            İşleme Başla
          </Button>
        )}
        {order.status === "in_progress" && (
          <Button size="sm" onClick={() => handleStatusChange("ready_for_delivery")} disabled={loading}>
            Teslimat için Hazır
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
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="text-base">Kalemler</CardTitle>
            <Button variant="outline" size="sm" onClick={() => setShowAddForm(true)}>
              <Plus className="size-4 mr-1" /> Kalem Ekle
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {order.items.length === 0 ? (
            <p className="text-sm text-muted-foreground text-center py-4">Henüz kalem eklenmedi</p>
          ) : (
            <div className="space-y-2">
              {order.items.map((item) => (
                <div key={item.id} className="flex items-center justify-between p-2 bg-muted/50 rounded-lg">
                  <div>
                    <span className="text-sm font-medium">{item.name}</span>
                    <span className="text-xs text-muted-foreground ml-2">
                      {item.type === "part" ? "Parça" : "İşçilik"} x{item.quantity}
                    </span>
                    {item.note && <span className="text-xs text-muted-foreground ml-2">- {item.note}</span>}
                  </div>
                  <div className="flex items-center gap-2">
                    {item.unitPrice && (
                      <span className="text-sm">{(item.unitPrice * item.quantity).toLocaleString("tr-TR")} TL</span>
                    )}
                    <button onClick={() => handleRemoveItem(item.id)} className="text-destructive hover:underline text-xs">
                      <Trash2 className="size-3" />
                    </button>
                  </div>
                </div>
              ))}
              {total > 0 && (
                <div className="flex justify-between pt-2 border-t text-sm font-medium">
                  <span>Toplam</span>
                  <span>{total.toLocaleString("tr-TR")} TL</span>
                </div>
              )}
            </div>
          )}
        </CardContent>
      </Card>

      {showAddForm && (
        <Card>
          <CardHeader><CardTitle className="text-base">Yeni Kalem</CardTitle></CardHeader>
          <CardContent className="space-y-3">
            <div>
              <Label>Tip</Label>
              <select
                className="w-full h-8 rounded-lg border border-input bg-transparent px-2.5 py-1 text-sm"
                value={itemType}
                onChange={(e) => setItemType(e.target.value)}
              >
                <option value="part">Parça</option>
                <option value="labor">İşçilik</option>
              </select>
            </div>
            <div><Label>Ad</Label><Input value={itemName} onChange={(e) => setItemName(e.target.value)} placeholder="Fren balatası" /></div>
            <div><Label>Miktar</Label><Input type="number" value={itemQty} onChange={(e) => setItemQty(e.target.value)} /></div>
            <div><Label>Birim Fiyat (TL)</Label><Input type="number" value={itemPrice} onChange={(e) => setItemPrice(e.target.value)} placeholder="0" /></div>
            <div className="flex gap-2">
              <Button onClick={handleAddItem} disabled={loading || !itemName}>Ekle</Button>
              <Button variant="outline" onClick={() => setShowAddForm(false)}>İptal</Button>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader><CardTitle className="text-base">İlgili Araç Kabulü</CardTitle></CardHeader>
        <CardContent>
          <Button variant="outline" onClick={() => router.push(`/app/intakes/${order.intakeForm.id}`)}>
            <Car className="size-4 mr-2" /> Kabul Detayına Git
          </Button>
        </CardContent>
      </Card>
    </div>
  )
}