import { getAppData } from "@/app/app/data"
import { ComingSoonShell } from "@/components/app/coming-soon-shell"

export default async function InventoryPage() {
  const { workshop } = await getAppData()
  return (
    <ComingSoonShell
      workshopName={workshop?.name}
      title="Stok / Parçalar"
      description="Parça ve malzeme stokunuzu yönetin, iş emri ile entegre edin."
    />
  )
}
