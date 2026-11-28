import Link from "next/link"
import { Pencil, Plus } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { BillingPlanManager } from "@/components/billing/billing-plan-manager"
import { PendingOrderAlert } from "@/components/billing/pending-order-alert"
import { PendingPaymentNotice } from "@/components/billing/pending-payment-notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAccountBillingContext } from "@/lib/billing/account-context"
import { formatMinor } from "@/lib/billing/pricing"
import { getHavaleInstructions } from "@/lib/billing/provider"
import { prisma } from "@/lib/db"
import { formatTrLongDate } from "@/lib/format-date"
import { describeBillingOrder } from "@/lib/billing/addon-pricing"
import { TRIAL_INCLUDES_ADDONS } from "@/lib/plan"
import { getReferralDiscountBps } from "@/lib/billing/referral-discount"
import { resolveWorkshopQuotaContext, getWorkshopQuotaUsage } from "@/lib/rapidapi-quota"
import { Alert } from "@/components/ui/alert"

export const metadata = { title: "Faturalandırma" }

function formatDate(date: Date | null): string {
  return date ? formatTrLongDate(date) : "—"
}

export default async function SettingsBillingPage({ searchParams }: {
  searchParams: Promise<{ pendingBlocked?: string }>
}) {
  const { user, workshop, plan, ownedTier, planName, pendingOrder, seatUsage, canPurchase, paidAddonKeys } = await getAccountBillingContext()
  const sp = await searchParams
  const [quota, orders] = await Promise.all([
    resolveWorkshopQuotaContext(workshop).then((context) => getWorkshopQuotaUsage(context)),
    prisma.billingOrder.findMany({
      where: { workshopId: workshop.id, status: "confirmed" },
      orderBy: { confirmedAt: "desc" },
      take: 20,
    }),
  ])

  return (
    <AppShell pageTitle="Faturalandırma" wide workshopName={workshop.name}>
      {sp.pendingBlocked === "1" && pendingOrder && <PendingOrderAlert reference={pendingOrder.reference} method={pendingOrder.method} />}
      <SettingsPageHeader
        title="Faturalandırma"
        description="Aboneliğinizi, kullanımınızı, fatura bilgilerinizi ve ödeme geçmişinizi izleyin."
      />
      <div className="space-y-7">
        {plan.isTrialing && (
          <Alert variant="info" role="status" className="hidden flex-wrap items-center justify-between gap-3 lg:flex">
            <p>Ücretsiz denemeniz {formatDate(plan.trialEndsAt)} tarihinde bitiyor. {plan.trialDaysLeft ?? 0} iş günü kaldı{TRIAL_INCLUDES_ADDONS ? "; deneme süresince ek özellikler de açık" : ""}; otomatik ücretlendirme yapılmaz.</p>
            <Button asChild variant="outline" size="compact"><Link href="/settings/plans">Paketi incele</Link></Button>
          </Alert>
        )}
        {pendingOrder && <PendingPaymentNotice canPurchase={canPurchase} order={{
          type: pendingOrder.type,
          addonLines: pendingOrder.addonLines,
          planTier: pendingOrder.planTier,
          billingCycle: pendingOrder.billingCycle,
          amountMinor: pendingOrder.amountMinor,
          method: pendingOrder.method,
          reference: pendingOrder.reference,
        }} />}

        <div className="overflow-hidden rounded-xl border bg-card">
          <BillingPlanManager
            ownedTier={ownedTier}
            currentPlanName={planName}
            currentCycle={workshop.billingCycle}
            isTrialing={plan.isTrialing}
            trialDaysLeft={plan.trialDaysLeft}
            workshopName={workshop.name}
            hasPendingOrder={!!pendingOrder}
            pendingReference={pendingOrder?.reference}
            pendingMethod={pendingOrder?.method}
            pendingAmountMinor={pendingOrder?.amountMinor}
            pendingPlanTier={pendingOrder?.planTier}
            pendingCycle={pendingOrder?.billingCycle}
            canPurchase={canPurchase}
            defaultInvoiceTitle={workshop.invoiceTitle || workshop.name}
            defaultTaxNumber={workshop.taxNumber || ""}
            defaultTaxOffice={workshop.taxOffice || ""}
            seatUsage={seatUsage}
            extraSeats={Math.max(0, workshop.extraSeats)}
            havale={getHavaleInstructions()}
            currentPeriodEnd={workshop.currentPeriodEnd}
            referralDiscountBps={getReferralDiscountBps(workshop)}
            paidAddonKeys={paidAddonKeys}
            usage={{ plan, quota }}
            showComparison={false}
            explorePlansHref="/settings/plans"
          />
        </div>

        <section aria-labelledby="fatura-bilgileri-baslik" className="space-y-3">
          <div>
            <h2 id="fatura-bilgileri-baslik" className="text-sm font-semibold">Fatura bilgileri</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Siparişlerde kullanılan güncel iş yeri ve ödeme bilgileri.</p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="min-h-56 rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-sm font-semibold">Adres</h3><p className="text-xs text-muted-foreground">Fatura adresinizi güncelleyin</p></div>
                {canPurchase && <Button asChild variant="ghost" size="icon-sm"><Link href="/settings/general" aria-label="Fatura bilgilerini düzenle"><Pencil className="size-4" /></Link></Button>}
              </div>
              <dl className="mt-4 grid grid-cols-[minmax(0,0.9fr)_minmax(0,1.1fr)] gap-x-3 gap-y-3 text-xs">
                <dt className="text-muted-foreground">E-posta</dt><dd className="min-w-0 break-words font-medium">{workshop.email || user.email || "Belirtilmedi"}</dd>
                <dt className="text-muted-foreground">Ünvan</dt><dd className="min-w-0 break-words font-medium">{workshop.invoiceTitle || workshop.name}</dd>
                <dt className="text-muted-foreground">Adres</dt><dd className="min-w-0 break-words font-medium">{[workshop.address, workshop.city].filter(Boolean).join(", ") || "Belirtilmedi"}</dd>
                <dt className="text-muted-foreground">Vergi/TC no</dt><dd className="min-w-0 break-words font-medium">{workshop.taxNumber || "Belirtilmedi"}</dd>
                <dt className="text-muted-foreground">Vergi dairesi</dt><dd className="min-w-0 break-words font-medium">{workshop.taxOffice || "Belirtilmedi"}</dd>
              </dl>
            </div>
            <div className="min-h-56 rounded-xl border bg-card p-3">
              <div className="flex items-start justify-between gap-3">
                <div><h3 className="text-sm font-semibold">Ödeme</h3><p className="text-xs text-muted-foreground">Ödeme yöntemlerinizi yönetin</p></div>
                {canPurchase && <Button asChild variant="outline" size="icon-sm"><Link href="/settings/plans" aria-label="Ödeme başlat"><Plus className="size-4" /></Link></Button>}
              </div>
              <p className="mt-5 text-xs text-muted-foreground">Kayıtlı ödeme yöntemi yok. Kart bilgileri saklanmaz; paket seçerken kart veya Havale/EFT ile ödeme başlatabilirsiniz.</p>
            </div>
          </div>
        </section>

        <section aria-labelledby="odeme-gecmisi-baslik" className="space-y-3">
          <div>
            <h2 id="odeme-gecmisi-baslik" className="text-sm font-semibold">Ödeme geçmişi</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Onaylanmış son 20 sipariş ve ödeme makbuzları.</p>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            {orders.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Henüz onaylanmış bir ödeme bulunmuyor.</p>
            ) : (
              <Table aria-label="Ödeme geçmişi">
                <TableHeader><TableRow>
                  <TableHead scope="col" className="px-3">Referans</TableHead>
                  <TableHead scope="col">KDV dahil tutar</TableHead>
                  <TableHead scope="col">Tarih</TableHead>
                  <TableHead scope="col" className="px-3 text-right">Durum</TableHead>
                </TableRow></TableHeader>
                <TableBody>{orders.map((order) => <TableRow key={order.id}>
                  <TableCell className="px-3"><span className="block font-mono text-xs">{order.reference}</span><span className="text-xs text-muted-foreground">{describeBillingOrder(order).title} · {order.method === "card" ? "Kart" : order.method === "havale" ? "Havale/EFT" : "Manuel"}</span></TableCell>
                  <TableCell className="font-medium">{formatMinor(order.amountMinor)}</TableCell>
                  <TableCell>{formatDate(order.confirmedAt)}</TableCell>
                  <TableCell className="px-3 text-right"><Badge variant="success-tint">Ödendi</Badge><Button asChild variant="ghost" size="compact"><Link href={`/api/billing/orders/${order.id}/receipt`} target="_blank" rel="noopener noreferrer">Makbuz</Link></Button></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
