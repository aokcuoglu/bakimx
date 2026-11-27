import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { prisma } from "@/lib/db"
import { TechnicianEmptyState, TechnicianKioskHome } from "@/components/technician/technician-dashboard"
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

export const metadata = { title: "Teknisyen Paneli" }

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
      <AppShell workshopName={workshop?.name}>
        <TechnicianEmptyState />
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

  // lg+ PageFrame alt başlığı = kiosk selamı (telefonda başlık içerikte kalır).
  const focusName = technicians.find((t) => t.id === focusTechnicianId)?.fullName
  const who = canSelectTechnician
    ? (focusName ?? "Teknisyen")
    : user.firstName
      ? `Merhaba ${user.firstName}`
      : "Merhaba"
  const subtitle = `${who} · ${groups.mine.length} iş`

  return (
    <AppShell workshopName={workshop?.name} subtitle={subtitle}>
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
