import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { WorkshopForm } from "@/components/app/workshop-form"

export default async function WorkshopPage() {
  const { workshop } = await getAppData()

  if (!workshop) {
    return (
      <AppShell>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  return (
    <AppShell workshopName={workshop.name}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">İş Yeri Profili</h2>
          <p className="text-muted-foreground">İş yeri bilgilerinizi güncelleyin</p>
        </div>
        <WorkshopForm workshop={workshop} />
      </div>
    </AppShell>
  )
}