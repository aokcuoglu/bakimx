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
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Yeni Araç</h2>
          <p className="text-muted-foreground">Yeni araç bilgilerini girin</p>
        </div>
        {customers.length === 0 ? (
          <div className="text-center py-12 text-muted-foreground">
            <p>Önce bir müşteri oluşturmalısınız</p>
            <Link href="/app/customers/new" className="text-primary hover:underline text-sm mt-1 block">
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