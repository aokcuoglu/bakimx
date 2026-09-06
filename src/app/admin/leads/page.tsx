import Link from "next/link"
import { can, getAdminContext } from "@/lib/admin"
import { getLeadRows, getSupportConsoleOptions } from "@/app/admin/data"
import { AdminDemoRequests, AdminSupportRequests } from "@/app/admin/admin-requests"
import { Badge } from "@/components/ui/badge"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/shared/filter-select"

export const dynamic = "force-dynamic"

interface LeadsSearchParams {
  workshopId?: string
}

export default async function AdminLeadsPage({
  searchParams,
}: {
  // `searchParams` bir Promise'tir ve `await` edilmelidir; doğrudan okumak
  // typecheck yeşilken çalışma zamanında `undefined` verir (AGENTS.md, PR #336).
  searchParams: Promise<LeadsSearchParams>
}) {
  const ctx = await getAdminContext()
  const sp = await searchParams
  const workshopId = sp.workshopId?.trim() || ""

  const [{ demoRows, supportRows }, options] = await Promise.all([
    getLeadRows({ supportWorkshopId: workshopId || undefined }),
    getSupportConsoleOptions(),
  ])
  const canManage = can(ctx, "manageLeads")

  return (
    <div className="space-y-10">
      {/* Demo Talepleri — potansiyel müşteri talepleri, en önemli bölüm */}
      <section className="space-y-4">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold text-foreground">Demo Talepleri</h1>
          <p className="text-sm text-muted-foreground mt-0.5">
            Public demo formundan gelen potansiyel müşteri talepleri. Yeni olanlar üstte.
          </p>
        </div>
        <AdminDemoRequests requests={demoRows} canManage={canManage} />
      </section>

      {/* Destek Gelen Kutusu — basit liste */}
      <section className="space-y-4">
        <div className="flex flex-col gap-1 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-lg font-bold text-foreground">Destek Gelen Kutusu</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Public destek formundan gelen talepler.
            </p>
          </div>
          {supportRows.length > 0 && (
            <Badge className="bg-muted text-muted-foreground">
              {supportRows.length} kayıt
            </Badge>
          )}
        </div>

        <form method="get" className="flex flex-col gap-3 rounded-lg border bg-card p-3 sm:flex-row sm:items-end">
          <label className="flex flex-col gap-1 text-xs text-muted-foreground sm:min-w-64">
            İş yeri
            <FilterSelect
              name="workshopId"
              defaultValue={workshopId}
              placeholder="Tüm iş yerleri"
              options={[{ value: "", label: "Tüm iş yerleri" }, ...options.workshops]}
            />
          </label>
          <div className="flex gap-2">
            <Button type="submit" variant="outline">
              Filtrele
            </Button>
            {workshopId && (
              <Button variant="ghost" asChild>
                <Link href="/admin/leads">
                  Temizle
                </Link>
              </Button>
            )}
          </div>
        </form>

        <AdminSupportRequests requests={supportRows} canManage={canManage} options={options} />
      </section>
    </div>
  )
}
