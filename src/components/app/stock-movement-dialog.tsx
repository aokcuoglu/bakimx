"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { createStockMovementAction } from "@/app/(app)/parts/actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Loader2, Package } from "lucide-react"

export function StockMovementDialog({
  partId,
  partName,
  currentStock,
  unit,
  onClose,
}: {
  partId: string
  partName: string
  currentStock: number
  unit: string
  onClose: () => void
}) {
  const [type, setType] = useState<"in" | "out" | "adjustment">("in")
  const [quantity, setQuantity] = useState("")
  const [reason, setReason] = useState("")
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!quantity || Number(quantity) < 1) {
      setError("Geçerli bir miktar giriniz")
      return
    }
    if (type === "out" && Number(quantity) > currentStock) {
      setError(`Yetersiz stok. Mevcut: ${currentStock} ${unit}`)
      return
    }

    setLoading(true)
    setError("")

    const formData = new FormData()
    formData.set("partId", partId)
    formData.set("type", type)
    formData.set("quantity", quantity)
    formData.set("reason", reason)

    const res = await createStockMovementAction(formData) as { error?: string }
    if (res?.error) {
      setError(res.error)
      setLoading(false)
    } else {
      onClose()
    }
  }

  return (
    <Dialog defaultOpen onOpenChange={(open) => { if (!open) onClose() }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Package className="size-4 text-primary" />
            Stok Hareketi
          </DialogTitle>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <p className="text-sm text-foreground">
            <strong>{partName}</strong>
            <span className="block text-xs text-muted-foreground">Mevcut Stok: {currentStock} {unit}</span>
          </p>

          {error && (
            <div className="p-2.5 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-xs">{error}</div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Hareket Tipi</Label>
            <ToggleGroup value={[type]} onValueChange={(v) => { if (v.length) { setType(v[0] as "in" | "out" | "adjustment"); setError("") } }} variant="outline" className="w-full">
              <ToggleGroupItem value="in" className="flex-1">Giriş</ToggleGroupItem>
              <ToggleGroupItem value="out" className="flex-1">Çıkış</ToggleGroupItem>
              <ToggleGroupItem value="adjustment" className="flex-1">Düzeltme</ToggleGroupItem>
            </ToggleGroup>
            <p className="text-[11px] text-muted-foreground/70">
              {type === "in" ? "Stoğa ekleme yapar" : type === "out" ? "Stoktan düşüş yapar" : "Stok miktarını doğrudan belirlediğiniz değere ayarlar"}
            </p>
          </div>

          <div className="space-y-2">
            <Label className="text-xs">
              {type === "adjustment" ? "Yeni Stok Miktarı" : "Miktar"}
            </Label>
            <Input
              type="number"
              min="1"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder={type === "adjustment" ? "Yeni stok miktarı..." : "Miktar..."}
              required
            />
          </div>

          <div className="space-y-2">
            <Label className="text-xs">Sebep / Not</Label>
            <Input
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Opsiyonel sebep..."
            />
          </div>

          <div className="flex gap-2 pt-2">
            <Button type="submit" disabled={loading} className="flex-1">
              {loading ? <Loader2 className="size-3.5 mr-1 animate-spin" /> : null}
              {type === "in" ? "Giriş Yap" : type === "out" ? "Çıkış Yap" : "Düzelt"}
            </Button>
            <Button type="button" variant="outline" onClick={onClose} className="flex-1">
              İptal
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
