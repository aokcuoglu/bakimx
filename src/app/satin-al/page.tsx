import { redirect } from "next/navigation"
import { isSalePlanTier } from "@/lib/plan"
import { PRIVATE_ROBOTS } from "@/lib/seo"

export const metadata = { title: "Satın Al", robots: PRIVATE_ROBOTS }

/**
 * Public paid checkout used to live here as PurchaseWizard. New signups now
 * share the same /register wizard as "Ücretsiz Dene"; keep this route as a
 * deep-link redirect so old /satin-al?tier=&cycle= bookmarks still work.
 * In-app upgrades continue on /checkout.
 */
export default async function SatinAlPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[]; cycle?: string | string[] }>
}) {
  const sp = await searchParams
  const tier = isSalePlanTier(sp.tier) ? sp.tier : "pro"
  const cycle = sp.cycle === "yearly" ? "yearly" : "monthly"
  redirect(`/register?tier=${tier}&cycle=${cycle}`)
}
