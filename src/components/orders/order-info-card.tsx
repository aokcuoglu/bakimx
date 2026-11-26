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
import { DetailPanel, DetailRow, detail } from "@/components/orders/order-detail-surface"
import { formatDate, formatDateTime } from "@/lib/utils-client"
import { ARRIVAL_REASON_ORDER, ARRIVAL_REASONS, arrivalReasonLabel } from "@/lib/constants"
import { isOrderLocked } from "@/lib/status-transitions"
import type { OrderStatus } from "@prisma/client"
import { cn } from "@/lib/utils"
import { Loader2, Pencil } from "lucide-react"
import type { OrderDetailData } from "@/components/orders/order-management-panel"

/**
 * "Araç Kabul Bilgileri" — yalnız başlıkta OLMAYAN kabul bilgileri (#912):
 * iş no, tarihler, notlar, fatura ve geliş nedeni. Durum, ödeme, atanan usta
 * ve toplam başlıkta / raydaki Ödeme kartında; burada tekrar etmez. Durum
 * yalnız başlık aksiyonlarından değişir (iptal onayı orada).
 */
export function OrderInfoCard({ order }: { order: OrderDetailData }) {
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

  const [changingReason, setChangingReason] = useState(false)

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
        <div className={detail.kvWrap}>
        <div className={detail.kvCols}>
          {/* SOL: iş emri kimliği, tarihler, notlar */}
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
            {order.technicianName && order.technicianName !== order.assignedTechnicianName && (
              <InfoRow label="Teknisyen (eski)" value={order.technicianName} />
            )}
            {order.notes && (
              <DetailRow label="Notlar" stack>
                {order.notes}
              </DetailRow>
            )}
          </div>

          {/* SAĞ: fatura ve geliş nedeni. */}
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
            <DetailRow label="Servise Geliş Nedeni">
              {locked ? (
                <span>{arrivalReasonLabel(order.arrivalReason)}</span>
              ) : (
                <Select value={order.arrivalReason ?? ""} onValueChange={handleReasonSelect} disabled={changingReason}>
                  <SelectTrigger className="w-full max-w-[170px] min-w-0" aria-label="Servise geliş nedeni"><SelectValue placeholder="Belirtilmedi" /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value="">Belirtilmedi</SelectItem>
                    {ARRIVAL_REASON_ORDER.map((r) => <SelectItem key={r} value={r}>{ARRIVAL_REASONS[r].label}</SelectItem>)}
                  </SelectContent>
                </Select>
              )}
            </DetailRow>
          </div>
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
