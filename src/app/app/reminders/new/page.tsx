import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ReminderCreateForm } from "@/components/app/reminder-create-form"

export default async function NewReminderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string }>
}) {
  const { user, workshop } = await getAppData()
  const sp = await searchParams

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true },
    orderBy: { createdAt: "desc" },
  })

  const vehicles = await prisma.vehicle.findMany({
    where: { workshopId: user.workshopId },
    select: { id: true, customerId: true, plate: true, brand: true, model: true, mileage: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Hatırlatma">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/app/reminders" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            Bakım Hatırlatmaları
          </Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Yeni</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Yeni Hatırlatma</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            Müşteriniz için yeni bir bakım hatırlatması oluşturun.
          </p>
        </div>

        <ReminderCreateForm
          customers={customers.map((c) => ({
            id: c.id,
            firstName: c.firstName,
            lastName: c.lastName,
            fullName: c.fullName,
            companyName: c.companyName,
            type: c.type,
            phone: c.phone,
          }))}
          vehicles={vehicles.map((v) => ({
            id: v.id,
            customerId: v.customerId,
            plate: v.plate,
            brand: v.brand,
            model: v.model,
            mileage: v.mileage,
          }))}
          initial={{
            customerId: sp.customerId || "",
            vehicleId: sp.vehicleId || "",
          }}
        />
      </div>
    </AppShell>
  )
}
