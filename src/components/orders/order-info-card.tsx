"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { toast } from "sonner"
import { Button } from "@/components/ui/button"
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip"
import { Input } from "@/components/ui/input"
import { Label } from "@/components/ui/label"
import { DatePicker } from "@/components/ui/date-picker"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogHeader,
  AlertDialogFooter,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogAction,
  AlertDialogCancel,
} from "@/components/ui/alert-dialog"
import { DetailPanel, DetailRow, OrderPaymentPill, detail } from "@/components/orders/order-detail-surface"
import { TechnicianAssign, type AssignableTechnician } from "@/components/orders/technician-assign"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { formatTRY } from "@/lib/format"
import { ORDER_STATUS, ARRIVAL_REASON_ORDER, ARRIVAL_REASONS, arrivalReasonLabel, type OrderStatusKey } from "@/lib/constants"
import { isOrderLocked, orderStatusOptions } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { Loader2, Pencil } from "lucide-react"
import type { OrderDetailData } from "@/components/orders/order-management-panel"

export function OrderInfoCard({
  order,
  technicians,
  onRequestDelivery,
  deliveryBlocked,
  partsDecisionBlocked,
}: {
  order: OrderDetailData
  technicians?: AssignableTechnician[]
  onRequestDelivery?: () => void
  /** Fiyatsız kalem ya da karar bekleyen parça talebi → teslim kapalı. */
  deliveryBlocked?: boolean
  /** Karar bekleyen parça talebi → "Teslime Hazır" da kapalı (BAK-85). */
  partsDecisionBlocked?: boolean
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
  const [confirmCancelOpen, setConfirmCancelOpen] = useState(false)
  const statusOptions = orderStatusOptions(order.status as OrderStatus)

  // Sıradan geçişlerle "İptal" onayından gelen geçiş aynı isteği paylaşır —
  // fetch mantığı tek yerde, iki çağıran arasında kopyalanmaz.
  async function postStatusChange(next: string) {
    setChangingStatus(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/status`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: next }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
        return true
      }
      toast.error(data.error || "Durum güncellenemedi")
      return false
    } catch {
      toast.error("Bir hata oluştu")
      return false
    } finally {
      setChangingStatus(false)
    }
  }

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
    // İptal terminal ve kilitleyici bir aksiyon — sayfa başlığındaki eylem
    // haritası da (NEXT_STATUSES) bu üç durumdan doğrudan iptali esirger.
    // Tek dokunuşla yazmak yerine onay iste; POST yalnız onaylanınca gider.
    if (next === "cancelled") {
      setConfirmCancelOpen(true)
      return
    }
    await postStatusChange(next)
  }

  async function handleConfirmCancel() {
    const ok = await postStatusChange("cancelled")
    if (ok) setConfirmCancelOpen(false)
  }

  async function handleReasonSelect(next: string) {
    if (next === (order.arrivalReason ?? "")) return
    setChangingReason(true)
    try {
      const res = await fetch(`/api/orders/${order.id}/arrival-reason`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reason: next }),
      })
      const data = await res.json()
      if (data.success) {
        router.refresh()
      }
      else toast.error(data.error || "Geliş nedeni güncellenemedi")
    } catch {
      toast.error("Bir hata oluştu")
    } finally {
      setChangingReason(false)
    }
  }

  return (
    <>
      <DetailPanel title="Araç Kabul Bilgileri">
        <div className={detail.kvCols}>
          {/* SOL: mevcut iş emri kimliği ve atama bilgileri */}
          <div>
            <InfoRow label="İş No" value={order.workOrderNo} mono />
            <InfoRow label="Oluşturulma" value={formatDateTime(order.createdAt)} />
            <InfoRow
              label="Tahmini Teslim"
              value={order.estimatedDeliveryAt ? formatDateTime(order.estimatedDeliveryAt) : "—"}
            />
            {order.completedAt && (
              <InfoRow label="Tamamlanma" value={formatDateTime(order.completedAt)} />
            )}
            <DetailRow label="Atanan Usta">
              {/* Atama tek bir yerden yürür (technician-assign); burada yalnız tetikleyici durur. */}
              <TechnicianAssign
                orderId={order.id}
                assignedTechnicianId={order.assignedTechnicianId}
                assignedTechnicianName={order.assignedTechnicianName}
                technicians={technicians ?? []}
                locked={locked}
              />
            </DetailRow>
            {order.technicianName && order.technicianName !== order.assignedTechnicianName && (
              <InfoRow label="Teknisyen (eski)" value={order.technicianName} />
            )}
            {order.notes && (
              <DetailRow label="Notlar" stack>
                {order.notes}
              </DetailRow>
            )}
            <DetailRow label="Ödeme">
              <OrderPaymentPill status={order.paymentStatus} />
            </DetailRow>
          </div>

          {/* SAĞ: fatura, tutar, durum, geliş nedeni. */}
          <div>
            <DetailRow label="Fatura Numarası">
              <span className="flex items-center justify-end gap-2">
                <span className="font-mono text-sm">{order.invoiceNo || "—"}</span>
                {invoiceEditable && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        aria-label="Fatura bilgilerini düzenle"
                        onClick={startEditInvoice}
                      >
                        <Pencil className="size-3.5" />
                      </Button>
                    </TooltipTrigger>
                    <TooltipContent>Fatura bilgilerini düzenle</TooltipContent>
                  </Tooltip>
                )}
              </span>
            </DetailRow>
            <InfoRow
              label="Fatura Tarihi"
              value={order.invoiceDate ? formatDate(order.invoiceDate) : "—"}
            />
            <InfoRow
              label="Toplam Tutar"
              value={order.totals.hasAnyPrice ? formatTRY(order.totals.grandTotal) : "—"}
            />
            <DetailRow label="Durum">
              <Select value={order.status} onValueChange={handleStatusSelect} disabled={changingStatus || statusOptions.length <= 1}>
                <SelectTrigger className="w-[170px]" aria-label="Durum"><SelectValue /></SelectTrigger>
                <SelectContent>
                  {statusOptions.map((s) => (
                    <SelectItem key={s} value={s} disabled={(s === "delivered" && deliveryBlocked) || (s === "ready_for_delivery" && partsDecisionBlocked)}>
                      {ORDER_STATUS[s as OrderStatusKey]?.label ?? s}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </DetailRow>
            <DetailRow label="Servise Geliş Nedeni">
              {locked ? (
                <span>{arrivalReasonLabel(order.arrivalReason)}</span>
              ) : (
                <Select value={order.arrivalReason ?? ""} onValueChange={handleReasonSelect} disabled={changingReason}>
                  <SelectTrigger className="w-[170px]" aria-label="Servise geliş nedeni"><SelectValue placeholder="Belirtilmedi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Belirtilmedi</SelectItem>
                    {ARRIVAL_REASON_ORDER.map((r) => <SelectItem key={r} value={r}>{ARRIVAL_REASONS[r].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </DetailRow>
          </div>
        </div>
      </DetailPanel>

      <Dialog open={editingInvoice} onOpenChange={(open) => { if (!savingInvoice) setEditingInvoice(open) }}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Fatura bilgilerini düzenle</DialogTitle>
            <DialogDescription>Fatura entegrasyonu yok — bilgileri kendi fatura uygulamanızdan girin.</DialogDescription>
          </DialogHeader>
          <div className="space-y-3">
            <div className="space-y-1">
              <Label htmlFor="invoice-no">Fatura Numarası</Label>
              <Input id="invoice-no" value={invoiceNoDraft} onChange={(e) => setInvoiceNoDraft(e.target.value)} placeholder="Örn. ABC2026000000123" maxLength={50} />
            </div>
            <div className="space-y-1">
              <Label htmlFor="invoice-date">Fatura Tarihi</Label>
              <DatePicker id="invoice-date" value={invoiceDateDraft} onChange={setInvoiceDateDraft} placeholder="Tarih seçin" />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditingInvoice(false)} disabled={savingInvoice}>İptal</Button>
            <Button variant="foreground" onClick={saveInvoice} disabled={savingInvoice}>
              {savingInvoice ? <Loader2 className="size-4 animate-spin" /> : "Kaydet"}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <AlertDialog
        open={confirmCancelOpen}
        onOpenChange={(open) => {
          if (!open && !changingStatus) setConfirmCancelOpen(false)
        }}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Araç kabulü iptal edilsin mi?</AlertDialogTitle>
            <AlertDialogDescription>
              Kalemler, fiyatlar, fotoğraflar ve usta ataması kilitlenir; araç kabulü
              daha sonra &quot;Taslak&quot; seçilerek yeniden açılabilir.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={changingStatus}>Vazgeç</AlertDialogCancel>
            <AlertDialogAction onClick={handleConfirmCancel} disabled={changingStatus}>
              {changingStatus ? "İptal ediliyor…" : "İptal Et"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  )
}

function InfoRow({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <DetailRow label={label}>
      <span className={cn(mono && "font-mono text-sm")}>{value}</span>
    </DetailRow>
  )
}
