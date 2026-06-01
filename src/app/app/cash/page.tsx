import { getAppData } from "@/app/app/data"
import { ComingSoonShell } from "@/components/app/coming-soon-shell"

export default async function CashPage() {
  const { workshop } = await getAppData()
  return (
    <ComingSoonShell
      workshopName={workshop?.name}
      title="Kasa"
      description="Nakit ve banka hareketlerini takip edin."
    />
  )
}
