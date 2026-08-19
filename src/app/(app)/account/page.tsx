import { getCurrentUser } from "@/lib/auth"
import { redirect } from "next/navigation"
import { prisma } from "@/lib/db"
import { ROLE_LABELS } from "@/lib/roles"
import { LOGOUT_REASON_PARAM, SESSION_INVALID_REASON } from "@/lib/session-recovery"
import { AppShell } from "@/components/layout/app-shell"
import { AccountProfileForm } from "@/components/account/account-profile-form"
import { AccountPasswordForm } from "@/components/account/account-password-form"

export const metadata = {
  title: "Hesabım",
}

export default async function AccountPage() {
  const user = await getCurrentUser()
  if (!user) {
    redirect(`/login?${LOGOUT_REASON_PARAM}=${SESSION_INVALID_REASON}`)
  }

  const workshop = await prisma.workshop.findUnique({
    where: { id: user.workshopId },
    select: { name: true },
  })

  return (
    <AppShell pageTitle="Hesabım" constrained>
      <div className="space-y-6">
        <section className="rounded-lg border border-border bg-white p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Profil Bilgileri</h2>
          <AccountProfileForm
            firstName={user.firstName ?? ""}
            lastName={user.lastName ?? ""}
          />
          <div className="mt-4 pt-4 border-t border-border space-y-2">
            {(user.email || user.username) && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">
                  {user.email ? "E-posta" : "Kullanıcı adı"}
                </span>
                <span className="text-sm font-medium text-foreground">
                  {user.email || user.username}
                </span>
              </div>
            )}
            <div className="flex items-center justify-between">
              <span className="text-sm text-muted-foreground">Rol</span>
              <span className="text-sm font-medium text-foreground">
                {ROLE_LABELS[user.role]}
              </span>
            </div>
            {workshop && (
              <div className="flex items-center justify-between">
                <span className="text-sm text-muted-foreground">İş Yeri</span>
                <span className="text-sm font-medium text-foreground">
                  {workshop.name}
                </span>
              </div>
            )}
          </div>
        </section>

        <section className="rounded-lg border border-border bg-white p-4 sm:p-6">
          <h2 className="text-base font-semibold text-foreground mb-4">Şifre Değiştir</h2>
          <AccountPasswordForm />
        </section>
      </div>
    </AppShell>
  )
}
