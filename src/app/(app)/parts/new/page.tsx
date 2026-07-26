import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { PartForm } from "@/components/parts/part-form"
import { getActiveSuppliersForSelect } from "@/lib/suppliers/queries"

export default async function NewPartPage() {
  const { user, workshop } = await getAppData()
  const suppliers = await getActiveSuppliersForSelect(user.workshopId)
  return (
    <AppShell constrained workshopName={workshop?.name} pageTitle="Yeni Parça">
      <PartForm suppliers={suppliers} />
    </AppShell>
  )
}
