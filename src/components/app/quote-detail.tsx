"use client"

import { useRouter } from "next/navigation"
import Link from "next/link"
import { useState } from "react"
import { QuoteStatusBadge } from "@/components/app/quote-status-badge"
import { PlateBadge } from "@/components/app/status-badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { formatTRY, customerDisplayName } from "@/lib/format"
import { formatDate } from "@/lib/utils-client"
import { cn } from "@/lib/utils"
import { updateQuoteStatusAction, convertQuoteToWorkOrderAction } from "@/app/app/quotes/actions"
import { ArrowLeft, Phone, Car, User, FileText, Printer, Share2, Loader2, ArrowRight, Info, Calendar } from "lucide-react"
import { QUOTE_STATUS } from "@/lib/constants"
import { getWhatsAppShareUrl } from "@/lib/share/whatsapp"

type QuoteItem = {
  id: string
  type: string
  name: string
  quantity: number
  unitPrice: number | null
  totalPrice: number | null
  note: string | null
}

type QuoteDetailData = {
  id: string
  quoteNo: string
  status: string
  title: string | null
  customerRequest: string | null
  internalNote: string | null
  validUntil: string | null
  estimatedPartsTotal: number | null
  estimatedLaborTotal: number | null
  discountAmount: number | null
  taxRate: number | null
  grandTotal: number | null
  createdAt: string
  customer: {
    id: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    type: string
    phone: string
    email: string | null
  }
  vehicle: {
    id: string
    plate: string
    brand: string
    model: string
  } | null
  items: QuoteItem[]
  convertedServiceOrder: { id: string; workOrderNo: string | null } | null
}

export function QuoteDetail({ quote }: { quote: QuoteDetailData }) {
  const router = useRouter()
  const [statusLoading, setStatusLoading] = useState(false)
  const [convertLoading, setConvertLoading] = useState(false)
  const [error, setError] = useState("")

  const partsTotal = quote.items
    .filter((i) => i.type === "part")
    .reduce((sum, i) => sum + (i.totalPrice ?? 0), 0)
  const laborTotal = quote.items
    .filter((i) => i.type === "labor")
    .reduce((sum, i) => sum + (i.totalPrice ?? 0), 0)
  const subtotal = partsTotal + laborTotal
  const discount = quote.discountAmount ?? 0
  const effectiveTaxRate = quote.taxRate ?? 0
  const afterDiscount = Math.max(0, subtotal - discount)
  const taxAmount = (afterDiscount * effectiveTaxRate) / 100
  const grandTotal = quote.grandTotal ?? (afterDiscount + taxAmount)

  const validStatusTransitions: Record<string, string[]> = {
    draft: ["sent", "cancelled"],
    sent: ["accepted", "rejected", "expired"],
    accepted: ["converted"],
    rejected: [],
    expired: [],
    converted: [],
    cancelled: [],
  }

  const nextStatuses = validStatusTransitions[quote.status] || []
  const isConvertedOrCancelled = quote.status === "converted" || quote.status === "cancelled"

  async function handleStatusChange(newStatus: string) {
    setStatusLoading(true)
    setError("")
    const formData = new FormData()
    formData.set("quoteId", quote.id)
    formData.set("status", newStatus)
    try {
      const result = await updateQuoteStatusAction(formData)
      if (result.error) {
        setError(result.error)
      } else {
        router.refresh()
      }
    } catch {
      setError("Durum güncellenemedi")
    } finally {
      setStatusLoading(false)
    }
  }

  async function handleConvert() {
    setConvertLoading(true)
    setError("")
    const formData = new FormData()
    formData.set("quoteId", quote.id)
    try {
      const result = await convertQuoteToWorkOrderAction(formData)
      if (result.error) {
        setError(result.error)
      } else if (result.success && result.orderId) {
        router.push(`/app/orders/${result.orderId}`)
      }
    } catch {
      setError("Dönüştürme başarısız")
    } finally {
      setConvertLoading(false)
    }
  }

  function handleWhatsApp() {
    const customerName = customerDisplayName(quote.customer)
    let text = `Merhaba ${customerName},\n${quote.quoteNo} numaralı teklifiniz hazır.\n`
    if (grandTotal > 0) {
      text += `Toplam Tutar: ${formatTRY(grandTotal)}\n`
    }
    if (quote.validUntil) {
      text += `Geçerlilik Tarihi: ${formatDate(quote.validUntil)}\n`
    }
    text += "\nDetaylı bilgi için bize ulaşabilirsiniz."
    window.open(getWhatsAppShareUrl(text), "_blank")
  }

  return (
    <div className="space-y-5 sm:space-y-6 pb-24 lg:pb-6">
      <div className="flex items-center text-sm text-slate-500">
        <Link href="/app/quotes" className="hover:text-slate-700 inline-flex items-center gap-1 touch-manipulation">
          <ArrowLeft className="size-3.5" />
          Teklifler
        </Link>
        <span className="mx-2">/</span>
        <span className="text-slate-700 font-medium">{quote.quoteNo}</span>
      </div>

      {error && (
        <div className="p-3 rounded-lg bg-rose-50 border border-rose-200 text-rose-800 text-sm flex items-start gap-2">
          <Info className="size-4 shrink-0 mt-0.5" />
          <span>{error}</span>
        </div>
      )}

      <header className="rounded-2xl border border-slate-200 bg-white p-4 sm:p-5">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="min-w-0">
              <div className="flex items-center gap-2 flex-wrap">
                <h2 className="text-lg sm:text-xl font-bold text-slate-900">{quote.quoteNo}</h2>
                <QuoteStatusBadge status={quote.status} size="md" />
              </div>
              {quote.title && (
                <p className="text-sm text-slate-500 mt-1">{quote.title}</p>
              )}
            </div>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-2xl font-bold text-slate-900">
              {grandTotal > 0 ? formatTRY(grandTotal) : "—"}
            </span>
            {quote.validUntil && (
              <span className="text-xs text-slate-500 flex items-center gap-1">
                <Calendar className="size-3" />
                {formatDate(quote.validUntil)}
              </span>
            )}
          </div>
        </div>
      </header>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        <div className="lg:col-span-2 space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold flex items-center gap-2">
                <User className="size-4 text-slate-500" />
                Müşteri
              </CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex items-start justify-between gap-3">
                <div>
                  <Link
                    href={`/app/customers/${quote.customer.id}`}
                    className="text-sm font-semibold text-slate-900 hover:text-blue-600"
                  >
                    {customerDisplayName(quote.customer)}
                  </Link>
                  <a
                    href={`tel:${quote.customer.phone}`}
                    className="flex items-center gap-1.5 text-sm text-slate-600 hover:text-blue-600 mt-1"
                  >
                    <Phone className="size-3.5" />
                    {quote.customer.phone}
                  </a>
                </div>
                <Link
                  href={`/app/customers/${quote.customer.id}`}
                  className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                >
                  Müşteri Detayı
                  <ArrowRight className="size-3" />
                </Link>
              </div>
            </CardContent>
          </Card>

          {quote.vehicle && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <Car className="size-4 text-slate-500" />
                  Araç
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="flex items-start justify-between gap-3">
                  <div className="flex items-center gap-3">
                    <PlateBadge plate={quote.vehicle.plate} />
                    <span className="text-sm font-medium text-slate-700">
                      {quote.vehicle.brand} {quote.vehicle.model}
                    </span>
                  </div>
                  <Link
                    href={`/app/vehicles/${quote.vehicle.id}`}
                    className="text-xs text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                  >
                    Araç Detayı
                    <ArrowRight className="size-3" />
                  </Link>
                </div>
              </CardContent>
            </Card>
          )}

          {quote.customerRequest && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold flex items-center gap-2">
                  <FileText className="size-4 text-slate-500" />
                  Müşteri Talebi
                </CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{quote.customerRequest}</p>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader className="pb-3">
              <div className="flex items-center justify-between">
                <CardTitle className="text-sm font-semibold">Teklif Kalemleri</CardTitle>
                <span className="text-xs text-slate-500">{quote.items.length} kalem</span>
              </div>
            </CardHeader>
            <CardContent>
              {quote.items.length === 0 ? (
                <div className="text-center py-6 text-sm text-slate-500">Henüz kalem eklenmemiş</div>
              ) : (
                <div className="overflow-x-auto">
                  <table className="w-full text-sm">
                    <thead className="text-xs text-slate-500 uppercase tracking-wider border-b border-slate-200">
                      <tr>
                        <th className="text-left pb-2 font-semibold pr-3">Tip</th>
                        <th className="text-left pb-2 font-semibold pr-3">Ad</th>
                        <th className="text-right pb-2 font-semibold pr-3">Miktar</th>
                        <th className="text-right pb-2 font-semibold pr-3">Birim Fiyat</th>
                        <th className="text-right pb-2 font-semibold pr-3">Tutar</th>
                        <th className="text-left pb-2 font-semibold">Not</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-slate-100">
                      {quote.items.map((item) => (
                        <tr key={item.id} className="text-slate-700">
                          <td className="py-2 pr-3">
                            <span className={cn(
                              "inline-flex items-center h-5 px-1.5 rounded text-[10px] font-semibold uppercase tracking-wider",
                              item.type === "part"
                                ? "bg-slate-100 text-slate-600"
                                : "bg-blue-50 text-blue-700"
                            )}>
                              {item.type === "part" ? "Parça" : "İşçilik"}
                            </span>
                          </td>
                          <td className="py-2 pr-3 font-medium">{item.name}</td>
                          <td className="py-2 pr-3 text-right text-slate-500">{item.quantity}</td>
                          <td className="py-2 pr-3 text-right text-slate-500">
                            {item.unitPrice != null ? formatTRY(item.unitPrice) : "—"}
                          </td>
                          <td className="py-2 pr-3 text-right font-medium">
                            {item.totalPrice != null ? formatTRY(item.totalPrice) : "—"}
                          </td>
                          <td className="py-2 text-xs text-slate-500">{item.note || "—"}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </CardContent>
          </Card>

          {quote.internalNote && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">İç Not</CardTitle>
              </CardHeader>
              <CardContent>
                <p className="text-sm text-slate-700 whitespace-pre-wrap">{quote.internalNote}</p>
                <p className="mt-1 text-[11px] text-slate-500 italic">Bu not müşteri çıktısında gösterilmez</p>
              </CardContent>
            </Card>
          )}

          {quote.convertedServiceOrder && (
            <Card>
              <CardContent className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2 text-sm">
                    <Info className="size-4 text-indigo-600" />
                    <span className="font-medium text-slate-700">Bu teklif iş emrine çevrildi</span>
                    <Link
                      href={`/app/orders/${quote.convertedServiceOrder.id}`}
                      className="text-blue-600 hover:text-blue-700 font-medium inline-flex items-center gap-1"
                    >
                      {quote.convertedServiceOrder.workOrderNo || "İş Emri"}
                      <ArrowRight className="size-3" />
                    </Link>
                  </div>
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        <aside className="space-y-5">
          <Card>
            <CardHeader className="pb-3">
              <CardTitle className="text-sm font-semibold">Fiyatlandırma</CardTitle>
            </CardHeader>
            <CardContent className="space-y-2">
              <SummaryRow label="Parça Toplamı" value={partsTotal > 0 ? formatTRY(partsTotal) : "—"} muted={partsTotal === 0} />
              <SummaryRow label="İşçilik Toplamı" value={laborTotal > 0 ? formatTRY(laborTotal) : "—"} muted={laborTotal === 0} />
              <div className="border-t pt-2 mt-2">
                <SummaryRow label="Ara Toplam" value={subtotal > 0 ? formatTRY(subtotal) : "—"} bold={subtotal > 0} />
              </div>
              <SummaryRow label="İndirim" value={discount > 0 ? `-${formatTRY(discount)}` : "—"} muted={discount === 0} />
              <SummaryRow
                label={`KDV (%${effectiveTaxRate})`}
                value={taxAmount > 0 ? formatTRY(taxAmount) : "—"}
                muted={taxAmount === 0}
              />
              <div className="border-t pt-2 mt-2">
                <SummaryRow label="Genel Toplam" value={grandTotal > 0 ? formatTRY(grandTotal) : "—"} bold large />
              </div>
            </CardContent>
          </Card>

          {nextStatuses.length > 0 && (
            <Card>
              <CardHeader className="pb-3">
                <CardTitle className="text-sm font-semibold">Durum Güncelle</CardTitle>
              </CardHeader>
              <CardContent className="space-y-2">
                {nextStatuses.map((s) => {
                  const info = QUOTE_STATUS[s as keyof typeof QUOTE_STATUS]
                  return (
                    <Button
                      key={s}
                      type="button"
                      size="sm"
                      variant={s === "cancelled" ? "outline" : "default"}
                      className={cn("w-full gap-2", s === "cancelled" && "text-rose-600 border-rose-200 hover:bg-rose-50")}
                      disabled={statusLoading}
                      onClick={() => handleStatusChange(s)}
                    >
                      {statusLoading ? <Loader2 className="size-3.5 animate-spin" /> : null}
                      {info?.label || s}
                    </Button>
                  )
                })}
              </CardContent>
            </Card>
          )}

          {!isConvertedOrCancelled && (
            <Button
              type="button"
              variant="outline"
              className="w-full gap-2"
              disabled={convertLoading}
              onClick={handleConvert}
            >
              {convertLoading ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
              İş Emrine Çevir
            </Button>
          )}

          <div className="space-y-2">
            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider block">Paylaş</span>
            <button
              type="button"
              disabled
              className="flex items-center gap-2 w-full p-2.5 rounded-lg border border-slate-200 bg-white text-slate-400 text-sm cursor-not-allowed touch-manipulation"
              title="PDF çıktısı yakında"
            >
              <Printer className="size-4" />
              Yazdır / PDF
            </button>
            <button
              type="button"
              onClick={handleWhatsApp}
              className="flex items-center gap-2 w-full p-2.5 rounded-lg bg-[#25D366] hover:bg-[#25D366]/90 text-white text-sm font-medium transition-colors touch-manipulation"
            >
              <Share2 className="size-4" />
              WhatsApp ile Paylaş
            </button>
          </div>
        </aside>
      </div>
    </div>
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
