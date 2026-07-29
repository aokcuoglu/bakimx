import { Clock } from "lucide-react"
import { redirect } from "next/navigation"
import { getAppData } from "@/app/(app)/data"
import { PurchaseWizard } from "@/components/billing/purchase-wizard"
import { formatMinor } from "@/lib/billing/pricing"
import { getHavaleInstructions } from "@/lib/billing/provider"
import { prisma } from "@/lib/db"
import { getPlanPackage } from "@/lib/plans-catalog"
import { getPlanState, isPlanExpiredLock, type PlanTier } from "@/lib/plan"

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
  // Açık bir paketle gelindiyse (yükseltme VEYA aynı paketi yenileme) doğrudan
  // fatura adımına atla. Aynı paketin yenilenmesi kasıtlı olarak mümkündür
  // (bkz. deriveBillingOrderType → "renewal"); adım 0'da yine seçili görünür.
  const skipPackageStep = hasExplicitTier

  // createBillingOrder da aynı kuralı sunucu tarafında zorunlu kılar; bu yalnızca
  // sihirbazın 3 adımını doldurup sonda reddedilmek yerine erken ve net bir mesaj verir.
  const pendingOrder = workshop
    ? await prisma.billingOrder.findFirst({
        where: { workshopId: workshop.id, status: "pending_payment" },
        orderBy: { createdAt: "desc" },
      })
    : null

  // Planı bitmiş (paywall'a takılmış) workshop'lar /billing'e YÖNLENDİRİLEMEZ:
  // /billing (app) grubunda olduğu için layout onları anında çıkışa atar ve
  // login → /checkout → /billing → çıkış sonsuz döngüsü oluşur. Onlara bekleyen
  // siparişi bu sayfada, satın alma sihirbazının yerine gösteriyoruz.
  const planLocked = workshop ? isPlanExpiredLock(getPlanState(workshop).lockReason) : false

  if (pendingOrder && planLocked) {
    const pkg = getPlanPackage(pendingOrder.planTier)
    const isCard = pendingOrder.method === "card"
    return (
      <main className="min-h-[100dvh] bg-background flex items-center justify-center p-6">
        <div className="w-full max-w-lg rounded-xl border bg-card p-6 shadow-sm">
          <div className="flex items-start gap-3">
            <Clock className="size-5 text-amber-600 shrink-0 mt-0.5" />
            <div className="text-sm">
              <h1 className="text-lg font-semibold text-foreground">
                {isCard ? "Kart ödemenizi tamamlayın" : "Bekleyen bir ödemeniz var"}
              </h1>
              <p className="text-muted-foreground mt-1">
                {pkg?.name} ({pendingOrder.billingCycle === "monthly" ? "Aylık" : "Yıllık"}) ·{" "}
                {formatMinor(pendingOrder.amountMinor)}
              </p>
              {isCard ? (
                <p className="text-muted-foreground mt-2">
                  Başlattığınız kart ödemesi henüz tamamlanmadı. Yeni bir talep oluşturabilmek için
                  önce bu ödemeyi tamamlayın.
                </p>
              ) : (
                <p className="text-muted-foreground mt-2">
                  Havale açıklamasına{" "}
                  <span className="font-semibold text-foreground">{pendingOrder.reference}</span>{" "}
                  yazıp ödemenizi yaptıysanız, teyit edilince paketiniz aktifleşecek. Onay beklerken
                  yeni bir talep oluşturamazsınız.
                </p>
              )}
            </div>
          </div>
          {isCard && (
            <a
              href={`/payment/result?ref=${encodeURIComponent(pendingOrder.reference)}`}
              className="mt-5 inline-flex h-9 w-full items-center justify-center rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground shadow-sm transition-colors hover:bg-primary/90"
            >
              Ödemeye devam et
            </a>
          )}
        </div>
      </main>
    )
  }

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
