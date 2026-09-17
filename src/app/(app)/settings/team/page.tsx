import { AppShell } from "@/components/layout/app-shell"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"
import {
  TeamManagement,
} from "@/components/settings/team-management"
import { prisma } from "@/lib/db"
import { getSeatUsage } from "@/lib/rbac"
import { getPlanState, getEffectiveSeatLimit, hasWorkshopFeature } from "@/lib/plan"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { loadWorkshopSettings } from "../load-workshop-settings"

export const metadata = { title: "Ekip Yönetimi" }

export default async function TeamSettingsPage() {
  const paywall = await getFeaturePaywall("team")
  if (paywall) return paywall

  const { user, workshop, serializedWorkshop } = await loadWorkshopSettings()

  if (!workshop || !serializedWorkshop) {
    return (
      <AppShell wide>
        <div className="text-center py-12 text-muted-foreground">
          <p>İş yeri bilgisi bulunamadı</p>
        </div>
      </AppShell>
    )
  }

  const canTeam = hasWorkshopFeature(workshop, "team")
  const [members, invites, technicians] = canTeam ? await Promise.all([
    prisma.user.findMany({
      where: { workshopId: user.workshopId },
      select: {
        id: true,
        email: true,
        username: true,
        firstName: true,
        lastName: true,
        role: true,
        isActive: true,
        technicianId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.invite.findMany({
      where: { workshopId: user.workshopId, status: "pending" },
      select: { id: true, email: true, role: true, expiresAt: true },
      orderBy: { createdAt: "desc" },
    }),
    prisma.technician.findMany({
      where: { workshopId: user.workshopId },
      include: { linkedUsers: { select: { id: true } } },
      orderBy: [{ isActive: "desc" }, { fullName: "asc" }],
    }),
  ]) : [[], [], []]

  const serializedInvites = invites.map((i) => ({
    id: i.id,
    email: i.email,
    role: i.role,
    expiresAt: i.expiresAt.toISOString(),
  }))

  const accountMissingPersonnel = technicians.filter((t) => t.linkedUsers.length === 0).map((t) => ({
    id: t.id,
    fullName: t.fullName,
    phone: t.phone,
    role: t.role,
    isActive: t.isActive,
    createdAt: t.createdAt.toISOString(),
  }))

  const seatUsage = canTeam
    ? await getSeatUsage(user.workshopId)
    : { activeUsers: 0, pendingInvites: 0, used: 0 }
  const seatLimit = getEffectiveSeatLimit(workshop)
  const canManageTeam = user.role === "owner" || user.role === "manager"

  return (
    <AppShell wide workshopName={workshop.name} pageTitle="Ekip">
      <SettingsPageHeader
        title="Ekip"
        description="Üyeleri, davetleri ve teknisyen hesaplarını yönetin."
      />
      <TeamManagement
        members={members}
        invites={serializedInvites}
        currentUserId={user.id}
        currentUserRole={user.role}
        canManage={canManageTeam}
        seatUsed={seatUsage.used}
        seatLimit={seatLimit}
        accessTier={getPlanState(workshop).accessTier}
        workshopName={workshop.name}
        loginCode={workshop.loginCode}
        accountMissingPersonnel={accountMissingPersonnel}
        logoUrl={workshop.logoUrl || undefined}
      />
    </AppShell>
  )
}
