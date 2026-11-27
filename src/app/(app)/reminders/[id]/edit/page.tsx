import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import { reminderDateInputValue } from "@/lib/reminders/dates"
import { ReminderCreateForm } from "@/components/reminders/reminder-create-form"

export const metadata = { title: "Bakım Hatırlatmasını Düzenle" }

export default async function EditReminderPage({ params }: { params: Promise<{ id: string }> }) {
  const paywall = await getFeaturePaywall("automatedReminders")
  if (paywall) return paywall
  const { id } = await params
  const { user, workshop } = await getAppData()

  const reminder = await prisma.maintenanceReminder.findFirst({
    where: { id, workshopId: user.workshopId },
  })

  if (!reminder) notFound()

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
    <AppShell workshopName={workshop?.name} recordTitle={reminder.title} subtitle={reminder.title}>
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
            customerId: reminder.customerId,
            vehicleId: reminder.vehicleId,
            title: reminder.title,
            type: reminder.type,
            dueDate: reminderDateInputValue(reminder.dueDate),
            dueMileage: reminder.dueMileage?.toString() || "",
            currentMileage: reminder.currentMileage?.toString() || "",
            lastServiceDate: reminderDateInputValue(reminder.lastServiceDate),
            lastServiceMileage: reminder.lastServiceMileage?.toString() || "",
            reminderDaysBefore: reminder.reminderDaysBefore?.toString() || "",
            reminderKmBefore: reminder.reminderKmBefore?.toString() || "",
            preferredChannel: reminder.preferredChannel,
            customerNote: reminder.customerNote || "",
            internalNote: reminder.internalNote || "",
          }}
          mode="edit"
          reminderId={id}
        />
      </div>
    </AppShell>
  )
}
