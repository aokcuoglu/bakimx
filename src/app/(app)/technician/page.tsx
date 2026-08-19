import Link from "next/link"
import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { prisma } from "@/lib/db"
import { TechnicianDashboard } from "@/components/technician/technician-dashboard"
import { getTechnicianDashboardStats, getTechnicianOrders } from "@/lib/technician/queries"
import {
  canSelectAnyTechnician,
  resolveSelectedTechnicianId,
  TECHNICIAN_PARAM,
} from "@/lib/technician/selected-technician"

export const dynamic = "force-dynamic"

export default async function TechnicianPage({
  searchParams,
}: {
  searchParams: Promise<{ technician?: string }>
}) {
  const params = await searchParams
  const { user, workshop } = await getAppData()

  const technicians = await prisma.technician.findMany({
    where: { workshopId: user.workshopId, isActive: true },
    orderBy: { fullName: "asc" },
  })

  // Yönetici hesapları da birleşik personel yapısında bir teknisyen kaydına
  // bağlıdır; bu bağ ekip içinden başka birini seçmelerini engellemez. Saha
  // rolleri ise BAK-39 gereği yalnız kendi atamalarını görür.
  const canSelectTechnician = canSelectAnyTechnician(user.role)
  const selectedTechnicianId = resolveSelectedTechnicianId(
    canSelectTechnician
      ? params[TECHNICIAN_PARAM]
      : user.technicianId,
    technicians.map((t) => t.id)
  )

  if (!selectedTechnicianId) {
    return (
      <AppShell workshopName={workshop?.name} pageTitle="Teknisyen Paneli">
        <div className="space-y-5 sm:space-y-6">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Teknisyen Paneli</h2>
            <p className="text-sm text-muted-foreground mt-0.5">İş atamalarınızı ve görevlerinizi yönetin</p>
          </div>
          <div className="text-center py-16 space-y-4">
            <div className="text-muted-foreground">
              <p className="text-base font-medium">Henüz teknisyen kaydı yok</p>
              <p className="text-sm mt-1">Ayarlar &gt; Ekip sayfasından bir teknisyen ekleyin</p>
            </div>
            <Button render={<Link href="/settings?tab=team" />}>Ekip Sayfasına Git</Button>
          </div>
        </div>
      </AppShell>
    )
  }

  const [stats, orders] = await Promise.all([
    getTechnicianDashboardStats(user.workshopId, selectedTechnicianId),
    getTechnicianOrders(user.workshopId, selectedTechnicianId),
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
        selectedTechnicianId={selectedTechnicianId}
        canSelectTechnician={canSelectTechnician}
        stats={stats}
        orders={orders}
      />
    </AppShell>
  )
}
