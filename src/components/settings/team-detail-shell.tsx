import Link from "next/link"
import { Link2, Settings, Users } from "lucide-react"
import { SettingsRecordTitle } from "@/components/settings/settings-trail"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

export function TeamDetailShell({
  team,
  active,
  children,
}: {
  team: { id: string; name: string; memberCount: number; usageCount: number }
  active: "configuration" | "members" | "usage"
  children: React.ReactNode
}) {
  const base = `/settings/members-and-teams/teams/${team.id}`

  return (
    <div className="mx-auto min-w-0 max-w-3xl">
      <SettingsRecordTitle title={team.name} />
      <div className="flex items-center gap-3">
        <span className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-warning/15 text-base font-semibold text-warning-strong">
          {team.name.slice(0, 1).toLocaleUpperCase("tr")}
        </span>
        <div className="min-w-0">
          <h1 className="truncate text-xl font-semibold text-foreground">{team.name}</h1>
          <p className="text-sm text-muted-foreground">Ekip üyelerini ve yetkilerini yönetin.</p>
        </div>
      </div>
      <Tabs value={active} className="mt-4 min-w-0">
        <div className="max-w-full overflow-x-auto">
          {/* Telefonda dokunulan sayfa sekmesi: `line` + `size="control"` (#854). */}
          <TabsList variant="line" size="control" className="w-max min-w-full justify-start border-b border-border">
            <TabsTrigger value="configuration" asChild>
              <Link href={base}>
                <Settings className="size-3.5" />
                <span>Yapılandırma</span>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="members" asChild>
              <Link href={`${base}/members`}>
                <Users className="size-3.5" />
                <span>Üyeler</span>
                <span className="text-xs text-muted-foreground">{team.memberCount}</span>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="usage" asChild>
              <Link href={`${base}/usage`}>
                <Link2 className="size-3.5" />
                <span>Kullanım</span>
                <span className="text-xs text-muted-foreground">{team.usageCount}</span>
              </Link>
            </TabsTrigger>
          </TabsList>
        </div>
      </Tabs>
      <div className="pt-6">{children}</div>
    </div>
  )
}
