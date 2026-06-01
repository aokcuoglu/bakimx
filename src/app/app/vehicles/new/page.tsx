import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { VehicleCreateForm } from "@/components/app/vehicle-create-form"
import Link from "next/link"

export default async function NewVehiclePage() {
  const { user, workshop } = await getAppData()

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: { firstName: "asc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Araç">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app/vehicles" className="hover:text-slate-700">Araçlar</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Yeni</span>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Yeni Araç</h2>
          <p className="text-sm text-slate-500 mt-0.5">Yeni araç bilgilerini girin</p>
        </div>
        {customers.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <p>Önce bir müşteri oluşturmalısınız</p>
            <Link href="/app/customers/new" className="text-blue-600 hover:text-blue-700 text-sm mt-1 block">
              Müşteri oluştur
            </Link>
          </div>
        ) : (
          <VehicleCreateForm customers={customers} />
        )}
      </div>
    </AppShell>
  )
}