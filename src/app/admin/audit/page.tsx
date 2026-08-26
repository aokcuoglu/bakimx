import Link from "next/link"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"
import { Filter } from "lucide-react"
import { Button } from "@/components/ui/button"
import { FilterSelect } from "@/components/shared/filter-select"
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table"
import { auditActionLabel } from "@/lib/admin/activity-labels"
import { AuditLogDetailDialog } from "./audit-log-detail-dialog"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 10

/** Friendly labels for known audit actions; unknown actions fall back to raw. */
const ACTION_LABELS: Record<string, string> = {
  admin_workshop_approved: "İş yeri onaylandı",
  admin_workshop_rejected: "İş yeri reddedildi",
  admin_plan_activated: "Plan etkinleştirildi",
  admin_extra_seats_set: "Ek koltuk ayarlandı",
  billing_order_confirmed: "Havale teyit edildi",
  billing_order_cancelled: "Sipariş iptal edildi",
  admin_support_request_status: "Destek talebi durumu değişti",
  admin_support_request_linked: "Destek talebi iş yerine bağlandı",
  admin_support_request_assigned: "Destek talebi atandı",
  admin_support_request_note: "Destek talebi iç notu güncellendi",
  platform_admin_added: "Platform yöneticisi eklendi",
  platform_admin_role_changed: "Yönetici rolü değişti",
  platform_admin_disabled: "Yönetici erişimi kapatıldı",
  platform_admin_enabled: "Yönetici erişimi açıldı",
  platform_admin_sessions_revoked: "Yönetici oturumları kapatıldı",
  platform_admin_sso_login: "Google SSO ile giriş yapıldı",
  platform_admin_sso_bootstrap: "Google SSO ile ilk giriş (env bootstrap)",
  platform_admin_sso_rejected: "Google SSO girişi reddedildi",
  platform_admin_break_glass_login: "Acil durum hesabıyla giriş yapıldı",
  impersonation_started: "Taklit oturumu başladı",
  impersonation_ended: "Taklit oturumu kapandı",
  impersonation_revoked: "Taklit oturumu iptal edildi",
  password_reset_sent: "Şifre sıfırlama bağlantısı gönderildi",
}

/** Yönetici eylemleri bu sayfaya özeldir; geri kalanı ortak kullanıcı dili
 * sözlüğünden gelir. Böylece DB anahtarları yönetici yüzeyinde görünmez. */
function displayActionLabel(action: string) {
  return ACTION_LABELS[action] ?? auditActionLabel(action)
}

interface AuditSearchParams {
  workshopId?: string
  action?: string
  page?: string
}

export default async function AdminAuditPage({
  searchParams,
}: {
  searchParams: Promise<AuditSearchParams>
}) {
  await requireAdminCapability("viewAudit")
  const sp = await searchParams

  const page = Math.max(1, Number.parseInt(sp.page ?? "1", 10) || 1)
  const where: Prisma.AuditLogWhereInput = {}
  if (sp.workshopId) where.workshopId = sp.workshopId
  if (sp.action) where.action = sp.action

  const [logs, total, workshops, actions] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        workshop: { select: { name: true } },
        // `username` şart: e-postasız bir kullanıcının işlemi "sistem" diye
        // görünürse denetim kaydı yanlış kişiye yazılmış olur (BAK-40).
        actorUser: { select: { email: true, username: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.workshop.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
    prisma.auditLog.findMany({ distinct: ["action"], orderBy: { action: "asc" }, select: { action: true } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const knownActions = actions.map(({ action }) => action)

  const entityLabel = (entityType: string, entityId: string) => {
    const labels: Record<string, string> = {
      Workshop: "İş yeri",
      ImpersonationSession: "Taklit oturumu",
      SupportRequest: "Destek talebi",
      User: "Kullanıcı",
    }
    return `${labels[entityType] ?? entityType} · ${entityId}`
  }

  const buildHref = (overrides: Partial<AuditSearchParams>) => {
    const next = { ...sp, ...overrides }
    const qs = new URLSearchParams()
    if (next.workshopId) qs.set("workshopId", next.workshopId)
    if (next.action) qs.set("action", next.action)
    if (next.page && next.page !== "1") qs.set("page", next.page)
    const str = qs.toString()
    return str ? `/admin/audit?${str}` : "/admin/audit"
  }

  return (
    <div className="space-y-7">
      <div className="space-y-1">
        <p className="text-sm font-medium text-primary">Platform operasyonları</p>
        <h1 className="text-2xl font-bold tracking-tight text-foreground sm:text-3xl">Denetim Kaydı</h1>
        <p className="text-sm text-muted-foreground">
          Tüm yönetici işlemleri. {total} kayıt.
        </p>
      </div>

      {/* GET form keeps filters shareable while matching the workshop activity table. */}
      <section className="space-y-3 rounded-xl border bg-card p-5 shadow-sm">
        <div className="flex flex-col justify-between gap-3 lg:flex-row lg:items-center">
          <div>
            <h2 className="text-sm font-semibold text-foreground">Denetim işlemleri</h2>
            <p className="mt-0.5 text-xs text-muted-foreground">Platformdaki yönetici işlemleri sayfalanır ve filtrelenir.</p>
          </div>
          <form method="get" className="flex flex-wrap items-center gap-2 rounded-lg bg-muted/60 px-3 py-2">
            <Filter className="size-4 text-muted-foreground" aria-hidden="true" />
            <label>
              <span className="sr-only">İş yeri</span>
              <FilterSelect
                name="workshopId"
                defaultValue={sp.workshopId ?? ""}
                placeholder="Tüm iş yerleri"
                className="h-8 w-44 bg-background"
                autoSubmit
                options={[{ value: "", label: "Tüm iş yerleri" }, ...workshops.map((w) => ({ value: w.id, label: w.name }))]}
              />
            </label>
            <label>
              <span className="sr-only">İşlem</span>
              <FilterSelect
                name="action"
                defaultValue={sp.action ?? ""}
                placeholder="Tüm işlemler"
                className="h-8 w-44 bg-background"
                autoSubmit
                options={[{ value: "", label: "Tüm işlemler" }, ...knownActions.map((action) => ({ value: action, label: displayActionLabel(action) }))]}
              />
            </label>
          </form>
        </div>

        {logs.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">Bu filtreyle eşleşen işlem yok.</p>
        ) : (
          <div className="overflow-hidden rounded-lg border">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>İşlem</TableHead>
                  <TableHead>İş yeri</TableHead>
                  <TableHead>Yapan</TableHead>
                  <TableHead className="text-right">Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {logs.map((log) => (
                  <TableRow key={log.id}>
                    <TableCell>
                      <AuditLogDetailDialog
                        actionLabel={displayActionLabel(log.action)}
                        metadataJson={log.metadataJson}
                        workshopName={log.workshop?.name ?? log.workshopId}
                        actorLabel={log.actorUser ? (log.actorUser.email ?? log.actorUser.username ?? "—") : "sistem"}
                        dateLabel={log.createdAt.toLocaleString("tr-TR", {
                          dateStyle: "long",
                          timeStyle: "short",
                          timeZone: "Europe/Istanbul",
                        })}
                        entityLabel={entityLabel(log.entityType, log.entityId)}
                      />
                    </TableCell>
                    <TableCell>
                      <Link href={`/admin/workshops/${log.workshopId}`} className="text-primary hover:underline">
                        {log.workshop?.name ?? log.workshopId}
                      </Link>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {log.actorUser ? (log.actorUser.email ?? log.actorUser.username ?? "—") : "sistem"}
                    </TableCell>
                    <TableCell className="text-right text-muted-foreground">
                      {log.createdAt.toLocaleDateString("tr-TR")}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </section>

      <div className="flex items-center justify-between gap-3 pt-1 text-sm">
          <span className="text-muted-foreground">
            Sayfa {page} / {totalPages} · {total} kayıt
          </span>
          <div className="flex gap-2">
            {page > 1 ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildHref({ page: String(page - 1) })}>
                  Önceki
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Önceki</Button>
            )}
            {page < totalPages ? (
              <Button variant="outline" size="sm" asChild>
                <Link href={buildHref({ page: String(page + 1) })}>
                  Sonraki
                </Link>
              </Button>
            ) : (
              <Button variant="outline" size="sm" disabled>Sonraki</Button>
            )}
          </div>
      </div>
    </div>
  )
}
