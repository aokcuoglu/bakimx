import { getAppData } from "@/app/app/data"
import { ComingSoonShell } from "@/components/app/coming-soon-shell"

export default async function RemindersPage() {
  const { workshop } = await getAppData()
  return (
    <ComingSoonShell
      workshopName={workshop?.name}
      title="Bakım Hatırlatmaları"
      description="Periyodik bakım zamanı gelen müşterileri otomatik olarak hatırlatın."
    />
  )
}
