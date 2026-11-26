import Link from "next/link"
import { User, Users } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

/**
 * Telefonda dokunulan sayfa sekmesi: `line` + `size="control"` (telefonda 44px,
 * md+ 36px). Ölçü ve seçili görünüm varyanttan gelir; çağrı yeri yalnız yerleşim
 * verir (#854, docs/ui-control-sizing.md).
 */
export function MembersTeamsTabs({ active }: { active: "members" | "teams" }) {
  return (
    <Tabs value={active}>
      <TabsList variant="line" size="control" className="w-full justify-start border-b border-border">
        <TabsTrigger value="members" asChild>
          <Link href="/settings/members-and-teams/members">
            <User className="size-3.5" />
            <span>Üyeler</span>
          </Link>
        </TabsTrigger>
        <TabsTrigger value="teams" asChild>
          <Link href="/settings/members-and-teams/teams">
            <Users className="size-3.5" />
            <span>Ekipler</span>
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
