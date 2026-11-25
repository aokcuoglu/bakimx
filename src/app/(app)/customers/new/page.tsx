import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { CustomerCreateForm } from "@/components/customers/customer-create-form"

export const metadata = { title: "Yeni Müşteri" }

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { workshop } = await getAppData()
  const params = await searchParams
  const initialType = params.type === "corporate" ? "corporate" : "individual"

  return (
    <AppShell workshopName={workshop?.name}>
      <CustomerCreateForm
        mode="create"
        initial={{ type: initialType }}
      />
    </AppShell>
  )
}
