import { redirect } from "next/navigation"
import { getAppData } from "@/app/(app)/data"
import { PurchaseWizard } from "@/components/billing/purchase-wizard"
import { getHavaleInstructions } from "@/lib/billing/provider"
import { prisma } from "@/lib/db"
import type { PlanTier } from "@/lib/plan"

export const metadata = { title: "Satın Al" }

const HAVALE = getHavaleInstructions()

// Kasıtlı olarak (app) route grubunun dışında: (app)/layout.tsx'in sidebar/header/banner
// çerçevesinden ve erişim kilidinden (deneme bitti vb.) bağımsız, tam ekran bir satın alma
// akışı. Kilitli bir workshop da paketini yükseltebilsin diye bu sayfa erişim gate'ine takılmaz.
export default async function CheckoutPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string; cycle?: string }>
}) {
  const { workshop } = await getAppData()
  const sp = await searchParams
  const hasExplicitTier = ["starter", "pro", "premium"].includes(sp.tier ?? "")
  const tier = (hasExplicitTier ? sp.tier : "pro") as PlanTier
  const cycle = (sp.cycle === "yearly" ? "yearly" : "monthly") as "monthly" | "yearly"
  const ownedTier = workshop?.subscriptionStatus === "active" ? (workshop.planTier as PlanTier) : null
  // Sahip olunan pakete talep atlanarak (adım 1'e geçilerek) gelinmesin — adım 0'da
  // "Mevcut paketiniz" olarak kilitli görünsün ve kullanıcı başka bir paket seçsin.
  const skipPackageStep = hasExplicitTier && tier !== ownedTier

  // createBillingOrder da aynı kuralı sunucu tarafında zorunlu kılar; bu yalnızca
  // sihirbazın 3 adımını doldurup sonda reddedilmek yerine erken ve net bir mesaj verir.
  const pendingOrder = workshop
    ? await prisma.billingOrder.findFirst({
        where: { workshopId: workshop.id, status: "pending_payment" },
        orderBy: { createdAt: "desc" },
      })
    : null

  // Ayrı, bağlamsız bir "kilitli" sayfada bırakmak yerine /billing'e yönlendirip
  // orada bir AlertDialog ile bilgilendiriyoruz (bkz. PendingOrderAlert).
  if (pendingOrder) {
    redirect("/billing?pendingBlocked=1")
  }

  return (
    <main className="min-h-[100dvh] bg-background">
      <PurchaseWizard
        mode="inapp"
        initialTier={tier}
        initialCycle={cycle}
        initialStep={skipPackageStep ? 1 : 0}
        ownedTier={ownedTier}
        havale={HAVALE}
        defaultInvoiceTitle={workshop?.invoiceTitle || workshop?.name || ""}
      />
    </main>
  )
}
