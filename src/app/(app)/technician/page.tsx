import Link from "next/link"
import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/db"
import { TechnicianDashboard } from "@/components/technician/technician-dashboard"
import {
  getRecentCompletedTechnicianOrders,
  getTechnicianDashboardStats,
  getTechnicianOrders,
} from "@/lib/technician/queries"
import {
  canSelectAnyTechnician,
  resolveSelectedTechnicianId,
  TECHNICIAN_PARAM,
} from "@/lib/technician/selected-technician"

export const metadata = { title: "Servis Yönetimi" }

export const dynamic = "force-dynamic"

export default async function TechnicianPage({
  searchParams,
}: {
  searchParams: Promise<{ technician?: string; mine?: string }>
}) {
  const paywall = await getFeaturePaywall("team")
  if (paywall) return paywall
  const params = await searchParams
  const { user, workshop } = await getAppData()

  const technicians = await prisma.technician.findMany({
    where: { workshopId: user.workshopId, isActive: true },
    orderBy: { fullName: "asc" },
  })

  // Yönetici hesapları da birleşik personel yapısında bir teknisyen kaydına
  // bağlıdır; bu bağ ekip içinden başka birini seçmelerini engellemez. Saha
  // rollerinde seçim yoktur; KPI'lar kendi atamalarını, liste ise atölyenin
  // tüm iş emirlerini gösterir (BAK-157).
  const canSelectTechnician = canSelectAnyTechnician(user.role)
  const selectedTechnicianId = resolveSelectedTechnicianId(
    canSelectTechnician
      ? params[TECHNICIAN_PARAM]
      : user.technicianId,
    technicians.map((t) => t.id)
  )

  if (!selectedTechnicianId) {
    return (
      <AppShell workshopName={workshop?.name} pageTitle="Servis Yönetimi">
        <div className="space-y-5 sm:space-y-6">
          <div>
            <h2 className="text-page-title text-foreground">Servis Yönetimi</h2>
            <p className="text-sm text-muted-foreground mt-0.5">İş atamalarınızı ve görevlerinizi yönetin</p>
          </div>
          <Card>
            <CardHeader>
              <CardTitle>Henüz teknisyen kaydı yok</CardTitle>
              <CardDescription>Ayarlar &gt; Ekip sayfasından bir teknisyen ekleyin</CardDescription>
            </CardHeader>
            <CardFooter className="justify-center border-t-0 bg-transparent">
              <Button variant="foreground" asChild>
                <Link href="/settings/team">
                  Ekip Sayfasına Git
                </Link>
              </Button>
            </CardFooter>
          </Card>
        </div>
      </AppShell>
    )
  }

  // Saha rolleri varsayılan olarak atölyenin tüm araç kabullerini görür;
  // "Bana atananlar" anahtarı (`?mine=1`) KPI'ları ve listeleri kendi
  // atamalarına daraltır. Yönetici görünümü seçili teknisyene bağlı kalır.
  const onlyAssignedToMe = !canSelectTechnician && params.mine === "1"
  const scopeToTechnician = canSelectTechnician || onlyAssignedToMe
  const technicianFilter = scopeToTechnician ? selectedTechnicianId : undefined
  const [stats, orders, recentCompletedOrders] = await Promise.all([
    getTechnicianDashboardStats(user.workshopId, selectedTechnicianId, scopeToTechnician),
    getTechnicianOrders(user.workshopId, technicianFilter),
    getRecentCompletedTechnicianOrders(user.workshopId, technicianFilter),
  ])

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Servis Yönetimi">
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
        onlyAssignedToMe={onlyAssignedToMe}
        stats={stats}
        orders={orders}
        recentCompletedOrders={recentCompletedOrders}
      />
    </AppShell>
  )
}
