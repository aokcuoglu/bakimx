import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ROLE_LABELS } from "@/lib/roles"
import { LOGOUT_REASON_PARAM, SESSION_INVALID_REASON } from "@/lib/session-recovery"
import { AppShell } from "@/components/layout/app-shell"
import { AccountProfilePanel } from "@/components/account/account-profile-panel"
import { SettingsPageHeader } from "@/components/settings/settings-page-header"

export const metadata = {
  title: "Profil",
}

export default async function SettingsProfilePage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: { name: true },
  })

  return (
    <AppShell pageTitle="Profil" workshopName={workshop?.name}>
      <SettingsPageHeader title="Profil" description="Kişisel bilgilerinizi ve şifrenizi yönetin." />
      <AccountProfilePanel
        firstName={user.firstName ?? ""}
        lastName={user.lastName ?? ""}
        email={user.email}
        username={user.username}
        roleLabel={ROLE_LABELS[user.role]}
        workshopName={workshop?.name ?? null}
      />
    </AppShell>
  )
}
