import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { ArrowLeft } from "lucide-react"
import { AppointmentCreateForm } from "@/components/app/appointment-create-form"

export default async function NewAppointmentPage() {
  const { user, workshop } = await getAppData()

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    select: { id: true, firstName: true, lastName: true, fullName: true, companyName: true, type: true, phone: true },
    orderBy: { createdAt: "desc" },
  })

  const vehicles = await prisma.vehicle.findMany({
    where: { workshopId: user.workshopId },
    select: { id: true, customerId: true, plate: true, brand: true, model: true },
    orderBy: { createdAt: "desc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Randevu">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app/appointments" className="hover:text-slate-700 inline-flex items-center gap-1">
            <ArrowLeft className="size-3.5" />
            Randevular
          </Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Yeni</span>
        </div>

        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Yeni Randevu</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Müşteriniz için yeni bir servis randevusu oluşturun.
          </p>
        </div>

        <AppointmentCreateForm
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
          }))}
        />
      </div>
    </AppShell>
  )
}
