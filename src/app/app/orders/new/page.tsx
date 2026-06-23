import { getAppData } from "@/app/app/data"
import { hasFeature, type PlanTier } from "@/lib/plan"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, ClipboardList, Plus, ArrowRight, AlertCircle, ScanLine } from "lucide-react"
import { NewOrderSelector } from "@/components/app/new-order-selector"
import { StandaloneServiceAdvisor } from "@/components/app/standalone-service-advisor"
import { AdvisorPremiumLock } from "@/components/app/advisor-premium-lock"

export default async function NewOrderPage() {
  const { user, workshop } = await getAppData()
  const hasAiAdvisor = !!workshop && hasFeature(workshop.planTier as PlanTier, "aiAdvisor")

  const recentIntakes = await prisma.vehicleIntakeForm.findMany({
    where: { workshopId: user.workshopId },
    include: {
      customer: true,
      vehicle: true,
      order: { include: { items: true } },
      _count: { select: { photos: true, damageMarks: true } },
    },
    orderBy: { createdAt: "desc" },
    take: 20,
  })

  const eligibleIntakes = recentIntakes.filter((i) => i.status === "approved" || i.status === "waiting_approval" || i.status === "in_progress" || i.status === "ready_for_delivery")
  const noOrderYet = eligibleIntakes.filter((i) => !i.order)

  const serializedIntakes = recentIntakes.map((i) => {
    const total = i.order?.items.reduce((s, item) => {
      if (item.totalPrice) return s + item.totalPrice
      if (item.unitPrice) return s + item.unitPrice * item.quantity
      return s
    }, 0) ?? 0
    return {
      id: i.id,
      status: i.status,
      hasOrder: !!i.order,
      orderId: i.order?.id || null,
      createdAt: i.createdAt.toISOString(),
      photosCount: i._count.photos,
      damageCount: i._count.damageMarks,
      total,
      customer: {
        firstName: i.customer.firstName,
        lastName: i.customer.lastName,
        fullName: i.customer.fullName,
        companyName: i.customer.companyName,
        type: i.customer.type,
        phone: i.customer.phone,
      },
      vehicle: {
        plate: i.vehicle.plate,
        brand: i.vehicle.brand,
        model: i.vehicle.model,
      },
    }
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni İş Emri">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/app/orders" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            İş Emirleri
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Yeni</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Yeni İş Emri</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Bir araç kabulünü iş emrine dönüştürün veya yeni kabul oluşturun.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <div className="lg:col-span-1 space-y-3">
            <Link
              href="/app/intakes/new"
              className="block rounded-lg border-2 border-dashed border-border bg-card p-5 hover:border-primary hover:bg-primary/5 transition-colors group"
            >
              <div className="size-10 rounded-lg bg-primary/10 text-primary flex items-center justify-center mb-3">
                <Plus className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">Yeni Araç Kabulü</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Sıfırdan yeni bir araç kabul formu oluşturun. Onay sürecinden sonra iş emri oluşturabilirsiniz.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-primary group-hover:gap-2 transition-all">
                Kabul Oluştur <ArrowRight className="size-4" />
              </span>
            </Link>

            <Link
              href="/app/smart-capture/registration"
              className="block rounded-lg border-2 border-dashed border-border bg-card p-5 hover:border-success hover:bg-success/5 transition-colors group"
            >
              <div className="size-10 rounded-lg bg-success/10 text-success flex items-center justify-center mb-3">
                <ScanLine className="size-5" />
              </div>
              <h3 className="font-semibold text-foreground">Ruhsattan Doldur</h3>
              <p className="text-sm text-muted-foreground mt-1">
                Araç ruhsat fotoğrafını okutarak müşteri ve araç bilgilerini otomatik doldurun.
              </p>
              <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-success group-hover:gap-2 transition-all">
                Ruhsat Oku <ArrowRight className="size-4" />
              </span>
            </Link>

            {hasAiAdvisor ? (
              <StandaloneServiceAdvisor />
            ) : (
              <AdvisorPremiumLock />
            )}
          </div>

          <div className="lg:col-span-2 rounded-lg border border-border bg-card p-5">
            <h3 className="font-semibold text-foreground flex items-center gap-2">
              <ClipboardList className="size-4 text-muted-foreground" />
              Kabullerden İş Emri Oluştur
            </h3>
            <p className="text-sm text-muted-foreground mt-1">
              Onaylanmış bir kabul kaydını seçerek hızlıca iş emri oluşturun.
            </p>

            {noOrderYet.length === 0 ? (
              <div className="mt-4 p-4 rounded-lg bg-warning/10 border border-warning/20 text-warning-foreground text-sm flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">İş emrine uygun kabul bulunamadı</p>
                  <p className="mt-0.5 text-warning-foreground">
                    Onaylanmış bir kabul kaydı olması gerekiyor. Önce yeni bir kabul oluşturun veya mevcut bir kabulü onaylayın.
                  </p>
                </div>
              </div>
            ) : (
              <NewOrderSelector intakes={serializedIntakes} />
            )}
          </div>
        </div>
      </div>
    </AppShell>
  )
}
