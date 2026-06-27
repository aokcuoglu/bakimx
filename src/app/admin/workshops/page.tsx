import { requireAdmin } from "@/lib/admin"
import { getWorkshopRows } from "@/app/admin/data"
import { AdminWorkshops } from "@/app/admin/admin-workshops"

export const dynamic = "force-dynamic"

export default async function AdminWorkshopsPage() {
  await requireAdmin()
  const rows = await getWorkshopRows()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">İş Yerleri</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Kayıtları onaylayın, paket taleplerini etkinleştirin. Detay için iş yeri adına tıklayın.
        </p>
      </div>
      <AdminWorkshops workshops={rows} />
    </div>
  )
}
