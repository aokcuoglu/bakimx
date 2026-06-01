import { getAppData } from "@/app/app/data"
import { ComingSoonShell } from "@/components/app/coming-soon-shell"

export default async function ReportsPage() {
  const { workshop } = await getAppData()
  return (
    <ComingSoonShell
      workshopName={workshop?.name}
      title="Raporlar"
      description="Servis, müşteri ve gelir raporlarını görüntüleyin."
    />
  )
}
