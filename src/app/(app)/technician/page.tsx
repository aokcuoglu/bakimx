import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import { TechnicianDashboard } from "@/components/app/technician-dashboard"
import { getTechnicianDashboardStats, getTechnicianOrders } from "@/lib/technician/queries"

export const dynamic = "force-dynamic"

export default async function TechnicianPage() {
  const { user, workshop } = await getAppData()

  const technicians = await prisma.technician.findMany({
    where: { workshopId: user.workshopId, isActive: true },
    orderBy: { fullName: "asc" },
  })

  if (technicians.length === 0) {
    return (
      <AppShell workshopName={workshop?.name} pageTitle="Teknisyen Paneli">
        <div className="space-y-5 sm:space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Teknisyen Paneli</h2>
            <p className="text-sm text-muted-foreground mt-0.5">İş atamalarınızı ve görevlerinizi yönetin</p>
          </div>
          <div className="text-center py-16 text-muted-foreground">
            <p className="text-base font-medium">Henüz teknisyen kaydı yok</p>
            <p className="text-sm mt-1">Önce İş Yeri Profili sayfasından bir teknisyen ekleyin</p>
          </div>
        </div>
      </AppShell>
    )
  }

  const firstTechnician = technicians[0]
  const [stats, orders] = await Promise.all([
    getTechnicianDashboardStats(user.workshopId, firstTechnician.id),
    getTechnicianOrders(user.workshopId, firstTechnician.id),
  ])

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Teknisyen Paneli">
      <TechnicianDashboard
        technicians={technicians.map((t) => ({
          id: t.id,
          fullName: t.fullName,
          phone: t.phone,
          role: t.role,
          isActive: t.isActive,
        }))}
        selectedTechnicianId={firstTechnician.id}
        stats={stats}
        orders={orders}
      />
    </AppShell>
  )
}