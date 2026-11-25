import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { VehicleCreateForm } from "@/components/vehicles/vehicle-create-form"
import { resolveIntakeEntitlements } from "@/lib/intake/entitlements"

export const metadata = { title: "Yeni Araç" }

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
    <AppShell workshopName={workshop?.name} showGlobalSearch={false}>
      <div className="space-y-5 sm:space-y-6">
        {/* Hiç müşteri yokken de form açılır: müşteri kaydı formdan çıkmadan,
            "Yeni müşteri ekle" ile aynı ekranda oluşturulur (#186). */}
        <VehicleCreateForm
          customers={customers}
          mode="create"
          prefillCustomerId={customerId}
          entitlements={resolveIntakeEntitlements(workshop, user.role)}
        />

        <div className="h-16 sm:hidden" />
      </div>
    </AppShell>
  )
}
