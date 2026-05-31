import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { IntakeWizard } from "@/components/app/intake-wizard"

export default async function NewIntakePage() {
  const { user, workshop } = await getAppData()

  const customers = await prisma.customer.findMany({
    where: { workshopId: user.workshopId },
    orderBy: { firstName: "asc" },
  })

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Yeni Araç Kabulü</h2>
          <p className="text-muted-foreground">Adım adım araç kabul formu oluştur</p>
        </div>
        <IntakeWizard customers={customers} />
      </div>
    </AppShell>
  )
}