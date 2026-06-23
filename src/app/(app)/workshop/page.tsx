import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { WorkshopForm } from "@/components/app/workshop-form"
import { TechnicianManagement } from "@/components/app/technician-management"
import { prisma } from "@/lib/db"
import Link from "next/link"

export default async function WorkshopPage() {
  const { user, workshop } = await getAppData()

  if (!workshop) {
    return (
      <AppShell>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const technicians = await prisma.technician.findMany({
    where: { workshopId: user.workshopId },
    orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
  })

  const serializedWorkshop = {
    id: workshop.id,
    name: workshop.name,
    phone: workshop.phone,
    city: workshop.city,
    district: workshop.district,
    address: workshop.address,
    email: workshop.email,
    website: workshop.website,
    logoUrl: workshop.logoUrl,
    taxNumber: workshop.taxNumber,
    taxOffice: workshop.taxOffice,
    invoiceTitle: workshop.invoiceTitle,
  }

  const serializedTechnicians = technicians.map((t) => ({
    id: t.id,
    fullName: t.fullName,
    phone: t.phone,
    role: t.role,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
  }))

  return (
    <AppShell workshopName={workshop.name} pageTitle="İş Yeri Profili">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/settings?tab=profile" className="hover:text-foreground">Ayarlar</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">İş Yeri Profili</span>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">İş Yeri Profili</h2>
          <p className="text-sm text-muted-foreground mt-0.5">İş yeri bilgilerinizi güncelleyin</p>
        </div>
        <WorkshopForm workshop={serializedWorkshop} />

        <div className="pt-4">
          <TechnicianManagement technicians={serializedTechnicians} />
        </div>
      </div>
    </AppShell>
  )
}