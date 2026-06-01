import { getAppData } from "@/app/app/data"
import { ComingSoonShell } from "@/components/app/coming-soon-shell"

export default async function AppointmentsPage() {
  const { workshop } = await getAppData()
  return (
    <ComingSoonShell
      workshopName={workshop?.name}
      title="Randevular"
      description="Servis randevularını planlayın ve müşterilerinize hatırlatmalar gönderin."
    />
  )
}
