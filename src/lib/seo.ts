import type { Metadata } from "next"

export const BRAND_NAME = "BakımX"
export const TITLE_TEMPLATE = `%s | ${BRAND_NAME}`
export const HOME_TITLE = `${BRAND_NAME}: Oto Servis Yönetim Platformu`

/** Page names omit the brand; the root template adds it to browser titles. */
export function brandedTitle(title: string): string {
  return `${title} | ${BRAND_NAME}`
}

export const SITE_URL = "https://bakimx.com"

export const INDEXABLE_ROUTES = [
  "/",
  "/oto-servis-programi",
  "/dijital-arac-kabul",
  "/is-emri-programi",
  "/rehber/arac-kabul-formu",
  "/rehber/oto-servis-is-emri-nasil-hazirlanir",
  "/karsilastir/defter-excel-oto-servis-programi",
  "/fiyatlar",
  "/demo",
  "/status",
  "/terms",
  "/privacy",
  "/kvkk",
  "/acik-riza",
] as const

export type PublicIndexablePath =
  | (typeof INDEXABLE_ROUTES)[number]
  | "/blog"
  | "/contact-us"
  | `/blog/${string}`

export function publicPageMetadata({
  path,
  title,
  description,
  brandFirst = false,
}: {
  path: PublicIndexablePath
  title: string
  description: string
  brandFirst?: boolean
}): Metadata {
  const fullTitle = brandFirst ? `${BRAND_NAME} ${title}` : brandedTitle(title)
  return {
    title: brandFirst ? { absolute: fullTitle } : title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      type: "website",
      locale: "tr_TR",
      siteName: BRAND_NAME,
    },
    twitter: {
      card: "summary_large_image",
      title: fullTitle,
      description,
    },
  }
}

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
}
