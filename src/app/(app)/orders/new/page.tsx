import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { IntakeWizard } from "@/components/intake/intake-wizard"
import Link from "next/link"
import { getPlanState } from "@/lib/plan"
import { parseEntryMethod } from "@/lib/intake/entry-wizard"

export const metadata = { title: "Yeni Araç Kabul" }

export default async function NewOrderPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string; vehicleId?: string; source?: string; entry?: string }>
}) {
  const { user, workshop } = await getAppData()
  const params = await searchParams

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: { firstName: "asc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Araç Kabul">
      <div className="mx-auto max-w-6xl space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/orders" className="hover:text-foreground">Araç Kabulleri</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Yeni</span>
        </div>
        <div>
          <h2 className="text-page-title text-foreground">Yeni Araç Kabul</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Adım adım araç kabul formu oluşturun</p>
        </div>
        <IntakeWizard
          customers={customers}
          prefillCustomerId={params.customerId}
          prefillVehicleId={params.vehicleId}
          source={params.source}
          initialEntryMethod={parseEntryMethod(params.entry)}
          planTier={workshop ? getPlanState(workshop).accessTier : "pro"}
        />
      </div>
    </AppShell>
  )
}
