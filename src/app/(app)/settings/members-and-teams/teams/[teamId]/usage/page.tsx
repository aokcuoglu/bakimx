import { TeamDetailShell } from "@/components/settings/team-detail-shell"
import { PERMISSION_GROUPS, PERMISSION_LABELS } from "@/lib/roles"
import { loadTeamPage } from "../load-team"

export const metadata = { title: "Ekip kullanımı" }

export default async function TeamUsagePage({
  params,
}: {
  params: Promise<{ teamId: string }>
}) {
  const { teamId } = await params
  const loaded = await loadTeamPage(teamId)
  if ("paywall" in loaded && loaded.paywall) return loaded.paywall
  if (!("team" in loaded) || !loaded.team) {
    return <p className="py-12 text-center text-muted-foreground">İş yeri bilgisi bulunamadı</p>
  }
  const team = loaded.team
  const granted = new Set(team.permissions)

  return (
    <TeamDetailShell team={team} active="usage">
        <div className="space-y-4">
          <div>
            <h2 className="text-base font-semibold text-foreground">Bu ekip nerede geçerli</h2>
            <p className="text-sm text-muted-foreground">İşaretli yetkiler, ekip üyelerinin atölyede yapabildiği işlerdir.</p>
          </div>
          {PERMISSION_GROUPS.map((group) => (
            <section key={group.title} className="rounded-xl border border-border">
              <h3 className="border-b border-border px-3 py-2 text-xs font-medium text-muted-foreground">{group.title}</h3>
              {group.permissions.map((permission) => {
                const on = granted.has(permission)
                return (
                  <div key={permission} className="flex items-center justify-between gap-3 border-b border-border px-3 py-2 last:border-b-0">
                    <span className="text-sm text-foreground">{PERMISSION_LABELS[permission].label}</span>
                    <span className={on ? "text-xs font-medium text-success-strong" : "text-xs text-muted-foreground"}>
                      {on ? "Açık" : "Kapalı"}
                    </span>
                  </div>
                )
              })}
            </section>
          ))}
        </div>
    </TeamDetailShell>
  )
}
