import { requireAdmin } from "@/lib/admin"
import { getLeadRows } from "@/app/admin/data"
import { AdminDemoRequests, AdminSupportRequests } from "@/app/admin/admin-requests"

export const dynamic = "force-dynamic"

export default async function AdminLeadsPage() {
  await requireAdmin()
  const { demoRows, supportRows } = await getLeadRows()

  return (
    <div className="space-y-8">
      <div className="space-y-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Demo Talepleri</h1>
          <p className="text-sm text-muted-foreground mt-0.5">Public demo talepleri. Yeni olanlar üstte.</p>
        </div>
        <AdminDemoRequests requests={demoRows} />
      </div>

      <div className="space-y-3 pt-2">
        <div>
          <h2 className="text-lg font-bold text-foreground">Destek Talepleri</h2>
          <p className="text-sm text-muted-foreground mt-0.5">Public destek talepleri. Yeni olanlar üstte.</p>
        </div>
        <AdminSupportRequests requests={supportRows} />
      </div>
    </div>
  )
}
