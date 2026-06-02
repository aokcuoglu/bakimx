"use client"

import { useState, useCallback, useEffect, useActionState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"
import { Label } from "@/components/ui/label"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Plus, Trash2, Loader2, Calculator } from "lucide-react"
import { cn } from "@/lib/utils"
import { createQuoteAction } from "@/app/app/quotes/actions"
import { customerDisplayName } from "@/lib/format"
import { formatTRY } from "@/lib/format"

type Customer = {
  id: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  type: string
  phone: string
}

type Vehicle = {
  id: string
  plate: string
  brand: string
  model: string
}

type LineItem = {
  id: string
  type: "part" | "labor"
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  note: string
}

type ActionState = {
  error?: string
  success?: boolean
  id?: string
}

let itemCounter = 0
function newItemId() {
  itemCounter += 1
  return `item_${itemCounter}`
}

export function QuoteCreateForm() {
  const router = useRouter()
  const wrappedAction = async (_prev: ActionState | null, formData: FormData): Promise<ActionState | null> => {
    return createQuoteAction(formData) as unknown as Promise<ActionState | null>
  }
  const [state, formAction, pending] = useActionState(wrappedAction, null as ActionState | null)
  const [customers, setCustomers] = useState<Customer[]>([])
  const [customerSearch, setCustomerSearch] = useState("")
  const [customerSearchOpen, setCustomerSearchOpen] = useState(false)
  const [selectedCustomerId, setSelectedCustomerId] = useState("")
  const [vehicles, setVehicles] = useState<Vehicle[]>([])
  const [selectedVehicleId, setSelectedVehicleId] = useState("")
  const [customerLoading, setCustomerLoading] = useState(false)
  const [vehicleLoading, setVehicleLoading] = useState(false)
  const [discountAmount, setDiscountAmount] = useState("")
  const [taxRate, setTaxRate] = useState("20")
  const [items, setItems] = useState<LineItem[]>([])

  useEffect(() => {
    if (state?.success && state.id) {
      router.push(`/app/quotes/${state.id}`)
    }
  }, [state, router])

  const fetchCustomers = useCallback(async (search: string) => {
    setCustomerLoading(true)
    try {
      const res = await fetch(`/api/customers?q=${encodeURIComponent(search)}&limit=20`)
      const data = await res.json()
      if (data.customers) setCustomers(data.customers)
    } catch {
      // ignore
    } finally {
      setCustomerLoading(false)
    }
  }, [])

  const fetchVehicles = useCallback(async (customerId: string) => {
    setVehicleLoading(true)
    setSelectedVehicleId("")
    try {
      const res = await fetch(`/api/customers/${customerId}/vehicles`)
      const data = await res.json()
      if (data.vehicles) setVehicles(data.vehicles)
      else setVehicles([])
    } catch {
      setVehicles([])
    } finally {
      setVehicleLoading(false)
    }
  }, [])

  function handleCustomerSelect(id: string) {
    setSelectedCustomerId(id)
    setCustomerSearch("")
    setCustomerSearchOpen(false)
    const c = customers.find((c) => c.id === id)
    if (c) setCustomerSearch(customerDisplayName(c))
    fetchVehicles(id)
  }

  function handleCustomerSearchChange(value: string) {
    setCustomerSearch(value)
    setCustomerSearchOpen(true)
    if (value.length >= 1) fetchCustomers(value)
    else setCustomers([])
  }

  function addItem() {
    setItems((prev) => [
      ...prev,
      { id: newItemId(), type: "part", name: "", quantity: 1, unitPrice: null, totalPrice: null, note: "" },
    ])
  }

  function removeItem(id: string) {
    setItems((prev) => prev.filter((i) => i.id !== id))
  }

  function updateItem(id: string, field: keyof LineItem, value: unknown) {
    setItems((prev) =>
      prev.map((i) => {
        if (i.id !== id) return i
        const updated = { ...i, [field]: value }
        if (field === "quantity" || field === "unitPrice") {
          const qty = field === "quantity" ? Number(value) : i.quantity
          const price = field === "unitPrice" ? Number(value) : i.unitPrice
          if (qty > 0 && price != null && price > 0) {
            updated.totalPrice = qty * price
          } else {
            updated.totalPrice = null
          }
        }
        return updated
      })
    )
  }

  const partsTotal = items
    .filter((i) => i.type === "part")
    .reduce((sum, i) => sum + (i.totalPrice ?? 0), 0)
  const laborTotal = items
    .filter((i) => i.type === "labor")
    .reduce((sum, i) => sum + (i.totalPrice ?? 0), 0)
  const subtotal = partsTotal + laborTotal
  const discount = Math.max(0, Number(discountAmount) || 0)
  const afterDiscount = Math.max(0, subtotal - discount)
  const tax = (afterDiscount * (Number(taxRate) || 0)) / 100
  const grandTotal = afterDiscount + tax

  const itemsJson = JSON.stringify(
    items
      .filter((i) => i.name.trim())
      .map((i) => ({
        type: i.type,
        name: i.name,
        quantity: i.quantity,
        unitPrice: i.unitPrice != null && i.unitPrice > 0 ? i.unitPrice : undefined,
        totalPrice: i.totalPrice != null && i.totalPrice > 0 ? i.totalPrice : undefined,
        note: i.note || undefined,
      }))
  )

  return (
    <form action={formAction}>
      <input type="hidden" name="customerId" value={selectedCustomerId} />
      <input type="hidden" name="vehicleId" value={selectedVehicleId} />
      <input type="hidden" name="discountAmount" value={discountAmount || "0"} />
      <input type="hidden" name="taxRate" value={taxRate || "0"} />
      <input type="hidden" name="estimatedPartsTotal" value={String(partsTotal)} />
      <input type="hidden" name="estimatedLaborTotal" value={String(laborTotal)} />
      <input type="hidden" name="grandTotal" value={String(grandTotal)} />
      <input type="hidden" name="items" value={itemsJson} />
      {state?.error && (
        <div className="mb-5 p-3 rounded-lg bg-destructive/10 text-destructive text-sm">{state.error}</div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Müşteri & Araç</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="customerSearch">Müşteri *</Label>
                <div className="relative">
                  <Input
                    id="customerSearch"
                    value={customerSearch}
                    onChange={(e) => handleCustomerSearchChange(e.target.value)}
                    onFocus={() => {
                      if (customers.length === 0 && customerSearch.length < 1) {
                        fetchCustomers("")
                      }
                      setCustomerSearchOpen(true)
                    }}
                    placeholder="Müşteri adı, telefon veya plaka ile ara..."
                    autoComplete="off"
                  />
                  {customerSearchOpen && (
                    <div className="absolute left-0 right-0 top-full mt-1 z-20 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-lg">
                      {customerLoading ? (
                        <div className="flex items-center justify-center py-3">
                          <Loader2 className="size-4 animate-spin text-slate-400" />
                        </div>
                      ) : customers.length === 0 ? (
                        <div className="px-3 py-2 text-xs text-slate-500">Müşteri bulunamadı</div>
                      ) : (
                        customers.map((c) => (
                          <button
                            key={c.id}
                            type="button"
                            onClick={() => handleCustomerSelect(c.id)}
                            className="w-full text-left px-3 py-2 text-sm hover:bg-slate-50 transition-colors touch-manipulation"
                          >
                            <span className="font-medium text-slate-900">{customerDisplayName(c)}</span>
                            <span className="text-slate-500 ml-2">{c.phone}</span>
                          </button>
                        ))
                      )}
                    </div>
                  )}
                </div>
              </div>

              <div className="space-y-2">
                <Label htmlFor="vehicleId">Araç</Label>
                <Select value={selectedVehicleId} onValueChange={(v) => setSelectedVehicleId(v || "")}>
                  <SelectTrigger className="w-full">
                    <SelectValue placeholder={vehicleLoading ? "Yükleniyor..." : "Araç seçin (isteğe bağlı)"} />
                  </SelectTrigger>
                  <SelectContent>
                    {vehicles.map((v) => (
                      <SelectItem key={v.id} value={v.id}>
                        {v.plate} — {v.brand} {v.model}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="flex items-center gap-3 text-xs">
                <Link href="/app/customers/new" className="text-blue-600 hover:text-blue-700 font-medium">
                  + Yeni Müşteri
                </Link>
                {selectedCustomerId && (
                  <Link href={`/app/vehicles/new?customerId=${selectedCustomerId}`} className="text-blue-600 hover:text-blue-700 font-medium">
                    + Yeni Araç
                  </Link>
                )}
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-sm font-semibold">Teklif Bilgileri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <div className="space-y-2">
                <Label htmlFor="title">Teklif Başlığı</Label>
                <Input id="title" name="title" placeholder="Örn: Periyodik Bakım Teklifi" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="customerRequest">Müşteri Talebi</Label>
                <Textarea id="customerRequest" name="customerRequest" rows={3} placeholder="Müşterinin belirttiği istek veya şikayetler..." />
              </div>
              <div className="space-y-2">
                <Label htmlFor="validUntil">Geçerlilik Tarihi</Label>
                <Input id="validUntil" name="validUntil" type="date" />
              </div>
              <div className="space-y-2">
                <Label htmlFor="internalNote">İç Not</Label>
                <Textarea id="internalNote" name="internalNote" rows={2} placeholder="İç kullanım notu (müşteriye gösterilmez)..." />
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Parça & İşçilik Kalemleri</CardTitle>
                <Button type="button" size="sm" variant="outline" onClick={addItem} className="gap-1">
                  <Plus className="size-3.5" />
                  Kalem Ekle
                </Button>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {items.length === 0 && (
                <div className="text-center py-6 text-sm text-slate-500">
                  Henüz kalem eklenmedi. &quot;Kalem Ekle&quot; butonuna tıklayarak başlayın.
                </div>
              )}
              {items.map((item) => (
                <div key={item.id} className="rounded-lg border border-slate-200 bg-slate-50/50 p-3 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 flex-1">
                      <select
                        value={item.type}
                        onChange={(e) => updateItem(item.id, "type", e.target.value)}
                        className="h-8 rounded-md border border-slate-200 bg-white px-2 text-xs font-medium focus:outline-none focus:ring-2 focus:ring-blue-500/30"
                      >
                        <option value="part">Parça</option>
                        <option value="labor">İşçilik</option>
                      </select>
                      <span className="text-[11px] text-slate-400 font-mono">{item.id}</span>
                    </div>
                    <button
                      type="button"
                      onClick={() => removeItem(item.id)}
                      className="p-1 text-slate-400 hover:text-rose-600 hover:bg-rose-50 rounded transition-colors"
                      aria-label="Kalemi sil"
                    >
                      <Trash2 className="size-3.5" />
                    </button>
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                    <div className="sm:col-span-2">
                      <Label className="text-[11px] text-slate-500">Ad</Label>
                      <Input
                        value={item.name}
                        onChange={(e) => updateItem(item.id, "name", e.target.value)}
                        placeholder={item.type === "part" ? "Fren balatası..." : "Yağ değişimi..."}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-500">Miktar</Label>
                      <Input
                        type="number"
                        min="1"
                        value={item.quantity}
                        onChange={(e) => updateItem(item.id, "quantity", Number(e.target.value) || 1)}
                        className="h-8 text-sm"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-500">Birim Fiyat ₺</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.unitPrice ?? ""}
                        onChange={(e) => updateItem(item.id, "unitPrice", e.target.value ? Number(e.target.value) : null)}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </div>
                    <div>
                      <Label className="text-[11px] text-slate-500">Tutar ₺</Label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        value={item.totalPrice ?? ""}
                        onChange={(e) => updateItem(item.id, "totalPrice", e.target.value ? Number(e.target.value) : null)}
                        className="h-8 text-sm"
                        placeholder="0"
                      />
                    </div>
                  </div>
                  <div>
                    <Label className="text-[11px] text-slate-500">Not</Label>
                    <Input
                      value={item.note}
                      onChange={(e) => updateItem(item.id, "note", e.target.value)}
                      placeholder="Opsiyonel not..."
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
              ))}
            </CardContent>
          </Card>
        </div>

        <aside className="space-y-5">
          <div className="lg:sticky lg:top-24">
            <Card>
              <CardHeader>
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Calculator className="size-4 text-slate-500" />
                  Fiyat Özeti
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                <SummaryRow label="Parça Toplamı" value={partsTotal > 0 ? formatTRY(partsTotal) : "—"} muted={partsTotal === 0} />
                <SummaryRow label="İşçilik Toplamı" value={laborTotal > 0 ? formatTRY(laborTotal) : "—"} muted={laborTotal === 0} />
                <div className="pt-2 border-t" />
                <div className="space-y-2">
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">İndirim (₺)</Label>
                    <Input
                      type="number"
                      min="0"
                      step="0.01"
                      value={discountAmount}
                      onChange={(e) => setDiscountAmount(e.target.value)}
                      placeholder="0"
                      className="h-8 text-sm"
                    />
                  </div>
                  <div className="space-y-1">
                    <Label className="text-[11px] text-slate-500">KDV Oranı (%)</Label>
                    <Input
                      type="number"
                      min="0"
                      max="100"
                      step="0.1"
                      value={taxRate}
                      onChange={(e) => setTaxRate(e.target.value)}
                      placeholder="20"
                      className="h-8 text-sm"
                    />
                  </div>
                </div>
                <SummaryRow label="İndirim" value={discount > 0 ? `-${formatTRY(discount)}` : "—"} muted={discount === 0} />
                <SummaryRow label={`KDV (%${Number(taxRate) || 0})`} value={tax > 0 ? formatTRY(tax) : "—"} muted={tax === 0} />
                <div className="border-t pt-2 mt-2">
                  <SummaryRow label="Genel Toplam" value={subtotal > 0 ? formatTRY(grandTotal) : "—"} bold large />
                </div>
              </CardContent>
            </Card>

            <div className="hidden lg:flex flex-col gap-2 mt-5">
              <Button type="submit" name="status" value="sent" disabled={pending} className="gap-2 w-full" onClick={(e) => { if (!selectedCustomerId) { e.preventDefault(); return } }}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Teklif Kaydet
              </Button>
              <Button type="submit" name="status" value="draft" variant="outline" disabled={pending} className="gap-2 w-full" onClick={(e) => { if (!selectedCustomerId) { e.preventDefault(); return } }}>
                {pending ? <Loader2 className="size-4 animate-spin" /> : null}
                Taslak Kaydet
              </Button>
              <Button type="button" variant="ghost" onClick={() => router.back()} disabled={pending} className="w-full">
                İptal
              </Button>
            </div>
          </div>
        </aside>
      </div>

      <div className="lg:hidden fixed bottom-0 left-0 right-0 z-40 bg-white border-t border-slate-200 p-3 safe-area-bottom flex gap-2">
        <Button type="submit" name="status" value="sent" disabled={pending} className="flex-1 gap-2" onClick={(e) => { if (!selectedCustomerId) { e.preventDefault(); return } }}>
          {pending ? <Loader2 className="size-4 animate-spin" /> : null}
          Kaydet
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={pending} className="flex-1">
          İptal
        </Button>
      </div>
    </form>
  )
}

function SummaryRow({
  label,
  value,
  bold,
  large,
  muted,
}: {
  label: string
  value: string
  bold?: boolean
  large?: boolean
  muted?: boolean
}) {
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-slate-600", bold && "text-slate-900")}>{label}</span>
      <span className={cn(muted ? "text-slate-400" : "text-slate-900", large && "text-lg font-bold text-slate-900")}>
        {value}
      </span>
    </div>
  )
}
