"use client"

import { useTransition } from "react"
import { z } from "zod"
import { useForm } from "react-hook-form"
import { zodResolver } from "@hookform/resolvers/zod"
import { toast } from "sonner"
import { AlertTriangle, CheckCircle2, CircleDollarSign, History, XCircle } from "lucide-react"
import type { BillingCycle, BillingOrderType, PlanTier, SalesCommissionReviewReason, SalesCommissionStatus } from "@prisma/client"
import {
  approveSalesCommission,
  markSalesCommissionPaid,
  voidSalesCommission,
} from "@/app/admin/sales/commissions/actions"
import { formatMinor } from "@/lib/billing/pricing"
import { salesCommissionApprovalSchema, salesCommissionVoidSchema } from "@/lib/validations/sales"
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card"
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form"
import { Input } from "@/components/ui/input"
import { Textarea } from "@/components/ui/textarea"

type Event = {
  id: string
  fromStatus: SalesCommissionStatus | null
  toStatus: SalesCommissionStatus
  actorLabel: string
  amountMinor: number | null
  reason: string | null
  createdAt: string
}

type Commission = {
  id: string
  status: SalesCommissionStatus
  calculationBaseMinor: number | null
  calculationRateBps: number | null
  calculatedAmountMinor: number | null
  approvedAmountMinor: number | null
  reviewReason: SalesCommissionReviewReason | null
  adjustmentReason: string | null
  note: string | null
  approvedAt: string | null
  paidAt: string | null
  voidedAt: string | null
  createdAt: string
  businessName: string
  workshopName: string
  advisorName: string
  ruleEffectiveFrom: string | null
  confirmedAt: string | null
  events: Event[]
  billingOrder: {
    reference: string
    type: BillingOrderType
    planTier: PlanTier
    billingCycle: BillingCycle
    vatRateBps: number
    grossAmountMinor: number
    netAmountMinor: number
  }
}

const STATUS_LABELS: Record<SalesCommissionStatus, string> = {
  draft: "Taslak",
  approved: "Onaylı",
  paid: "Ödenmiş",
  void: "İptal",
}
const TYPE_LABELS: Record<BillingOrderType, string> = {
  new_purchase: "İlk satış",
  upgrade: "Yükseltme",
  downgrade: "Paket düşürme",
  renewal: "Yenileme",
}
const PLAN_LABELS: Record<PlanTier, string> = {
  lite: "Lite",
  starter: "Başlangıç",
  pro: "Profesyonel",
  premium: "Premium",
}

export function CommissionLedger({
  commissions,
  canManage,
}: {
  commissions: Commission[]
  canManage: boolean
}) {
  if (commissions.length === 0) {
    return (
      <div className="rounded-xl border border-dashed bg-card p-8 text-center">
        <CircleDollarSign className="mx-auto size-8 text-muted-foreground" />
        <p className="mt-3 font-medium text-foreground">Bu filtrede hakediş yok</p>
        <p className="mt-1 text-sm text-muted-foreground">İlk satış veya gerçek paket yükseltmesi onaylandığında ledger satırı oluşur.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {commissions.map((commission) => (
        <CommissionCard key={commission.id} commission={commission} canManage={canManage} />
      ))}
    </div>
  )
}

function CommissionCard({ commission, canManage }: { commission: Commission; canManage: boolean }) {
  const [pending, startTransition] = useTransition()

  const markPaid = () => startTransition(async () => {
    const result = await markSalesCommissionPaid(commission.id)
    if (!result.ok) toast.error(result.error)
    else toast.success("Hakediş ödendi olarak işaretlendi.")
  })

  return (
    <Card>
      <CardHeader className="gap-3">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <CardTitle>{commission.businessName}</CardTitle>
            <CardDescription>{commission.advisorName} · {commission.billingOrder.reference}</CardDescription>
          </div>
          <Badge variant={commission.status === "void" ? "destructive" : commission.status === "paid" ? "default" : "secondary"}>
            {STATUS_LABELS[commission.status]}
          </Badge>
        </div>
      </CardHeader>
      <CardContent className="space-y-5">
        {commission.reviewReason === "missing_rule" && (
          <Alert variant="destructive">
            <AlertTriangle className="size-4" />
            <AlertTitle>Kural eksik</AlertTitle>
            <AlertDescription>Sipariş tarihinde bu paket ve dönem için geçerli yüzde yoktu. Ödeme tamamlandı; manuel onay için tutar ve gerekçe girilmelidir.</AlertDescription>
          </Alert>
        )}
        {commission.reviewReason === "legacy_manual" && (
          <Alert>
            <History className="size-4" />
            <AlertTitle>Eski manuel kayıt</AlertTitle>
            <AlertDescription>Migration bu kaydın mevcut tutarını değiştirmeden korudu; hesaplama snapshot’ı bulunmuyor.</AlertDescription>
          </Alert>
        )}

        <dl className="grid gap-3 text-sm sm:grid-cols-2 lg:grid-cols-4">
          <Value label="Sipariş" value={`${TYPE_LABELS[commission.billingOrder.type]} · ${PLAN_LABELS[commission.billingOrder.planTier]} · ${commission.billingOrder.billingCycle === "monthly" ? "Aylık" : "Yıllık"}`} />
          <Value label="KDV dahil tahsilat" value={formatMinor(commission.billingOrder.grossAmountMinor)} />
          <Value label={`KDV hariç baz · %${commission.billingOrder.vatRateBps / 100} KDV`} value={formatMinor(commission.calculationBaseMinor ?? commission.billingOrder.netAmountMinor)} />
          <Value label="Hesaplanan hakediş" value={commission.calculatedAmountMinor == null ? "Kural eksik" : formatMinor(commission.calculatedAmountMinor)} />
          <Value label="Snapshot oran" value={commission.calculationRateBps == null ? "—" : `%${(commission.calculationRateBps / 100).toLocaleString("tr-TR")}`} />
          <Value label="Onaylanan" value={commission.approvedAmountMinor == null ? "—" : formatMinor(commission.approvedAmountMinor)} />
          <Value label="Ödeme onayı" value={commission.confirmedAt ? formatDateTime(commission.confirmedAt) : "—"} />
          <Value label="İş yeri" value={commission.workshopName} />
        </dl>

        {commission.adjustmentReason && (
          <div className="rounded-lg bg-muted p-3 text-sm">
            <span className="font-medium text-foreground">Düzeltme gerekçesi:</span>{" "}
            <span className="text-muted-foreground-strong">{commission.adjustmentReason}</span>
          </div>
        )}

        {canManage && commission.status === "draft" && (
          <div className="grid gap-4 border-t pt-5 lg:grid-cols-[minmax(0,2fr)_minmax(16rem,1fr)]">
            <ApprovalForm commission={commission} pending={pending} startTransition={startTransition} />
            <VoidForm commissionId={commission.id} pending={pending} startTransition={startTransition} />
          </div>
        )}
        {canManage && commission.status === "approved" && (
          <div className="flex flex-col gap-4 border-t pt-5 lg:flex-row lg:items-end">
            <Button type="button" disabled={pending} onClick={markPaid}>
              <CheckCircle2 className="size-4" /> Ödendi işaretle
            </Button>
            <div className="flex-1"><VoidForm commissionId={commission.id} pending={pending} startTransition={startTransition} /></div>
          </div>
        )}

        <details className="border-t pt-4">
          <summary className="cursor-pointer text-sm font-medium text-foreground">Durum geçmişi ({commission.events.length})</summary>
          <ol className="mt-3 space-y-3">
            {commission.events.map((event) => (
              <li key={event.id} className="border-l-2 border-border pl-3 text-sm">
                <p className="font-medium text-foreground">{STATUS_LABELS[event.toStatus]} · {event.actorLabel}</p>
                <p className="text-muted-foreground">{formatDateTime(event.createdAt)}{event.amountMinor == null ? "" : ` · ${formatMinor(event.amountMinor)}`}</p>
                {event.reason && <p className="mt-1 text-muted-foreground">{event.reason}</p>}
              </li>
            ))}
          </ol>
        </details>
      </CardContent>
    </Card>
  )
}

function ApprovalForm({
  commission,
  pending,
  startTransition,
}: {
  commission: Commission
  pending: boolean
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const form = useForm<z.infer<typeof salesCommissionApprovalSchema>>({
    resolver: zodResolver(salesCommissionApprovalSchema),
    defaultValues: {
      approvedAmountMinor: commission.approvedAmountMinor ?? commission.calculatedAmountMinor ?? 0,
      adjustmentReason: commission.adjustmentReason ?? "",
      note: commission.note ?? "",
    },
  })

  const submit = form.handleSubmit((values) => startTransition(async () => {
    const result = await approveSalesCommission(commission.id, values)
    if (!result.ok) toast.error(result.error)
    else toast.success("Hakediş onaylandı.")
  }))

  return (
    <Form {...form}>
      <form onSubmit={submit} className="grid gap-3 sm:grid-cols-2">
        <FormField control={form.control} name="approvedAmountMinor" render={({ field }) => (
          <FormItem>
            <FormLabel>Onaylanan tutar (TL)</FormLabel>
            <FormControl>
              <Input
                inputMode="decimal"
                value={(field.value / 100).toString()}
                onChange={(event) => {
                  const lira = Number(event.target.value.replace(",", "."))
                  field.onChange(Number.isFinite(lira) ? Math.round(lira * 100) : 0)
                }}
              />
            </FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="adjustmentReason" render={({ field }) => (
          <FormItem>
            <FormLabel>Düzeltme gerekçesi</FormLabel>
            <FormControl><Input {...field} placeholder="Tutar değişiyorsa zorunlu" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <FormField control={form.control} name="note" render={({ field }) => (
          <FormItem className="sm:col-span-2">
            <FormLabel>İç not</FormLabel>
            <FormControl><Textarea {...field} rows={2} /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <div className="sm:col-span-2">
          <Button type="submit" disabled={pending}>Hakedişi onayla</Button>
        </div>
      </form>
    </Form>
  )
}

function VoidForm({
  commissionId,
  pending,
  startTransition,
}: {
  commissionId: string
  pending: boolean
  startTransition: ReturnType<typeof useTransition>[1]
}) {
  const form = useForm<z.infer<typeof salesCommissionVoidSchema>>({
    resolver: zodResolver(salesCommissionVoidSchema),
    defaultValues: { reason: "" },
  })
  const submit = form.handleSubmit((values) => startTransition(async () => {
    const result = await voidSalesCommission(commissionId, values)
    if (!result.ok) toast.error(result.error)
    else toast.success("Hakediş iptal edildi.")
  }))

  return (
    <Form {...form}>
      <form onSubmit={submit} className="flex flex-col gap-2 sm:flex-row sm:items-end">
        <FormField control={form.control} name="reason" render={({ field }) => (
          <FormItem className="flex-1">
            <FormLabel>İptal gerekçesi</FormLabel>
            <FormControl><Input {...field} placeholder="Zorunlu" /></FormControl>
            <FormMessage />
          </FormItem>
        )} />
        <Button type="submit" variant="outline" disabled={pending}>
          <XCircle className="size-4" /> İptal et
        </Button>
      </form>
    </Form>
  )
}

function Value({ label, value }: { label: string; value: string }) {
  return <div><dt className="text-xs text-muted-foreground">{label}</dt><dd className="mt-1 font-medium text-foreground">{value}</dd></div>
}

function formatDateTime(value: string) {
  return new Date(value).toLocaleString("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" })
}
