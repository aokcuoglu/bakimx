import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { PartForm } from "@/components/parts/part-form"
import { getActiveSuppliersForSelect } from "@/lib/suppliers/queries"
import { getWorkshopBrands, getWorkshopCategories } from "@/lib/parts/queries"

export default async function NewPartPage() {
  const paywall = await getFeaturePaywall("partsInventory")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const [suppliers, workshopBrands, workshopCategories] = await Promise.all([
    getActiveSuppliersForSelect(user.workshopId),
    getWorkshopBrands(user.workshopId),
    getWorkshopCategories(user.workshopId),
  ])
  return (
    <AppShell constrained workshopName={workshop?.name} pageTitle="Yeni Parça">
      <PartForm suppliers={suppliers} workshopBrands={workshopBrands} workshopCategories={workshopCategories} />
    </AppShell>
  )
}
