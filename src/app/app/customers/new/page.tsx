import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { CustomerCreateForm } from "@/components/app/customer-create-form"
import Link from "next/link"

export default async function NewCustomerPage({
  searchParams,
}: {
  searchParams: Promise<{ type?: string }>
}) {
  const { workshop } = await getAppData()
  const params = await searchParams
  const initialType = params.type === "corporate" ? "corporate" : "individual"

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Yeni Müşteri">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app/customers" className="hover:text-slate-700">Müşteriler</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Yeni</span>
        </div>
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Yeni Müşteri</h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Bireysel veya kurumsal müşteri bilgilerini girin
          </p>
        </div>
        <CustomerCreateForm
          mode="create"
          initial={{ type: initialType }}
        />
      </div>
    </AppShell>
  )
}
