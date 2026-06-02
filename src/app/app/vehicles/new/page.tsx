import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { VehicleCreateForm } from "@/components/app/vehicle-create-form"
import Link from "next/link"

export default async function NewVehiclePage() {
  const { user, workshop } = await getAppData()

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: [{ type: "asc" }, { firstName: "asc" }],
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Araç" showGlobalSearch={false}>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center text-sm text-slate-500">
              <Link href="/app/vehicles" className="hover:text-slate-700">Araçlar</Link>
              <span className="mx-2">/</span>
              <span className="text-slate-700 font-medium">Yeni Araç</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mt-1">Yeni Araç</h2>
            <p className="text-sm text-slate-500 mt-0.5">Araç bilgilerini eksiksiz girin</p>
          </div>
        </div>

        {customers.length === 0 ? (
          <div className="text-center py-16 px-4 text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl">
            <p className="text-base font-medium text-slate-700">Önce bir müşteri oluşturmalısınız</p>
            <p className="text-sm mt-1">Araç eklemek için müşteri kaydı gereklidir</p>
            <Link
              href="/app/customers/new"
              className="inline-flex items-center gap-1.5 mt-4 text-sm text-blue-600 hover:text-blue-700 font-medium"
            >
              + Müşteri Oluştur
            </Link>
          </div>
        ) : (
          <VehicleCreateForm customers={customers} mode="create" />
        )}

        <div className="h-16 sm:hidden" />
      </div>
    </AppShell>
  )
}
