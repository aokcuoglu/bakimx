import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { VehicleCreateForm } from "@/components/vehicles/vehicle-create-form"
import Link from "next/link"

export default async function NewVehiclePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>
}) {
  const { user, workshop } = await getAppData()
  const { customerId } = await searchParams

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: [{ type: "asc" }, { firstName: "asc" }],
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Araç" showGlobalSearch={false}>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center text-sm text-muted-foreground">
              <Link href="/vehicles" className="hover:text-foreground">Araçlar</Link>
              <span className="mx-2">/</span>
              <span className="text-foreground font-medium">Yeni Araç</span>
            </div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground mt-1">Yeni Araç</h2>
            <p className="text-sm text-muted-foreground mt-0.5">Araç bilgilerini eksiksiz girin</p>
          </div>
        </div>

        {/* Hiç müşteri yokken de form açılır: müşteri kaydı formdan çıkmadan,
            "Yeni müşteri ekle" ile aynı ekranda oluşturulur (#186). */}
        <VehicleCreateForm customers={customers} mode="create" prefillCustomerId={customerId} />

        <div className="h-16 sm:hidden" />
      </div>
    </AppShell>
  )
}
