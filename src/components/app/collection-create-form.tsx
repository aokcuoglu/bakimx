"use client"

import { useState, useMemo } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Alert, AlertDescription } from "@/components/ui/alert"
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
} from "lucide-react"
import { cn } from "@/lib/utils"
import { useForm } from "react-hook-form"
import { typedResolver } from "@/lib/validations/resolver"
import { collectionSchema, type CollectionFormValues } from "@/lib/validations/collection"

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
  const [customerSearch, setCustomerSearch] = useState("")

  const form = useForm<CollectionFormValues, unknown, CollectionFormValues>({
    resolver: typedResolver(collectionSchema),
    defaultValues: {
      customerId: preselectedCustomerId || "",
      serviceOrderId: preselectedOrderId || "",
      amount: 0,
      method: "cash",
      paymentDate: new Date().toISOString().slice(0, 16),
      referenceNo: "",
      note: "",
    },
  })

  const customerId = form.watch("customerId")
  const serviceOrderId = form.watch("serviceOrderId")
  const amount = form.watch("amount")

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

  const amountNum = typeof amount === "number" ? amount : parseFloat(String(amount)) || 0
  const orderTotal = selectedOrder?.grandTotal || 0
  const previousPaid = selectedOrder?.paidAmount || 0
  const remaining = selectedOrder ? Math.max(0, orderTotal - previousPaid) : 0
  const newRemaining = selectedOrder ? Math.max(0, orderTotal - previousPaid - amountNum) : 0
  const projectedStatus = selectedOrder ? computePaymentStatus(orderTotal, previousPaid + amountNum) : null
  const isOverpayment = selectedOrder && amountNum > remaining && remaining > 0

  async function onSubmit(values: CollectionFormValues) {
    setLoading(true)
    setError("")

    const formData = new FormData()
    formData.set("customerId", values.customerId)
    formData.set("serviceOrderId", values.serviceOrderId || "")
    formData.set("amount", String(values.amount))
    formData.set("method", values.method)
    formData.set("paymentDate", new Date(values.paymentDate).toISOString())
    formData.set("referenceNo", values.referenceNo || "")
    formData.set("note", values.note || "")

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
    <Form {...form}>
      <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Button
            type="button"
            variant="link"
            className="p-0 h-auto text-muted-foreground hover:text-foreground inline-flex items-center gap-1 touch-manipulation"
            render={<Link href="/app/cashbox/payments" />}
          >
            <ArrowLeft className="size-3.5" />
            Tahsilatlar
          </Button>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Yeni Tahsilat</span>
        </div>

        {error && (
          <Alert variant="destructive">
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        )}

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
          <div className="lg:col-span-2 space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base">Müşteri & İş Emri</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="customerId"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">Müşteri *</FormLabel>
                      <div className="relative">
                        <Input
                          value={customerSearch}
                          onChange={(e) => {
                            setCustomerSearch(e.target.value)
                            if (!e.target.value) field.onChange("")
                          }}
                          placeholder={selectedCustomer ? nameFor(selectedCustomer) : "Müşteri ara (ad, telefon)…"}
                          className="mt-1.5 w-full"
                        />
                      </div>
                      {customerSearch && !customerId && (
                        <div className="mt-1.5 max-h-48 overflow-y-auto rounded-lg border border-border bg-background shadow-sm">
                          {filteredCustomers.length === 0 ? (
                            <div className="px-3 py-3 text-sm text-muted-foreground">Sonuç bulunamadı</div>
                          ) : (
                            filteredCustomers.map((c) => (
                              <Button
                                key={c.id}
                                type="button"
                                variant="ghost"
                                className="w-full justify-start px-3 py-2.5 h-auto text-sm hover:bg-muted border-b border-border last:border-0 rounded-none"
                                onClick={() => { field.onChange(c.id); setCustomerSearch(""); form.setValue("serviceOrderId", "") }}
                              >
                                <span className="font-medium text-foreground">{nameFor(c)}</span>
                                <span className="text-muted-foreground ml-2">{c.phone}</span>
                              </Button>
                            ))
                          )}
                        </div>
                      )}
                      {selectedCustomer && (
                        <div className="mt-1.5 flex items-center gap-2 px-3 py-2 rounded-lg bg-muted border border-border text-sm">
                          <span className="font-medium text-foreground">{nameFor(selectedCustomer)}</span>
                          <span className="text-muted-foreground">{selectedCustomer.phone}</span>
                          <Button
                            type="button"
                            variant="link"
                            className="ml-auto p-0 h-auto text-xs text-muted-foreground hover:text-foreground"
                            onClick={() => { field.onChange(""); form.setValue("serviceOrderId", "") }}
                          >
                            Değiştir
                          </Button>
                        </div>
                      )}
                      <FormMessage />
                    </FormItem>
                  )}
                />

                {customerId && (
                  <FormField
                    control={form.control}
                    name="serviceOrderId"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">İş Emri (opsiyonel)</FormLabel>
                        <Select value={field.value} onValueChange={(v) => field.onChange(v ?? "")}>
                          <FormControl>
                            <SelectTrigger className="w-full h-10 mt-1.5">
                              <SelectValue placeholder="İş emri seçin (opsiyonel)" />
                            </SelectTrigger>
                          </FormControl>
                          <SelectContent>
                            <SelectItem value="">İş emri seçin (opsiyonel)</SelectItem>
                            {filteredOrders.map((o) => (
                              <SelectItem key={o.id} value={o.id}>
                                {o.workOrderNo || "—"} &bull; {o.vehicle.plate} &bull; Kalan: {formatTRY(o.remainingAmount)}
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                )}

                {selectedOrder && (
                  <div className="p-3 rounded-lg bg-muted border border-border space-y-1.5 text-sm">
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">İş No</span>
                      <span className="font-mono font-medium text-foreground">{selectedOrder.workOrderNo || "—"}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Plaka / Araç</span>
                      <span className="font-medium text-foreground">{selectedOrder.vehicle.plate} &bull; {selectedOrder.vehicle.brand} {selectedOrder.vehicle.model}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Genel Toplam</span>
                      <span className="font-semibold text-foreground">{formatTRY(selectedOrder.grandTotal)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-muted-foreground">Daha Önce Tahsil Edilen</span>
                      <span className="font-semibold text-success">{formatTRY(selectedOrder.paidAmount)}</span>
                    </div>
                    <div className="flex justify-between border-t border-border pt-1.5">
                      <span className="text-muted-foreground font-medium">Kalan Bakiye</span>
                      <span className={cn("font-bold", remaining > 0 ? "text-destructive" : "text-foreground")}>{formatTRY(remaining)}</span>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>

            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Wallet className="size-4 text-muted-foreground" />
                  Tahsilat Bilgileri
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <FormField
                  control={form.control}
                  name="amount"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">Tutar (₺) *</FormLabel>
                      <FormControl>
                        <Input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value)}
                          placeholder="0.00"
                          className="mt-1.5 text-lg font-semibold"
                        />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="method"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">Ödeme Yöntemi *</FormLabel>
                      <FormControl>
                        <div className="mt-1.5 grid grid-cols-2 sm:grid-cols-4 gap-2">
                          {METHODS.map((m) => {
                            const Icon = m.icon
                            return (
                              <Button
                                key={m.key}
                                type="button"
                                variant={field.value === m.key ? "default" : "outline"}
                                className="justify-start flex-1"
                                onClick={() => field.onChange(m.key)}
                              >
                                <Icon className="size-4 mr-2" />
                                {m.label}
                              </Button>
                            )
                          })}
                        </div>
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <FormField
                    control={form.control}
                    name="paymentDate"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">Tahsilat Tarihi *</FormLabel>
                        <FormControl>
                          <Input type="datetime-local" {...field} className="mt-1.5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                  <FormField
                    control={form.control}
                    name="referenceNo"
                    render={({ field }) => (
                      <FormItem>
                        <FormLabel className="text-xs font-medium text-muted-foreground">Referans No</FormLabel>
                        <FormControl>
                          <Input {...field} placeholder="Opsiyonel" className="mt-1.5" />
                        </FormControl>
                        <FormMessage />
                      </FormItem>
                    )}
                  />
                </div>

                <FormField
                  control={form.control}
                  name="note"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-medium text-muted-foreground">Not</FormLabel>
                      <FormControl>
                        <Input {...field} placeholder="Opsiyonel not" className="mt-1.5" />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </CardContent>
            </Card>
          </div>

          <div className="lg:col-span-1 space-y-5">
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-base flex items-center gap-2">
                  <Calculator className="size-4 text-muted-foreground" />
                  Tahsilat Özeti
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-2.5">
                {selectedOrder ? (
                  <>
                    <SummaryRow label="İş Emri Toplamı" value={formatTRY(orderTotal)} />
                    <SummaryRow label="Daha Önce Tahsil Edilen" value={formatTRY(previousPaid)} tone="emerald" />
                    <SummaryRow label="Yeni Tahsilat" value={amountNum > 0 ? formatTRY(amountNum) : "—"} bold tone="primary" />
                    <div className="border-t pt-2">
                      <SummaryRow
                        label="Kalan Bakiye (tahsilat sonrası)"
                        value={formatTRY(newRemaining)}
                        bold
                        tone={newRemaining > 0 ? "destructive" : "slate"}
                      />
                    </div>
                    {projectedStatus && (
                      <div className="border-t pt-2">
                        <div className="flex items-center justify-between">
                          <span className="text-xs text-muted-foreground">Ödeme Durumu (tahsilat sonrası)</span>
                          <PaymentBadge status={projectedStatus} size="md" />
                        </div>
                      </div>
                    )}
                    {isOverpayment && (
                      <div className="p-2.5 rounded-lg bg-muted border border-border text-muted-foreground text-xs flex items-start gap-2">
                        <Info className="size-3.5 mt-0.5 shrink-0" />
                        <span>Fazla ödeme: kalan bakiyeyi aşıyor ({formatTRY(amountNum - remaining)} fazla)</span>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-4 text-sm text-muted-foreground">
                    <Calculator className="size-8 mx-auto mb-2 text-muted-foreground/50" />
                    <p>İş emri seçilirse ödeme özeti görüntülenir</p>
                  </div>
                )}

                {amountNum > 0 && !selectedOrder && (
                  <div className="border-t pt-2">
                    <SummaryRow label="Tahsilat Tutarı" value={formatTRY(amountNum)} bold tone="primary" />
                  </div>
                )}
              </CardContent>
            </Card>

            <div className="lg:hidden fixed bottom-16 left-0 right-0 z-20 bg-background border-t border-border px-4 py-3 safe-area-bottom">
              <Button type="submit" disabled={loading} className="w-full h-11">
                {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
                Tahsilatı Kaydet
              </Button>
            </div>

            <div className="hidden lg:block">
              <Button type="submit" disabled={loading} className="w-full h-11">
                {loading ? <Loader2 className="size-4 mr-2 animate-spin" /> : <Check className="size-4 mr-2" />}
                Tahsilatı Kaydet
              </Button>
            </div>
          </div>
        </div>
      </form>
    </Form>
  )
}

function SummaryRow({ label, value, bold, tone = "slate" }: { label: string; value: string; bold?: boolean; tone?: "slate" | "emerald" | "primary" | "destructive" }) {
  const color = tone === "emerald" ? "text-success" : tone === "primary" ? "text-primary" : tone === "destructive" ? "text-destructive" : "text-foreground"
  return (
    <div className={cn("flex items-center justify-between text-sm", bold && "font-semibold")}>
      <span className={cn("text-muted-foreground", bold && "text-foreground")}>{label}</span>
      <span className={cn(color, bold && "text-base")}>{value}</span>
    </div>
  )
}