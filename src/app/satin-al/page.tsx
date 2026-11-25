import { redirect } from "next/navigation"
import { SERVICE_PACKAGE } from "@/lib/plans-catalog"
import { PRIVATE_ROBOTS } from "@/lib/seo"

export const metadata = { title: "Satın Al", robots: PRIVATE_ROBOTS }

/**
 * Public paid checkout used to live here as PurchaseWizard. New signups now
 * share the same /register wizard as "Ücretsiz Dene"; keep this route as a
 * deep-link redirect so old /satin-al?tier=&cycle= bookmarks still work.
 * In-app upgrades continue on /checkout. Satışta tek paket var (#782): eski
 * `?tier=lite|premium` yer imleri de Servis Paketi kaydına iner.
 */
export default async function SatinAlPage({
  searchParams,
}: {
  searchParams: Promise<{ tier?: string | string[]; cycle?: string | string[] }>
}) {
  const sp = await searchParams
  const tier = SERVICE_PACKAGE.tier
  const cycle = sp.cycle === "yearly" ? "yearly" : "monthly"
  redirect(`/register?tier=${tier}&cycle=${cycle}`)
}
