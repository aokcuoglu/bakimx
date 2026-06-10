import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { PartForm } from "@/components/app/part-form"
import { getActiveSuppliersForSelect } from "@/lib/suppliers/queries"

export default async function NewPartPage() {
  const { user, workshop } = await getAppData()
  const suppliers = await getActiveSuppliersForSelect(user.workshopId)
  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Parça">
      <PartForm suppliers={suppliers} />
    </AppShell>
  )
}
