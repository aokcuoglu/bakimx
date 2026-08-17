import { AlertCircle } from "lucide-react"
import { ADMIN_ROLE_LABELS, getAdminEmails, requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { Alert, AlertDescription } from "@/components/ui/alert"
import { AddPlatformAdminForm } from "@/app/admin/admins/add-admin-form"
import { PlatformAdminRow } from "@/app/admin/admins/admin-row-actions"

export const dynamic = "force-dynamic"

function displayName(u: { firstName: string | null; lastName: string | null }): string {
  return [u.firstName, u.lastName].filter(Boolean).join(" ")
}

export default async function AdminAdminsPage() {
  const ctx = await requireAdminCapability("manageAdmins")

  const admins = await prisma.platformAdmin.findMany({
    // `nulls: "first"` şart: Postgres ASC sıralamada NULL'ı SONA koyar, yani
    // varsayılan hâliyle devre dışı yöneticiler listenin başına çıkardı.
    orderBy: [{ disabledAt: { sort: "asc", nulls: "first" } }, { createdAt: "asc" }],
    select: {
      id: true,
      role: true,
      disabledAt: true,
      sessionsValidFrom: true,
      createdAt: true,
      user: {
        select: {
          id: true,
          email: true,
          firstName: true,
          lastName: true,
          isActive: true,
          workshop: { select: { name: true } },
        },
      },
      createdBy: { select: { email: true } },
    },
  })

  const envEmails = getAdminEmails()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Yöneticiler</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Konsola kimin erişebileceği burada yönetilir — deploy gerekmez. Erişimi kapatılan
          yöneticinin açık oturumu da bir sonraki istekte kesilir.
        </p>
      </div>

      {ctx.platformAdminId === null && (
        <Alert>
          <AlertCircle className="size-4" />
          <AlertDescription>
            Bu oturum <code>ADMIN_EMAILS</code> bootstrap yoluyla açıldı (tablo boştu). Buradan
            ilk yöneticileri ekledikten sonra env allowlist&apos;in bir hükmü kalmaz — üyelik
            tamamen bu listeden yönetilir.
          </AlertDescription>
        </Alert>
      )}

      <section className="rounded-lg border bg-card p-4">
        <h2 className="text-sm font-semibold text-foreground mb-3">Yönetici ekle</h2>
        <AddPlatformAdminForm />
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Yöneticiler ({admins.length})</h2>
        {admins.length === 0 ? (
          <p className="text-sm text-muted-foreground">
            Henüz DB&apos;de yönetici yok. Erişim şu an <code>ADMIN_EMAILS</code> bootstrap
            listesinden geliyor
            {envEmails.length > 0 ? ` (${envEmails.length} adres)` : " (liste boş)"}.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">Kişi</th>
                  <th className="px-3 py-2 font-medium">Rol</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Eklenme</th>
                  <th className="px-3 py-2 font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {admins.map((a) => (
                  <PlatformAdminRow
                    key={a.id}
                    admin={{
                      id: a.id,
                      role: a.role,
                      disabled: a.disabledAt !== null,
                      email: a.user.email ?? "—",
                      name: displayName(a.user),
                      workshopName: a.user.workshop.name,
                      userActive: a.user.isActive,
                      isSelf: a.user.id === ctx.user.id,
                      createdAtLabel: a.createdAt.toLocaleDateString("tr-TR"),
                      createdByEmail: a.createdBy?.email ?? null,
                      sessionsValidFromLabel:
                        a.sessionsValidFrom?.toLocaleString("tr-TR") ?? null,
                    }}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="text-xs text-muted-foreground">
          Roller: {Object.values(ADMIN_ROLE_LABELS).join(" · ")}. Yetki matrisi{" "}
          <code>docs/operations/platform-admin-model.md</code> §2&apos;dedir.
        </p>
      </section>
    </div>
  )
}
