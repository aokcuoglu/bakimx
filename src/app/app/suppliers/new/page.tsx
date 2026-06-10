import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { SupplierForm } from "@/components/app/supplier-form"

export default async function NewSupplierPage() {
  const { workshop } = await getAppData()
  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Tedarikçi">
      <SupplierForm />
    </AppShell>
  )
}