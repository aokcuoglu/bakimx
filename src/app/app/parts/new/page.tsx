import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { PartForm } from "@/components/app/part-form"

export default async function NewPartPage() {
  const { workshop } = await getAppData()
  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Parça">
      <PartForm />
    </AppShell>
  )
}
