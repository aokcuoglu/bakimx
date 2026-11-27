import Link from "next/link"
import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { Button } from "@/components/ui/button"
import { Card, CardDescription, CardFooter, CardHeader, CardTitle } from "@/components/ui/card"
import { prisma } from "@/lib/db"
import { TechnicianKioskHome } from "@/components/technician/technician-dashboard"
import { groupKioskOrders } from "@/lib/technician/kiosk-home"
import {
  getCompletedTodayTechnicianOrders,
  getTechnicianOrders,
} from "@/lib/technician/queries"
import {
  canSelectAnyTechnician,
  resolveKioskFocusTechnicianId,
  TECHNICIAN_PARAM,
} from "@/lib/technician/selected-technician"

export const metadata = { title: "Servis Yönetimi" }

export const dynamic = "force-dynamic"

export default async function TechnicianPage({
  searchParams,
}: {
  searchParams: Promise<{ technician?: string }>
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
  // rollerinde seçim yoktur: odak kendisidir (kaydı yoksa ya da pasifse boş),
  // atölyenin geri kalanı yine listelenir (BAK-157).
  const canSelectTechnician = canSelectAnyTechnician(user.role)
  const technicianIds = technicians.map((t) => t.id)
  const focusTechnicianId = resolveKioskFocusTechnicianId({
    canSelect: canSelectTechnician,
    requested: params[TECHNICIAN_PARAM],
    ownTechnicianId: user.technicianId,
    activeIds: technicianIds,
  })

  if (canSelectTechnician && !focusTechnicianId) {
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

  const [mine, workshopOrders, completedToday] = await Promise.all([
    focusTechnicianId
      ? getTechnicianOrders(user.workshopId, focusTechnicianId)
      : Promise.resolve([]),
    getTechnicianOrders(user.workshopId),
    getCompletedTodayTechnicianOrders(
      user.workshopId,
      canSelectTechnician ? focusTechnicianId ?? undefined : undefined
    ),
  ])
  const groups = groupKioskOrders(mine, workshopOrders, focusTechnicianId)

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Servis Yönetimi">
      <TechnicianKioskHome
        technicians={technicians.map((t) => ({ id: t.id, fullName: t.fullName, role: t.role }))}
        focusTechnicianId={focusTechnicianId}
        canSelectTechnician={canSelectTechnician}
        greetingName={user.firstName}
        groups={groups}
        completedToday={completedToday}
      />
    </AppShell>
  )
}
