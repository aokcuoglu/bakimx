import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { IntakeWizard } from "@/components/app/intake-wizard"
import Link from "next/link"

export default async function NewIntakePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string; source?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: { firstName: "asc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Araç Kabulü">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/app/intakes" className="hover:text-foreground">Araç Kabulleri</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Yeni</span>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Yeni Araç Kabulü</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Adım adım araç kabul formu oluşturun</p>
        </div>
        <IntakeWizard
          customers={customers}
          prefillCustomerId={params.customerId}
          prefillVehicleId={params.vehicleId}
          source={params.source}
        />
      </div>
    </AppShell>
  )
}
