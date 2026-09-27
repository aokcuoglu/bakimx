import Link from "next/link"
import { User, Users } from "lucide-react"
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"

const listClass =
  "flex h-auto w-full items-end justify-start gap-1 border-b border-border bg-transparent p-0 group-data-horizontal/tabs:h-auto"
const triggerClass =
  "mb-1 h-7 rounded-lg px-2 after:bottom-[-5px] after:h-px data-[state=active]:border-transparent data-[state=active]:bg-muted data-[state=active]:shadow-none"

export function MembersTeamsTabs({ active }: { active: "members" | "teams" }) {
  return (
    <Tabs value={active}>
      <TabsList variant="line" className={listClass}>
        <TabsTrigger value="members" className={triggerClass} asChild>
          <Link href="/settings/members-and-teams/members">
            <User className="size-3.5" />
            <span>Üyeler</span>
          </Link>
        </TabsTrigger>
        <TabsTrigger value="teams" className={triggerClass} asChild>
          <Link href="/settings/members-and-teams/teams">
            <Users className="size-3.5" />
            <span>Ekipler</span>
          </Link>
        </TabsTrigger>
      </TabsList>
    </Tabs>
  )
}
