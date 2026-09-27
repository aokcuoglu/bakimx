import { redirect } from "next/navigation"

export default async function TeamSettingsRedirect({
  searchParams,
}: {
  searchParams: Promise<{ invite?: string }>
}) {
  const { invite } = await searchParams
  redirect(invite === "1" ? "/settings/members-and-teams/members?invite=1" : "/settings/members-and-teams/members")
}
