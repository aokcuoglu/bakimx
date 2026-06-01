import { getAppData } from "@/app/app/data"
import { ComingSoonShell } from "@/components/app/coming-soon-shell"

export default async function SuppliersPage() {
  const { workshop } = await getAppData()
  return (
    <ComingSoonShell
      workshopName={workshop?.name}
      title="Tedarikçiler"
      description="Tedarikçi listenizi ve sipariş geçmişinizi yönetin."
    />
  )
}
