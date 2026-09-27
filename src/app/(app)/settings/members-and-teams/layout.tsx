import { AppShell } from "@/components/layout/app-shell"
import { getAppData } from "@/app/(app)/data"
import { hasWorkshopFeature } from "@/lib/plan"

export default async function MembersAndTeamsLayout({ children }: { children: React.ReactNode }) {
  const { workshop } = await getAppData()
  if (!workshop || !hasWorkshopFeature(workshop, "team")) return children
  return (
    <AppShell wide workshopName={workshop.name} pageTitle="Üyeler ve ekipler">
      {children}
    </AppShell>
  )
}
