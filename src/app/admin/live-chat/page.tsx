import { requireAdminCapability } from "@/lib/admin"
import { availabilityOf, getLiveChatConfig } from "@/lib/live-chat/settings"
import { describeNextOpening } from "@/lib/live-chat/schedule"
import { Badge } from "@/components/ui/badge"
import { LiveChatTabs } from "./live-chat-tabs"
import { LiveChatInbox } from "./live-chat-inbox"
import { getInbox, getThread, type InboxFilter } from "./data"

export const dynamic = "force-dynamic"

const FILTERS: InboxFilter[] = ["open", "closed", "all"]

function normalizeFilter(value: string | undefined): InboxFilter {
  return FILTERS.includes(value as InboxFilter) ? (value as InboxFilter) : "open"
}

export default async function AdminLiveChatPage({
  searchParams,
}: {
  // Next.js 16: searchParams bir Promise'dır ve await edilmelidir (AGENTS.md).
  searchParams: Promise<{ filter?: string; c?: string }>
}) {
  await requireAdminCapability("manageLiveChat")

  const params = await searchParams
  const filter = normalizeFilter(params.filter)

  const [rows, thread, config] = await Promise.all([
    getInbox(filter),
    params.c ? getThread(params.c) : Promise.resolve(null),
    getLiveChatConfig(),
  ])

  const availability = availabilityOf(config)

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-xl font-bold text-foreground sm:text-2xl">Canlı Destek</h1>
          {config.enabled ? (
            <Badge variant={availability.online ? "default" : "secondary"}>
              {availability.online ? "Çevrimiçi" : "Çevrimdışı"}
            </Badge>
          ) : (
            <Badge variant="destructive">Kapalı</Badge>
          )}
        </div>
        <p className="text-sm text-muted-foreground">
          www.bakimx.com widget&apos;ından gelen görüşmeler. Liste 5 saniyede bir tazelenir.
          {!availability.online && config.enabled && ` ${describeNextOpening(availability.nextOpening) ?? ""}`}
        </p>
      </div>

      <LiveChatTabs />

      <LiveChatInbox rows={rows} thread={thread} filter={filter} />
    </div>
  )
}
