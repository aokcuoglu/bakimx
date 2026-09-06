import { AccountPasswordForm } from "@/components/account/account-password-form"
import { AccountProfileForm } from "@/components/account/account-profile-form"
import { getCurrentUser } from "@/lib/auth"
import { getSalesAccess } from "@/lib/sales/access"

export default async function SalesAccountPage() {
  await getSalesAccess("viewSales")
  const user = await getCurrentUser()
  if (!user) return null

  return (
    <div className="space-y-4 sm:space-y-6">
      <div>
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Hesabım</h1>
        <p className="mt-0.5 text-sm text-muted-foreground">Profil ve şifre bilgilerinizi yönetin.</p>
      </div>
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="mb-4 font-semibold text-foreground">Profil Bilgileri</h2>
        <AccountProfileForm firstName={user.firstName ?? ""} lastName={user.lastName ?? ""} />
        <div className="mt-4 border-t pt-4 text-sm">
          <span className="text-muted-foreground">E-posta</span>
          <p className="font-medium text-foreground">{user.email}</p>
        </div>
      </section>
      <section className="rounded-xl border bg-card p-4 sm:p-6">
        <h2 className="mb-4 font-semibold text-foreground">Şifre Değiştir</h2>
        <AccountPasswordForm />
      </section>
    </div>
  )
}
