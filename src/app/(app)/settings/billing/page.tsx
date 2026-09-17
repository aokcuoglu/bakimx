import Link from "next/link"
import { CreditCard, Pencil } from "lucide-react"
import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import { BillingPlanManager } from "@/components/billing/billing-plan-manager"
import { BillingUsagePanel } from "@/components/billing/billing-usage-panel"
import { PendingOrderAlert } from "@/components/billing/pending-order-alert"
import { PendingPaymentNotice } from "@/components/billing/pending-payment-notice"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { getAccountBillingContext } from "@/lib/billing/account-context"
import { formatMinor } from "@/lib/billing/pricing"
import { getHavaleInstructions } from "@/lib/billing/provider"
import { prisma } from "@/lib/db"
import { isLiteRegistrationOpen } from "@/lib/lite-campaign"
import { getPlanPackage } from "@/lib/plans-catalog"
import { getWorkshopQuotaContext, getWorkshopQuotaUsage } from "@/lib/rapidapi-quota"

export const metadata = { title: "Faturalandırma" }

function formatDate(date: Date | null): string {
  return date ? new Intl.DateTimeFormat("tr-TR", { day: "numeric", month: "long", year: "numeric" }).format(date) : "—"
}

export default async function SettingsBillingPage({ searchParams }: {
  searchParams: Promise<{ pendingBlocked?: string }>
}) {
  const { user, workshop, plan, ownedTier, planName, pendingOrder, seatUsage, canPurchase } = await getAccountBillingContext()
  const sp = await searchParams
  const [quota, orders] = await Promise.all([
    getWorkshopQuotaUsage(getWorkshopQuotaContext(workshop)),
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
      <div className="space-y-8">
        {plan.isTrialing && (
          <div className="hidden flex-wrap items-center justify-between gap-3 rounded-lg border border-primary/20 bg-primary/10 px-4 py-3 text-sm text-primary-strong lg:flex">
            <p>Premium denemeniz {formatDate(plan.trialEndsAt)} tarihinde bitiyor. {plan.trialDaysLeft ?? 0} iş günü kaldı; otomatik ücretlendirme yapılmaz.</p>
            <Button asChild variant="outline" size="compact"><Link href="/settings/plans">Paketleri incele</Link></Button>
          </div>
        )}
        {pendingOrder && <PendingPaymentNotice order={pendingOrder} />}

        <div className="space-y-4">
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
            canPurchase={canPurchase}
            liteRegistrationOpen={isLiteRegistrationOpen()}
            liteFreeGranted={!!workshop.liteFreeGrantedAt}
            defaultInvoiceTitle={workshop.invoiceTitle || workshop.name}
            defaultTaxNumber={workshop.taxNumber || ""}
            defaultTaxOffice={workshop.taxOffice || ""}
            seatUsage={seatUsage}
            extraSeats={Math.max(0, workshop.extraSeats)}
            havale={getHavaleInstructions()}
            showComparison={false}
            explorePlansHref="/settings/plans"
          />
          <BillingUsagePanel plan={plan} seatUsage={seatUsage} extraSeats={Math.max(0, workshop.extraSeats)} quota={quota} canPurchase={canPurchase} />
        </div>

        <section aria-labelledby="fatura-bilgileri-baslik" className="space-y-4">
          <div>
            <h2 id="fatura-bilgileri-baslik" className="text-lg font-semibold">Fatura bilgileri</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Siparişlerde kullanılan güncel iş yeri ve ödeme bilgileri.</p>
          </div>
          <div className="grid gap-4 md:grid-cols-2">
            <div className="rounded-xl border bg-card p-5 sm:p-6">
              <div className="flex items-start justify-between gap-3">
                <h3 className="font-semibold">Fatura adresi</h3>
                {canPurchase && <Button asChild variant="ghost" size="icon-sm"><Link href="/settings/general" aria-label="Fatura bilgilerini düzenle"><Pencil className="size-4" /></Link></Button>}
              </div>
              <dl className="mt-5 grid grid-cols-[auto_minmax(0,1fr)] gap-x-5 gap-y-3 text-sm">
                <dt className="text-muted-foreground">Ünvan</dt><dd className="min-w-0 break-words text-right font-medium">{workshop.invoiceTitle || workshop.name}</dd>
                <dt className="text-muted-foreground">E-posta</dt><dd className="min-w-0 break-words text-right">{workshop.email || user.email || "Belirtilmedi"}</dd>
                <dt className="text-muted-foreground">Adres</dt><dd className="min-w-0 break-words text-right">{workshop.address}, {workshop.city}</dd>
                <dt className="text-muted-foreground">Vergi/TC no</dt><dd className="min-w-0 break-words text-right">{workshop.taxNumber || "Belirtilmedi"}</dd>
                <dt className="text-muted-foreground">Vergi dairesi</dt><dd className="min-w-0 break-words text-right">{workshop.taxOffice || "Belirtilmedi"}</dd>
              </dl>
            </div>
            <div className="rounded-xl border bg-card p-5 sm:p-6">
              <h3 className="flex items-center gap-2 font-semibold"><CreditCard className="size-4 text-muted-foreground" aria-hidden="true" /> Ödeme</h3>
              <p className="mt-5 text-sm font-medium">Kayıtlı ödeme yöntemi yok</p>
              <p className="mt-2 text-sm leading-6 text-muted-foreground">Kart bilgileri saklanmaz. Paket seçerken kart veya Havale/EFT ile ödeme başlatabilirsiniz.</p>
              {canPurchase && <Button asChild variant="outline" size="sm" className="mt-4"><Link href="/settings/plans">Paketleri incele</Link></Button>}
            </div>
          </div>
        </section>

        <section aria-labelledby="odeme-gecmisi-baslik" className="space-y-4">
          <div>
            <h2 id="odeme-gecmisi-baslik" className="text-lg font-semibold">Ödeme geçmişi</h2>
            <p className="mt-0.5 text-sm text-muted-foreground">Onaylanmış son 20 sipariş ve ödeme makbuzları.</p>
          </div>
          <div className="overflow-hidden rounded-xl border bg-card">
            {orders.length === 0 ? (
              <p className="px-5 py-10 text-center text-sm text-muted-foreground">Henüz onaylanmış bir ödeme bulunmuyor.</p>
            ) : (
              <Table aria-label="Ödeme geçmişi">
                <TableHeader><TableRow>
                  <TableHead scope="col" className="px-5">Referans</TableHead>
                  <TableHead scope="col">Paket</TableHead>
                  <TableHead scope="col">Tarih</TableHead>
                  <TableHead scope="col">Yöntem</TableHead>
                  <TableHead scope="col" className="text-right">Tutar</TableHead>
                  <TableHead scope="col" className="px-5 text-right">Makbuz</TableHead>
                </TableRow></TableHeader>
                <TableBody>{orders.map((order) => <TableRow key={order.id}>
                  <TableCell className="px-5 font-mono text-xs">{order.reference}</TableCell>
                  <TableCell>{getPlanPackage(order.planTier)?.name ?? order.planTier}</TableCell>
                  <TableCell>{formatDate(order.confirmedAt)}</TableCell>
                  <TableCell><Badge variant="outline">{order.method === "card" ? "Kart" : order.method === "havale" ? "Havale/EFT" : "Manuel"}</Badge></TableCell>
                  <TableCell className="text-right font-medium">{formatMinor(order.amountMinor)}</TableCell>
                  <TableCell className="px-5 text-right"><Button asChild variant="ghost" size="compact"><Link href={`/api/billing/orders/${order.id}/receipt`} target="_blank" rel="noopener noreferrer">Görüntüle</Link></Button></TableCell>
                </TableRow>)}</TableBody>
              </Table>
            )}
          </div>
        </section>
      </div>
    </AppShell>
  )
}
