import { redirect } from "next/navigation"

export const metadata = { title: "Faturalandırma" }

export default async function AccountBillingRedirectPage({ searchParams }: {
  searchParams: Promise<{ pendingBlocked?: string }>
}) {
  const sp = await searchParams
  redirect(sp.pendingBlocked === "1" ? "/settings/billing?pendingBlocked=1" : "/settings/billing")
}
