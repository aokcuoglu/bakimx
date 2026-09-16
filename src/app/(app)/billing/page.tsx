import { redirect } from "next/navigation"

export const metadata = { title: "Paket ve kullanım" }

/** Preserve existing billing links while Account owns the visible surface. */
export default async function BillingPage({ searchParams }: {
  searchParams: Promise<{ pendingBlocked?: string }>
}) {
  const sp = await searchParams
  redirect(sp.pendingBlocked === "1" ? "/account?pendingBlocked=1#paket" : "/account#paket")
}
