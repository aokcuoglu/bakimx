import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { VehicleCreateForm } from "@/components/app/vehicle-create-form"
import { VehicleIdentity } from "@/components/app/vehicle-identity"
import Link from "next/link"

export default async function EditVehiclePage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params
  const { user, workshop } = await getAppData()

  const vehicle = await prisma.vehicle.findFirst({
    where: { id, workshopId: user.workshopId },
    include: { customer: true },
  })
  if (!vehicle) notFound()

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: [{ type: "asc" }, { firstName: "asc" }],
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Aracı Düzenle" showGlobalSearch={false}>
      <div className="space-y-5 sm:space-y-6">
        <div className="space-y-2">
          <div className="flex items-center text-sm text-muted-foreground">
            <Link href="/vehicles" className="hover:text-foreground">Araçlar</Link>
            <span className="mx-2">/</span>
            <Link href={`/vehicles/${vehicle.id}`} className="hover:text-foreground">{vehicle.plate}</Link>
            <span className="mx-2">/</span>
            <span className="text-foreground font-medium">Düzenle</span>
          </div>
          <VehicleIdentity plate={vehicle.plate} brand={vehicle.brand} model={vehicle.model} />
        </div>

        <VehicleCreateForm
          customers={customers}
          mode="edit"
          initial={{
            id: vehicle.id,
            customerId: vehicle.customerId,
            plate: vehicle.plate,
            brand: vehicle.brand,
            model: vehicle.model,
            vehicleType: vehicle.vehicleType,
            modelYear: vehicle.modelYear,
            mileage: vehicle.mileage,
            vin: vehicle.vin,
            vinConfirmed: vehicle.vinConfirmed,
            color: vehicle.color,
            engineNo: vehicle.engineNo,
            fuelType: vehicle.fuelType,
            transmission: vehicle.transmission,
            commercialName: vehicle.commercialName,
            firstRegistrationDate: vehicle.firstRegistrationDate,
            engineDisplacement: vehicle.engineDisplacement,
            enginePower: vehicle.enginePower,
            inspectionValidUntil: vehicle.inspectionValidUntil,
            notes: vehicle.notes,
          }}
        />

        <div className="h-16 sm:hidden" />
      </div>
    </AppShell>
  )
}
