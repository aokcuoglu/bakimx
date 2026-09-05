import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { SupplierForm } from "@/components/suppliers/supplier-form"

export default async function NewSupplierPage() {
  const paywall = await getFeaturePaywall("procurement")
  if (paywall) return paywall
  const { workshop } = await getAppData()
  return (
    <AppShell constrained workshopName={workshop?.name} pageTitle="Yeni Tedarikçi">
      <SupplierForm />
    </AppShell>
  )
}
