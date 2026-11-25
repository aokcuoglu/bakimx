import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { ReminderCreateForm } from "@/components/reminders/reminder-create-form"

export const metadata = { title: "Yeni Bakım Hatırlatması" }

export default async function NewReminderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string }>
}) {
  const paywall = await getFeaturePaywall("automatedReminders")
  if (paywall) return paywall
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
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-5 sm:space-y-6">
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
