import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft, ClipboardList, Plus, ArrowRight, AlertCircle } from "lucide-react"
import { NewOrderSelector } from "@/components/app/new-order-selector"

export default async function NewOrderPage() {
  const { user, workshop } = await getAppData()

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
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app/orders" className="hover:text-slate-700 inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            İş Emirleri
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Yeni</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Yeni İş Emri</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Bir araç kabulünü iş emrine dönüştürün veya yeni kabul oluşturun.
          </p>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-3">
          <Link
            href="/app/intakes/new"
            className="lg:col-span-1 rounded-xl border-2 border-dashed border-slate-300 bg-white p-5 hover:border-blue-500 hover:bg-blue-50/30 transition-colors group"
          >
            <div className="size-10 rounded-lg bg-blue-100 text-blue-600 flex items-center justify-center mb-3">
              <Plus className="size-5" />
            </div>
            <h3 className="font-semibold text-slate-900">Yeni Araç Kabulü</h3>
            <p className="text-sm text-slate-500 mt-1">
              Sıfırdan yeni bir araç kabul formu oluşturun. Onay sürecinden sonra iş emri oluşturabilirsiniz.
            </p>
            <span className="mt-3 inline-flex items-center gap-1 text-sm font-medium text-blue-600 group-hover:gap-2 transition-all">
              Kabul Oluştur <ArrowRight className="size-4" />
            </span>
          </Link>

          <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
            <h3 className="font-semibold text-slate-900 flex items-center gap-2">
              <ClipboardList className="size-4 text-slate-500" />
              Kabullerden İş Emri Oluştur
            </h3>
            <p className="text-sm text-slate-500 mt-1">
              Onaylanmış bir kabul kaydını seçerek hızlıca iş emri oluşturun.
            </p>

            {noOrderYet.length === 0 ? (
              <div className="mt-4 p-4 rounded-lg bg-amber-50 border border-amber-200 text-amber-800 text-sm flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 mt-0.5" />
                <div>
                  <p className="font-medium">İş emrine uygun kabul bulunamadı</p>
                  <p className="mt-0.5 text-amber-700">
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
