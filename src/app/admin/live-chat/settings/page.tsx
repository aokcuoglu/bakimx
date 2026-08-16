import { requireAdminCapability } from "@/lib/admin"
import { availabilityOf, getLiveChatConfig } from "@/lib/live-chat/settings"
import { describeNextOpening } from "@/lib/live-chat/schedule"
import type { LiveChatSettingsValues } from "@/lib/validations/live-chat"
import { LiveChatTabs } from "../live-chat-tabs"
import { LiveChatSettingsForm } from "./live-chat-settings-form"

export const dynamic = "force-dynamic"

export default async function AdminLiveChatSettingsPage() {
  await requireAdminCapability("manageLiveChat")

  const config = await getLiveChatConfig()
  const availability = availabilityOf(config)

  const defaultValues: LiveChatSettingsValues = {
    enabled: config.enabled,
    timezone: config.timezone,
    greeting: config.greeting,
    offlineMessage: config.offlineMessage,
    responseNote: config.responseNote,
    holidays: config.holidays.join(", "),
    schedule: config.schedule,
  }

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h1 className="text-xl font-bold text-foreground sm:text-2xl">Canlı Destek Ayarları</h1>
        <p className="text-sm text-muted-foreground">
          Şu an{" "}
          <strong className={availability.online ? "text-success-strong" : "text-foreground"}>
            {config.enabled ? (availability.online ? "çevrimiçi" : "çevrimdışı") : "kapalı"}
          </strong>
          {config.enabled && !availability.online && ` — ${describeNextOpening(availability.nextOpening) ?? ""}`}
          {config.updatedByEmail && ` · Son düzenleyen: ${config.updatedByEmail}`}
        </p>
      </div>

      <LiveChatTabs />

      <LiveChatSettingsForm defaultValues={defaultValues} />
    </div>
  )
}
