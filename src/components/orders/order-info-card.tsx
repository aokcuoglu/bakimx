"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { PaymentBadge } from "@/components/shared/status-badge"
import { TechnicianAssign, type AssignableTechnician } from "@/components/orders/technician-assign"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { formatTRY } from "@/lib/format"
import { ORDER_STATUS, ARRIVAL_REASON_ORDER, ARRIVAL_REASONS, arrivalReasonLabel, type OrderStatusKey } from "@/lib/constants"
import { isOrderLocked, orderStatusOptions } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { Calendar, Loader2, Pencil, Receipt } from "lucide-react"
import type { OrderDetailData } from "@/components/orders/order-management-panel"

export function OrderInfoCard({
  order,
  technicians,
  onRequestDelivery,
  deliveryBlocked,
}: {
  order: OrderDetailData
  technicians?: AssignableTechnician[]
  onRequestDelivery?: () => void
  deliveryBlocked?: boolean
}) {
  const locked = isOrderLocked(order.status as OrderStatus)

  const router = useRouter()
  const [editingInvoice, setEditingInvoice] = useState(false)
  const [savingInvoice, setSavingInvoice] = useState(false)
  // DatePicker GG.AA.YYYY string ile çalışır; formatDate tam bu biçimi üretir.
  const [invoiceNoDraft, setInvoiceNoDraft] = useState(order.invoiceNo ?? "")
  const [invoiceDateDraft, setInvoiceDateDraft] = useState(
    order.invoiceDate ? formatDate(order.invoiceDate) : "",
  )

  // Fatura araç teslim edildikten SONRA kesilir; bu yüzden teslim kilidinden muaf.
  // İptal edilmiş emirde ise iş hiç yapılmadı — orada kapalı (sunucu da reddeder).
  const invoiceEditable = order.status !== "cancelled"

  function startEditInvoice() {
    setInvoiceNoDraft(order.invoiceNo ?? "")
    setInvoiceDateDraft(order.invoiceDate ? formatDate(order.invoiceDate) : "")
    setEditingInvoice(true)
  }

  async function saveInvoice() {
    setSavingInvoice(true)
    try {
      const formData = new FormData()
      formData.set("invoiceNo", invoiceNoDraft)
      formData.set("invoiceDate", invoiceDateDraft)
      const res = await fetch(`/api/orders/${order.id}/invoice`, { method: "POST", body: formData })
      const data = await res.json()
      if (data.success) {
        setEditingInvoice(false)
        router.refresh()
      } else {
        toast.error(data.error || "Fatura bilgisi kaydedilemedi")
      }
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setSavingInvoice(false)
    }
  }

  const [changingStatus, setChangingStatus] = useState(false)
  const [changingReason, setChangingReason] = useState(false)
  const statusOptions = orderStatusOptions(order.status as OrderStatus)

  async function handleStatusSelect(next: string) {
    if (!next || next === order.status) return
    // Teslim müşteri onaylı (OTP) verilir — dropdown'dan doğrudan yazılmaz.
    // OTP paneli sekme şeridinin ÜSTÜNDE açılıyor, bu dropdown ise sekme
    // içeriğinin altında; mobilde hiçbir şey olmamış gibi görünmesin diye
    // kullanıcıya nereye bakacağını söylüyoruz.
    if (next === "delivered") {
      onRequestDelivery?.()
      toast.info("Teslim onay kodu paneli sayfanın üstünde açıldı")
      return
    }
    setChangingStatus(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (data.success) router.refresh()
      else toast.error(data.error || "Durum güncellenemedi")
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setChangingStatus(false)
    }
  }

  async function handleReasonSelect(next: string) {
    setChangingReason(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/arrival-reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: next }),
      })
      const data = await res.json()
      if (data.success) router.refresh()
      else toast.error(data.error || "Geliş nedeni güncellenemedi")
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setChangingReason(false)
    }
  }

  return (
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center gap-2">
          <Receipt className="size-4 text-muted-foreground" />
          İş Emri Bilgileri
        </CardTitle>
      </CardHeader>
      <CardContent className="text-sm">
        <div className="grid grid-cols-1 gap-y-2.5 md:grid-cols-2 md:gap-x-8">
          {/* SOL: mevcut iş emri kimliği ve atama bilgileri */}
          <div className="space-y-2.5">
            <InfoRow label="İş No" value={order.workOrderNo} mono />
            <InfoRow label="Oluşturulma" value={formatDateTime(order.createdAt)} icon={Calendar} />
            <InfoRow
              label="Tahmini Teslim"
              value={order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : "—"}
              icon={Calendar}
            />
            {order.completedAt && (
              <InfoRow label="Tamamlanma" value={formatDateTime(order.completedAt)} icon={Calendar} />
            )}
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Atanan Usta</span>
              {/* Atama tek bir yerden yürür (technician-assign); burada yalnız tetikleyici durur. */}
              <TechnicianAssign
                orderId={order.id}
                assignedTechnicianId={order.assignedTechnicianId}
                assignedTechnicianName={order.assignedTechnicianName}
                technicians={technicians ?? []}
                locked={locked}
              />
            </div>
            {order.technicianName && order.technicianName !== order.assignedTechnicianName && (
              <InfoRow label="Teknisyen (eski)" value={order.technicianName} />
            )}
            {order.notes && (
              <div className="pt-2 border-t">
                <p className="text-xs text-muted-foreground mb-1">Notlar</p>
                <p className="text-sm text-foreground whitespace-pre-wrap">{order.notes}</p>
              </div>
            )}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-1.5">Ödeme</p>
              <PaymentBadge status={order.paymentStatus} size="md" />
            </div>
          </div>

          {/* SAĞ: fatura, tutar, durum, geliş nedeni.
              Mobilde dikey çizgi yerine üst kenarlık — kolonlar alt alta düşüyor. */}
          <div className="space-y-2.5 border-t pt-3 md:border-t-0 md:border-l md:pt-0 md:pl-6">
            {editingInvoice ? (
              <div className="space-y-2.5">
                <div>
                  <Label htmlFor="invoice-no">Fatura Numarası</Label>
                  <Input
                    id="invoice-no"
                    value={invoiceNoDraft}
                    onChange={(e) => setInvoiceNoDraft(e.target.value)}
                    placeholder="Örn. ABC2026000000123"
                    maxLength={50}
                  />
                </div>
                <div>
                  <Label htmlFor="invoice-date">Fatura Tarihi</Label>
                  <DatePicker
                    id="invoice-date"
                    value={invoiceDateDraft}
                    onChange={setInvoiceDateDraft}
                    placeholder="Tarih seçin"
                  />
                </div>
                <div className="flex gap-2 pt-1">
                  <Button onClick={saveInvoice} disabled={savingInvoice} size="sm" className="flex-1">
                    {savingInvoice ? <Loader2 className="size-3.5 animate-spin" /> : "Kaydet"}
                  </Button>
                  <Button variant="outline" onClick={() => setEditingInvoice(false)} disabled={savingInvoice} size="sm">
                    İptal
                  </Button>
                </div>
                <p className="text-xs text-muted-foreground">
                  Fatura entegrasyonu yok — bilgileri kendi fatura uygulamanızdan girin.
                </p>
              </div>
            ) : (
              <>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-muted-foreground">Fatura Numarası</span>
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-xs text-foreground">{order.invoiceNo || "—"}</span>
                    {invoiceEditable && (
                      <button
                        onClick={startEditInvoice}
                        className="flex items-center gap-1 text-xs font-medium text-primary hover:bg-primary/5 px-1.5 py-0.5 rounded-lg touch-manipulation"
                      >
                        <Pencil className="size-3" /> Düzenle
                      </button>
                    )}
                  </span>
                </div>
                <InfoRow
                  label="Fatura Tarihi"
                  value={order.invoiceDate ? formatDate(order.invoiceDate) : "—"}
                  icon={Calendar}
                />
              </>
            )}
            <InfoRow
              label="Toplam Tutar"
              value={order.totals.hasAnyPrice ? formatTRY(order.totals.grandTotal) : "—"}
            />
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Durum</span>
              {/* Durum makinesi tek kaynak: liste orderStatusOptions'tan gelir,
                  sunucu da aynı geçiş kuralını uygular. Silme seçeneği yoktur —
                  terminal aksiyon "İptal". */}
              <Select
                value={order.status}
                onValueChange={(v) => handleStatusSelect(v ?? "")}
                disabled={changingStatus || statusOptions.length <= 1}
              >
                <SelectTrigger className="w-[170px]">
                  <SelectValue>
                    {(value: string | null) =>
                      value ? (ORDER_STATUS[value as OrderStatusKey]?.label ?? value) : null
                    }
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s} disabled={s === "delivered" && deliveryBlocked}>
                      {ORDER_STATUS[s as OrderStatusKey]?.label ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex items-center justify-between gap-2">
              <span className="text-xs text-muted-foreground">Servise Geliş Nedeni</span>
              {locked ? (
                <span className="text-sm text-foreground">{arrivalReasonLabel(order.arrivalReason)}</span>
              ) : (
                <Select
                  value={order.arrivalReason ?? ""}
                  onValueChange={(v) => handleReasonSelect(v ?? "")}
                  disabled={changingReason}
                >
                  <SelectTrigger className="w-[170px]">
                    {/* Base UI'da `children` verilince `placeholder` HİÇ render
                        edilmez ve render fonksiyonundan null dönerse tetikleyici
                        bomboş kalır (kırık kontrol gibi görünür). arrivalReasonLabel
                        boş/null değerde zaten "—" döndüğü için koşulsuz çağırıyoruz. */}
                    <SelectValue>
                      {(value: string | null) => arrivalReasonLabel(value)}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Belirtilmedi</SelectItem>
                    {ARRIVAL_REASON_ORDER.map((r) => (
                      <SelectItem key={r} value={r}>{ARRIVAL_REASONS[r].label}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}
            </div>
          </div>
        </div>
      </CardContent>
    </Card>
  )
}

function InfoRow({
  label,
  value,
  mono,
  icon: Icon,
}: {
  label: string
  value: string
  mono?: boolean
  icon?: React.ComponentType<{ className?: string }>
}) {
  return (
    <div className="flex items-center justify-between gap-2">
      <span className="text-xs text-muted-foreground">{label}</span>
      <span className={cn("text-sm text-foreground flex items-center gap-1.5", mono && "font-mono text-xs")}>
        {Icon && <Icon className="size-3.5 text-muted-foreground/70" />}
        {value}
      </span>
    </div>
  )
}
