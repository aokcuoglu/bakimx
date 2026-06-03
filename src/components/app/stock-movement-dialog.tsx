"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { createStockMovementAction } from "@/app/app/parts/actions"
import { Loader2, X, Package } from "lucide-react"

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
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
      <div className="w-full max-w-md rounded-xl bg-white shadow-xl">
        <div className="flex items-center justify-between p-4 border-b border-slate-200">
          <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
            <Package className="size-4 text-blue-600" />
            Stok Hareketi
          </h3>
          <button onClick={onClose} className="p-1 text-slate-400 hover:text-slate-600 rounded-md" aria-label="Kapat">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-4 space-y-4">
          <p className="text-sm text-slate-700">
            <strong>{partName}</strong>
            <span className="block text-xs text-slate-500">Mevcut Stok: {currentStock} {unit}</span>
          </p>

          {error && (
            <div className="p-2.5 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-xs">{error}</div>
          )}

          <div className="space-y-2">
            <Label className="text-xs">Hareket Tipi</Label>
            <div className="flex gap-2">
              {(["in", "out", "adjustment"] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => { setType(t); setError("") }}
                  className={`flex-1 py-2 px-3 rounded-lg border text-xs font-medium transition-colors ${
                    type === t
                      ? t === "in"
                        ? "bg-emerald-50 border-emerald-300 text-emerald-700"
                        : t === "out"
                          ? "bg-red-50 border-red-300 text-red-700"
                          : "bg-amber-50 border-amber-300 text-amber-700"
                      : "bg-white border-slate-200 text-slate-600 hover:bg-slate-50"
                  }`}
                >
                  {t === "in" ? "Giriş" : t === "out" ? "Çıkış" : "Düzeltme"}
                </button>
              ))}
            </div>
            <p className="text-[11px] text-slate-400">
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
      </div>
    </div>
  )
}
