import { redirect } from "next/navigation"

export const metadata = { title: "Ekip Yönetimi" }

export default async function TeamSettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const { invite } = await searchParams
  redirect(invite === "1" ? "/settings/members-and-teams/members?invite=1" : "/settings/members-and-teams/members")
}
