"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { PaymentBadge } from "@/components/app/status-badge"
import { computePaymentStatus } from "@/lib/cashbox/status"
import { formatTRY } from "@/lib/format"
import {
  ArrowLeft,
  Loader2,
  Info,
  Wallet,
  CreditCard,
  Building2,
  CircleDot,
  Calculator,
  Check,
  AlertTriangle,
} from "lucide-react"
import { cn } from "@/lib/utils"

type CustomerOption = {
  id: string
  type: string
  firstName: string | null
  lastName: string | null
  fullName: string | null
  companyName: string | null
  phone: string
}

type OrderOption = {
  id: string
  workOrderNo: string | null
  status: string
  paymentStatus: string
  grandTotal: number
  paidAmount: number
  remainingAmount: number
  vehicle: { plate: string; brand: string; model: string }
}

type Props = {
  customers: CustomerOption[]
  orders: OrderOption[]
  preselectedCustomerId?: string
  preselectedOrderId?: string
}

const METHODS = [
  { key: "cash", label: "Nakit", icon: Wallet },
  { key: "credit_card", label: "Kredi Kartı", icon: CreditCard },
  { key: "bank_transfer", label: "Havale/EFT", icon: Building2 },
  { key: "other", label: "Diğer", icon: CircleDot },
] as const

function nameFor(c: CustomerOption) {
  if (c.type === "corporate") return c.companyName || "—"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"
}

export function CollectionCreateForm({ customers, orders, preselectedCustomerId, preselectedOrderId }: Props) {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState("")

  const [customerId, setCustomerId] = useState(preselectedCustomerId || "")
  const [serviceOrderId, setServiceOrderId] = useState(preselectedOrderId || "")
  const [amount, setAmount] = useState("")
  const [method, setMethod] = useState("cash")
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 16))
  const [referenceNo, setReferenceNo] = useState("")
  const [note, setNote] = useState("")
  const [customerSearch, setCustomerSearch] = useState("")

  const selectedCustomer = useMemo(() => customers.find((c) => c.id === customerId), [customers, customerId])

  const filteredCustomers = useMemo(() => {
    if (!customerSearch.trim()) return customers.slice(0, 20)
    const q = customerSearch.toLowerCase()
    return customers.filter((c) =>
      nameFor(c).toLowerCase().includes(q) || c.phone.includes(q)
    ).slice(0, 20)
  }, [customers, customerSearch])

  const filteredOrders = useMemo(() => {
    if (!customerId) return []
    return orders.filter((o) => o.remainingAmount > 0 || o.paymentStatus === "unpaid")
  }, [orders, customerId])

  const selectedOrder = useMemo(() => {
    if (!serviceOrderId) return null
    return orders.find((o) => o.id === serviceOrderId) || null
  }, [orders, serviceOrderId])

  const amountNum = parseFloat(amount) || 0
  const orderTotal = selectedOrder?.grandTotal || 0
  const previousPaid = selectedOrder?.paidAmount || 0
  const remaining = selectedOrder ? Math.max(0, orderTotal - previousPaid) : 0
  const newRemaining = selectedOrder ? Math.max(0, orderTotal - previousPaid - amountNum) : 0
  const projectedStatus = selectedOrder ? computePaymentStatus(orderTotal, previousPaid + amountNum) : null
  const isOverpayment = selectedOrder && amountNum > remaining && remaining > 0

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!customerId) { setError("Müşteri seçimi zorunludur"); return }
    if (amountNum <= 0) { setError("Tutar sıfırdan büyük olmalıdır"); return }
    if (!paymentDate) { setError("Tahsilat tarihi zorunludur"); return }

    setLoading(true)
    setError("")

    const formData = new FormData()
    formData.set("customerId", customerId)
    formData.set("serviceOrderId", serviceOrderId)
    formData.set("amount", amount)
    formData.set("method", method)
    formData.set("paymentDate", new Date(paymentDate).toISOString())
    formData.set("referenceNo", referenceNo)
    formData.set("note", note)

    try {
      const res = await fetch("/api/cashbox/collections", { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        router.push("/app/cashbox/payments")
        router.refresh()
      } else {
        setError(data.error || "Tahsilat kaydedilemedi")
      }
    } catch {
      setError("Bir hata oluştu")
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-slate-500">
        <button onClick={() => router.push("/app/cashbox/payments")} className="hover:text-slate-700 inline-flex items-center gap-1 touch-manipulation">
          <ArrowLeft className="size-3.5" />
          Tahsilatlar
        </button>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-medium">Yeni Tahsilat</span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
          <AlertTriangle className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base">Müşteri & İş Emri</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-600">Müşteri *</Label>
                <div className="mt-1.5 relative">
                  <input
                    type="text"
                    value={customerSearch}
                    onChange={(e) => {
                      setCustomerSearch(e.target.value)
                      if (!e.target.value) setCustomerId("")
                    }}
                    placeholder={selectedCustomer ? nameFor(selectedCustomer) : "Müşteri ara (ad, telefon)…"}
                    className="w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  />
                </div>
                {customerSearch && !customerId && (
                  <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-slate-200 bg-white shadow-sm">
                    {filteredCustomers.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-slate-500">Sonuç bulunamadı</div>
                    ) : (
                      filteredCustomers.map((c) => (
                        <button
                          key={c.id}
                          type="button"
                          onClick={() => { setCustomerId(c.id); setCustomerSearch(""); setServiceOrderId("") }}
                          className="w-full text-left px-3 py-2.5 text-sm hover:bg-slate-50 border-b border-slate-100 last:border-0 flex items-center justify-between"
                        >
                          <div>
                            <span className="font-medium text-slate-900">{nameFor(c)}</span>
                            <span className="text-slate-500 ml-2">{c.phone}</span>
                          </div>
                        </button>
                      ))
                    )}
                  </div>
                )}
                {selectedCustomer && (
                  <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-blue-50 border border-blue-200 text-sm">
                    <span className="font-medium text-blue-900">{nameFor(selectedCustomer)}</span>
                    <span className="text-blue-600">{selectedCustomer.phone}</span>
                    <button type="button" onClick={() => { setCustomerId(""); setServiceOrderId("") }} className="ml-auto text-blue-400 hover:text-blue-600 text-xs">Değiştir</button>
                  </div>
                )}
              </div>

              {customerId && (
                <div>
                  <Label className="text-xs font-medium text-slate-600">İş Emri (opsiyonel)</Label>
                  <select
                    value={serviceOrderId}
                    onChange={(e) => setServiceOrderId(e.target.value)}
                    className="mt-1.5 w-full h-10 px-3 rounded-lg border border-slate-200 bg-white text-sm focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
                  >
                    <option value="">İş emri seçin (opsiyonel)</option>
                    {filteredOrders.map((o) => (
                      <option key={o.id} value={o.id}>
                        {o.workOrderNo || "—"} &bull; {o.vehicle.plate} &bull; Kalan: {formatTRY(o.remainingAmount)}
                      </option>
                    ))}
                  </select>
                </div>
              )}

              {selectedOrder && (
                <div className="p-3 rounded-lg bg-slate-50 border border-slate-200 space-y-1.5 text-sm">
                  <div className="flex justify-between">
                    <span className="text-slate-500">İş No</span>
                    <span className="font-mono font-medium text-slate-900">{selectedOrder.workOrderNo || "—"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Plaka / Araç</span>
                    <span className="font-medium text-slate-900">{selectedOrder.vehicle.plate} &bull; {selectedOrder.vehicle.brand} {selectedOrder.vehicle.model}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Genel Toplam</span>
                    <span className="font-semibold text-slate-900">{formatTRY(selectedOrder.grandTotal)}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500">Daha Önce Tahsil Edilen</span>
                    <span className="font-semibold text-emerald-700">{formatTRY(selectedOrder.paidAmount)}</span>
                  </div>
                  <div className="flex justify-between border-t border-slate-200 pt-1.5">
                    <span className="text-slate-500 font-medium">Kalan Bakiye</span>
                    <span className={cn("font-bold", remaining > 0 ? "text-rose-700" : "text-slate-900")}>{formatTRY(remaining)}</span>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Wallet className="size-4 text-slate-500" />
                Tahsilat Bilgileri
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label className="text-xs font-medium text-slate-600">Tutar (₺) *</Label>
                <Input
                  type="number"
                  min="0.01"
                  step="0.01"
                  value={amount}
                  onChange={(e) => setAmount(e.target.value)}
                  placeholder="0.00"
                  className="mt-1.5 text-lg font-semibold"
                />
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-600">Ödeme Yöntemi *</Label>
                <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {METHODS.map((m) => {
                    const Icon = m.icon
                    return (
                      <button
                        key={m.key}
                        type="button"
                        onClick={() => setMethod(m.key)}
                        className={cn(
                          "flex items-center gap-2 px-3 py-2.5 rounded-lg border text-sm font-medium transition-all touch-manipulation",
                          method === m.key
                            ? "border-blue-500 bg-blue-50 text-blue-700 ring-2 ring-blue-500/30"
                            : "border-slate-200 bg-white text-slate-700 hover:bg-slate-50"
                        )}
                      >
                        <Icon className="size-4" />
                        {m.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <Label className="text-xs font-medium text-slate-600">Tahsilat Tarihi *</Label>
                  <Input
                    type="datetime-local"
                    value={paymentDate}
                    onChange={(e) => setPaymentDate(e.target.value)}
                    className="mt-1.5"
                  />
                </div>
                <div>
                  <Label className="text-xs font-medium text-slate-600">Referans No</Label>
                  <Input
                    value={referenceNo}
                    onChange={(e) => setReferenceNo(e.target.value)}
                    placeholder="Opsiyonel"
                    className="mt-1.5"
                  />
                </div>
              </div>

              <div>
                <Label className="text-xs font-medium text-slate-600">Not</Label>
                <Input
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="Opsiyonel not"
                  className="mt-1.5"
                />
              </div>
            </CardContent>
          </Card>
        </div>

        <div className="lg:col-span-1 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2">
                <Calculator className="size-4 text-slate-500" />
                Tahsilat Özeti
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-2.5">
              {selectedOrder ? (
                <>
                  <SummaryRow label="İş Emri Toplamı" value={formatTRY(orderTotal)} />
                  <SummaryRow label="Daha Önce Tahsil Edilen" value={formatTRY(previousPaid)} tone="emerald" />
                  <SummaryRow label="Yeni Tahsilat" value={amountNum > 0 ? formatTRY(amountNum) : "—"} bold tone="blue" />
                  <div className="border-t pt-2">
                    <SummaryRow
                      label="Kalan Bakiye (tahsilat sonrası)"
                      value={formatTRY(newRemaining)}
                      bold
                      tone={newRemaining > 0 ? "rose" : "slate"}
                    />
                  </div>
                  {projectedStatus && (
                    <div className="border-t pt-2">
                      <div className="flex items-center justify-between">
                        <span className="text-xs text-slate-500">Ödeme Durumu (tahsilat sonrası)</span>
                        <PaymentBadge status={projectedStatus} size="md" />
                      </div>
                    </div>
                  )}
                  {isOverpayment && (
                    <div className="p-2.5 rounded-lg bg-sky-50 border border-sky-200 text-sky-800 text-xs flex items-start gap-2">
                      <Info className="size-3.5 mt-0.5 shrink-0" />
                      <span>Fazla ödeme: kalan bakiyeyi aşıyor ({formatTRY(amountNum - remaining)} fazla)</span>
                    </div>
                  )}
                </>
              ) : (
                <div className="text-center py-4 text-sm text-slate-500">
                  <Calculator className="size-8 mx-auto mb-2 text-slate-300" />
                  <p>İş emri seçilirse ödeme özeti görüntülenir</p>
                </div>
              )}

              {amountNum > 0 && !selectedOrder && (
                <div className="border-t pt-2">
                  <SummaryRow label="Tahsilat Tutarı" value={formatTRY(amountNum)} bold tone="blue" />
                </div>
              )}
            </CardContent>
          </Card>

          <div className="lg:hidden fixed bottom-16 left-0 right-0 z-20 bg-white border-t border-slate-200 px-4 py-3 safe-area-bottom">
            <Button type="submit" disabled={loading || !customerId || amountNum <= 0} className="w-full h-11">
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
              Tahsilatı Kaydet
            </Button>
          </div>

          <div className="hidden lg:block">
            <Button type="submit" disabled={loading || !customerId || amountNum <= 0} className="w-full h-11">
              {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
              Tahsilatı Kaydet
            </Button>
          </div>
        </div>
      </form>
    </div>
  )
}

function SummaryRow({ label, value, bold, tone = "slate" }: { label: string; value: string; bold?: boolean; tone?: "slate" | "emerald" | "blue" | "rose" }) {
  const color = tone === "emerald" ? "text-emerald-700" : tone === "blue" ? "text-blue-700" : tone === "rose" ? "text-rose-700" : "text-slate-900"
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-slate-600", bold && "text-slate-900")}>{label}</span>
      <span className={cn(color, bold && "text-base")}>{value}</span>
    </div>
  )
}