import { redirect } from "next/navigation"

export const metadata = { title: "Profil" }

/** Keep existing profile bookmarks while /settings/account is the entry route. */
export default function LegacySettingsProfilePage() {
  redirect("/settings/account")
}
