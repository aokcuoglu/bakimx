import { redirect } from "next/navigation"
import { SETTINGS_TAB_REDIRECTS } from "@/lib/settings-nav"

export const metadata = {
  title: "Ayarlar",
}

/** Legacy hub: map `?tab=` to path-based settings, else account settings. */
export default async function SettingsHubPage({
  searchParams,
}: {
  searchParams: Promise<{ tab?: string }>
}) {
  const params = await searchParams
  const tab = params.tab
  if (tab && SETTINGS_TAB_REDIRECTS[tab]) {
    redirect(SETTINGS_TAB_REDIRECTS[tab])
  }
  redirect("/settings/account")
}
