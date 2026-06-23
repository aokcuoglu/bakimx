import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { notFound } from "next/navigation"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { ReminderCreateForm } from "@/components/app/reminder-create-form"

export default async function EditReminderPage({ params }: { params: Promise<{ id: string }> }) {
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
    <AppShell workshopName={workshop?.name} pageTitle={`Düzenle: ${reminder.title}`}>
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/reminders" className="hover:text-foreground inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            Bakım Hatırlatmaları
          </Link>
          <span className="mx-2">/</span>
          <Link href={`/reminders/${id}`} className="hover:text-foreground">{reminder.title}</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Düzenle</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Hatırlatma Düzenle</h2>
          <p className="text-sm text-muted-foreground mt-0.5">{reminder.title}</p>
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
            customerId: reminder.customerId,
            vehicleId: reminder.vehicleId,
            title: reminder.title,
            type: reminder.type,
            dueDate: reminder.dueDate ? reminder.dueDate.toISOString().slice(0, 10) : "",
            dueMileage: reminder.dueMileage?.toString() || "",
            currentMileage: reminder.currentMileage?.toString() || "",
            lastServiceDate: reminder.lastServiceDate ? reminder.lastServiceDate.toISOString().slice(0, 10) : "",
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
