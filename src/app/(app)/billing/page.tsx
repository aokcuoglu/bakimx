import { redirect } from "next/navigation"

export const metadata = { title: "Faturalandırma" }

/** Preserve existing billing links while settings billing owns the surface. */
export default async function BillingPage({ searchParams }: {
  searchParams: Promise<{ pendingBlocked?: string }>
}) {
  const sp = await searchParams
  redirect(sp.pendingBlocked === "1" ? "/settings/billing?pendingBlocked=1" : "/settings/billing")
}
