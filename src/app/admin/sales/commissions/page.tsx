import Link from "next/link"
import { ArrowLeft, Settings2, WalletCards } from "lucide-react"
import type { SalesCommissionStatus } from "@prisma/client"
import { prisma } from "@/lib/db"
import { canAccessSales, getSalesAccess } from "@/lib/sales/access"
import { formatMinor } from "@/lib/billing/pricing"
import { Button } from "@/components/ui/button"
import { CommissionLedger } from "@/components/sales/commission-ledger"

export const dynamic = "force-dynamic"

const STATUSES = ["draft", "approved", "paid", "void"] as const satisfies readonly SalesCommissionStatus[]
const STATUS_LABELS: Record<SalesCommissionStatus, string> = {
  draft: "Taslak",
  approved: "Onaylı",
  paid: "Ödenmiş",
  void: "İptal",
}

export default async function SalesCommissionsPage({
  searchParams,
}: {
  searchParams: Promise<{ status?: string | string[] }>
}) {
  const access = await getSalesAccess("viewSalesCommissions")
  const canManage = canAccessSales(access, "manageSalesCommissions")
  const requestedStatus = (await searchParams).status
  const status = typeof requestedStatus === "string" && STATUSES.includes(requestedStatus as SalesCommissionStatus)
    ? requestedStatus as SalesCommissionStatus
    : null

  const commissions = await prisma.salesCommission.findMany({
    where: {
      ...(access.kind === "advisor" ? { advisorId: access.advisorId } : {}),
      ...(status ? { status } : {}),
    },
    orderBy: [{ billingOrder: { confirmedAt: "desc" } }, { createdAt: "desc" }],
    take: 250,
    select: {
      id: true,
      status: true,
      calculationBaseMinor: true,
      calculationRateBps: true,
      calculatedAmountMinor: true,
      approvedAmountMinor: true,
      reviewReason: true,
      adjustmentReason: true,
      note: true,
      approvedAt: true,
      paidAt: true,
      voidedAt: true,
      createdAt: true,
      lead: { select: { businessName: true } },
      advisor: { select: { user: { select: { firstName: true, lastName: true, email: true } } } },
      rule: { select: { id: true, effectiveFrom: true } },
      billingOrder: {
        select: {
          reference: true,
          type: true,
          planTier: true,
          billingCycle: true,
          vatRateBps: true,
          grossAmountMinor: true,
          netAmountMinor: true,
          confirmedAt: true,
          workshop: { select: { name: true } },
        },
      },
      events: {
        orderBy: { createdAt: "desc" },
        take: 12,
        select: {
          id: true,
          fromStatus: true,
          toStatus: true,
          actorLabel: true,
          amountMinor: true,
          reason: true,
          createdAt: true,
        },
      },
    },
  })

  const calculatedTotal = commissions.reduce((sum, row) => sum + (row.calculatedAmountMinor ?? 0), 0)
  const approvedTotal = commissions.reduce(
    (sum, row) => sum + (["approved", "paid"].includes(row.status) ? row.approvedAmountMinor ?? 0 : 0),
    0,
  )
  const paidTotal = commissions.reduce(
    (sum, row) => sum + (row.status === "paid" ? row.approvedAmountMinor ?? 0 : 0),
    0,
  )

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <Button asChild variant="ghost" size="sm" className="-ml-3 mb-2">
            <Link href="/admin/sales"><ArrowLeft className="size-4" /> Satış merkezine dön</Link>
          </Button>
          <h1 className="flex items-center gap-2 text-2xl font-bold tracking-tight text-foreground">
            <WalletCards className="size-6 text-primary" /> Hakediş ledger’ı
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            KDV hariç tahsilat, hesaplama snapshot’ı ve durum geçmişi birlikte izlenir.
          </p>
        </div>
        {canManage && (
          <Button asChild variant="outline">
            <Link href="/admin/sales/settings"><Settings2 className="size-4" /> Hakediş kuralları</Link>
          </Button>
        )}
      </div>

      <section aria-label="Hakediş toplamları" className="grid gap-3 sm:grid-cols-3">
        <Metric label="Hesaplanan" value={formatMinor(calculatedTotal)} />
        <Metric label="Onaylanan" value={formatMinor(approvedTotal)} />
        <Metric label="Ödenen" value={formatMinor(paidTotal)} />
      </section>

      <div className="flex flex-wrap gap-2" aria-label="Hakediş durum filtresi">
        <Button asChild size="sm" variant={status === null ? "default" : "outline"}>
          <Link href="/admin/sales/commissions">Tümü</Link>
        </Button>
        {STATUSES.map((item) => (
          <Button key={item} asChild size="sm" variant={status === item ? "default" : "outline"}>
            <Link href={`/admin/sales/commissions?status=${item}`}>{STATUS_LABELS[item]}</Link>
          </Button>
        ))}
      </div>

      <CommissionLedger
        canManage={canManage}
        commissions={commissions.map((row) => ({
          id: row.id,
          status: row.status,
          calculationBaseMinor: row.calculationBaseMinor,
          calculationRateBps: row.calculationRateBps,
          calculatedAmountMinor: row.calculatedAmountMinor,
          approvedAmountMinor: row.approvedAmountMinor,
          reviewReason: row.reviewReason,
          adjustmentReason: row.adjustmentReason,
          note: row.note,
          businessName: row.lead.businessName,
          workshopName: row.billingOrder.workshop.name,
          advisorName: [row.advisor.user.firstName, row.advisor.user.lastName].filter(Boolean).join(" ") || row.advisor.user.email || "—",
          createdAt: row.createdAt.toISOString(),
          approvedAt: row.approvedAt?.toISOString() ?? null,
          paidAt: row.paidAt?.toISOString() ?? null,
          voidedAt: row.voidedAt?.toISOString() ?? null,
          ruleEffectiveFrom: row.rule?.effectiveFrom.toISOString() ?? null,
          confirmedAt: row.billingOrder.confirmedAt?.toISOString() ?? null,
          billingOrder: {
            reference: row.billingOrder.reference,
            type: row.billingOrder.type,
            planTier: row.billingOrder.planTier,
            billingCycle: row.billingOrder.billingCycle,
            vatRateBps: row.billingOrder.vatRateBps,
            grossAmountMinor: row.billingOrder.grossAmountMinor,
            netAmountMinor: row.billingOrder.netAmountMinor,
          },
          events: row.events.map((event) => ({ ...event, createdAt: event.createdAt.toISOString() })),
        }))}
      />
    </div>
  )
}

function Metric({ label, value }: { label: string; value: string }) {
  return (
    <article className="rounded-xl border bg-card p-4">
      <p className="text-xs font-medium text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-bold tabular-nums text-foreground">{value}</p>
    </article>
  )
}
