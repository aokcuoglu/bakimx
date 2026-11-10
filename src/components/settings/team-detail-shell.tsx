import Link from "next/link"
import { ArrowLeft, Link2, Settings, Users } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const listClass =
  "flex h-auto w-max min-w-full items-end justify-start gap-1 border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-auto"
const triggerClass =
  "mb-1 h-7 shrink-0 rounded-lg px-2 after:bottom-[-5px] after:h-px data-[state=active]:border-transparent data-[state=active]:bg-muted data-[state=active]:shadow-none"

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
      <Link href="/settings/members-and-teams/teams" className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="size-3.5" />
        Geri
      </Link>
      <div className="mt-4 flex items-center gap-3">
        <span className="flex size-10 items-center justify-center rounded-lg bg-warning/15 text-base font-semibold text-warning-strong">
          {team.name.slice(0, 1).toLocaleUpperCase("tr")}
        </span>
        <div>
          <h1 className="text-xl font-semibold text-foreground">{team.name}</h1>
          <p className="text-sm text-muted-foreground">Ekip üyelerini ve yetkilerini yönetin.</p>
        </div>
      </div>
      <Tabs value={active} className="mt-4 min-w-0">
        <div className="max-w-full overflow-x-auto">
          <TabsList variant="line" className={listClass}>
            <TabsTrigger value="configuration" className={triggerClass} asChild>
              <Link href={base}>
                <Settings className="size-3.5" />
                <span>Yapılandırma</span>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="members" className={triggerClass} asChild>
              <Link href={`${base}/members`}>
                <Users className="size-3.5" />
                <span>Üyeler</span>
                <span className="text-xs text-muted-foreground">{team.memberCount}</span>
              </Link>
            </TabsTrigger>
            <TabsTrigger value="usage" className={triggerClass} asChild>
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
