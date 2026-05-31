import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { CustomerCreateForm } from "@/components/app/customer-create-form"

export default async function NewCustomerPage() {
  const { workshop } = await getAppData()

  return (
    <AppShell workshopName={workshop?.name}>
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold">Yeni Müşteri</h2>
          <p className="text-muted-foreground">Yeni müşteri bilgilerini girin</p>
        </div>
        <CustomerCreateForm />
      </div>
    </AppShell>
  )
}