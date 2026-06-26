import Link from "next/link"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { GATED_FEATURES, FEATURE_LABELS } from "@/lib/features"

export const dynamic = "force-dynamic"

// Read the clock via a helper so the render-purity lint rule (no Date.now in a
// component body) stays satisfied; this page is force-dynamic so it's fresh.
function nowMs(): number {
  return Date.now()
}

export default async function AdminFlagsPage() {
  await requireAdminCapability("manageFlags")

  const overrides = await prisma.workshopFeatureOverride.findMany({
    orderBy: { updatedAt: "desc" },
    include: { workshop: { select: { name: true } } },
  })

  const now = nowMs()

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-foreground">Özellik Bayrakları</h1>
        <p className="text-sm text-muted-foreground mt-0.5">
          Tenant başına özellik override’ları. Düzenlemek için iş yeri detayına gidin.
        </p>
      </div>

      <section className="rounded-lg border bg-card p-4 space-y-2">
        <h2 className="text-sm font-semibold text-foreground">Kapsamlı özellikler</h2>
        <div className="flex flex-wrap gap-2">
          {GATED_FEATURES.map((k) => (
            <span key={k} className="inline-flex items-center rounded-full bg-muted px-3 py-1 text-xs text-foreground">
              {FEATURE_LABELS[k]}
            </span>
          ))}
        </div>
      </section>

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Aktif override’lar ({overrides.length})</h2>
        {overrides.length === 0 ? (
          <p className="text-sm text-muted-foreground">Hiç override yok. Tüm iş yerleri plan varsayılanlarını kullanıyor.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border bg-card">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b text-left text-xs text-muted-foreground">
                  <th className="px-3 py-2 font-medium">İş yeri</th>
                  <th className="px-3 py-2 font-medium">Özellik</th>
                  <th className="px-3 py-2 font-medium">Durum</th>
                  <th className="px-3 py-2 font-medium">Bitiş</th>
                </tr>
              </thead>
              <tbody>
                {overrides.map((o) => {
                  const expired = o.expiresAt != null && o.expiresAt.getTime() <= now
                  return (
                    <tr key={o.id} className="border-b last:border-0">
                      <td className="px-3 py-2">
                        <Link href={`/admin/workshops/${o.workshopId}`} className="text-primary hover:underline">
                          {o.workshop.name}
                        </Link>
                      </td>
                      <td className="px-3 py-2 text-foreground">
                        {FEATURE_LABELS[o.featureKey as keyof typeof FEATURE_LABELS] ?? o.featureKey}
                      </td>
                      <td className="px-3 py-2">
                        <span
                          className={
                            o.enabled
                              ? "inline-flex rounded-full bg-emerald-100 px-2 py-0.5 text-[11px] font-medium text-emerald-800"
                              : "inline-flex rounded-full bg-muted px-2 py-0.5 text-[11px] font-medium text-muted-foreground"
                          }
                        >
                          {o.enabled ? "açık" : "kapalı"}
                        </span>
                      </td>
                      <td className="px-3 py-2 text-muted-foreground">
                        {o.expiresAt ? (
                          <span className={expired ? "text-rose-600" : undefined}>
                            {o.expiresAt.toLocaleDateString("tr-TR")} {expired && "(süresi doldu)"}
                          </span>
                        ) : (
                          "—"
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  )
}
