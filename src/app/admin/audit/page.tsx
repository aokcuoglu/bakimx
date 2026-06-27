import Link from "next/link"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import type { Prisma } from "@prisma/client"

export const dynamic = "force-dynamic"

const PAGE_SIZE = 50

/** Friendly labels for known audit actions; unknown actions fall back to raw. */
const ACTION_LABELS: Record<string, string> = {
  admin_workshop_approved: "İş yeri onaylandı",
  admin_workshop_rejected: "İş yeri reddedildi",
  admin_plan_activated: "Plan etkinleştirildi",
  admin_extra_seats_set: "Ek koltuk ayarlandı",
  billing_order_confirmed: "Havale teyit edildi",
  billing_order_cancelled: "Sipariş iptal edildi",
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

  const [logs, total, workshops] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: "desc" },
      take: PAGE_SIZE,
      skip: (page - 1) * PAGE_SIZE,
      include: {
        workshop: { select: { name: true } },
        actorUser: { select: { email: true } },
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.workshop.findMany({ orderBy: { name: "asc" }, select: { id: true, name: true } }),
  ])

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))
  const knownActions = Object.keys(ACTION_LABELS)

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
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Denetim Kaydı</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tüm yönetici işlemleri. {total} kayıt.
        </p>
      </div>

      {/* GET form — no client JS needed; filters live in the URL. */}
      <form method="get" className="flex flex-wrap items-end gap-3">
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          İş yeri
          <select
            name="workshopId"
            defaultValue={sp.workshopId ?? ""}
            className="h-9 rounded-lg border border-border bg-white px-2 text-sm text-foreground"
          >
            <option value="">Tümü</option>
            {workshops.map((w) => (
              <option key={w.id} value={w.id}>
                {w.name}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs text-muted-foreground">
          İşlem
          <select
            name="action"
            defaultValue={sp.action ?? ""}
            className="h-9 rounded-lg border border-border bg-white px-2 text-sm text-foreground"
          >
            <option value="">Tümü</option>
            {knownActions.map((a) => (
              <option key={a} value={a}>
                {ACTION_LABELS[a]}
              </option>
            ))}
          </select>
        </label>
        <button
          type="submit"
          className="h-9 rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90"
        >
          Filtrele
        </button>
        {(sp.workshopId || sp.action) && (
          <Link href="/admin/audit" className="h-9 inline-flex items-center text-sm text-muted-foreground hover:text-foreground">
            Temizle
          </Link>
        )}
      </form>

      {logs.length === 0 ? (
        <p className="text-sm text-muted-foreground">Kayıt bulunamadı.</p>
      ) : (
        <div className="overflow-x-auto rounded-lg border bg-card">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b text-left text-xs text-muted-foreground">
                <th className="px-3 py-2 font-medium">Tarih</th>
                <th className="px-3 py-2 font-medium">İşlem</th>
                <th className="px-3 py-2 font-medium">İş yeri</th>
                <th className="px-3 py-2 font-medium">Yapan</th>
                <th className="px-3 py-2 font-medium">Detay</th>
              </tr>
            </thead>
            <tbody>
              {logs.map((l) => (
                <tr key={l.id} className="border-b last:border-0 align-top">
                  <td className="px-3 py-2 whitespace-nowrap text-muted-foreground">
                    {l.createdAt.toLocaleString("tr-TR")}
                  </td>
                  <td className="px-3 py-2 font-medium text-foreground">
                    {ACTION_LABELS[l.action] ?? l.action}
                  </td>
                  <td className="px-3 py-2">
                    <Link href={`/admin/workshops/${l.workshopId}`} className="text-primary hover:underline">
                      {l.workshop?.name ?? l.workshopId}
                    </Link>
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{l.actorUser?.email ?? "sistem"}</td>
                  <td className="px-3 py-2 font-mono text-xs text-muted-foreground">{l.metadataJson ?? "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            Sayfa {page} / {totalPages}
          </span>
          <div className="flex gap-2">
            {page > 1 && (
              <Link
                href={buildHref({ page: String(page - 1) })}
                className="rounded-lg border px-3 py-1.5 hover:bg-muted"
              >
                Önceki
              </Link>
            )}
            {page < totalPages && (
              <Link
                href={buildHref({ page: String(page + 1) })}
                className="rounded-lg border px-3 py-1.5 hover:bg-muted"
              >
                Sonraki
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  )
}
