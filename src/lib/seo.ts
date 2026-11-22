import type { Metadata } from "next"

export const BRAND_NAME = "BakımX"
export const TITLE_TEMPLATE = `%s | ${BRAND_NAME}`
export const HOME_TITLE = `${BRAND_NAME}: Oto Servis Yönetim Platformu`

/** Page names omit the brand; the root template adds it to browser titles. */
export function brandedTitle(title: string): string {
  return `${title} | ${BRAND_NAME}`
}

export const SITE_URL = "https://bakimx.com"

/** Google cuts snippets at roughly this many characters. */
export const META_DESCRIPTION_MAX_LENGTH = 160

/** Served by `src/app/opengraph-image.tsx`; resolved against `metadataBase`. */
export const DEFAULT_OG_IMAGE = {
  url: "/opengraph-image",
  width: 1200,
  height: 630,
  alt: "BakımX — Oto Servis Yönetim Platformu",
}

export const TWITTER_HANDLE = "@bakimxcom"

export const SOCIAL_PROFILE_URLS = [
  "https://www.linkedin.com/company/bakimx/",
  "https://www.instagram.com/bakimxcom",
  "https://x.com/bakimxcom",
]

export const ORGANIZATION_STRUCTURED_DATA = {
  "@context": "https://schema.org",
  "@type": "Organization",
  "@id": `${SITE_URL}/#organization`,
  name: BRAND_NAME,
  url: SITE_URL,
  logo: `${SITE_URL}/01-bakimx-primary-light.png`,
  sameAs: SOCIAL_PROFILE_URLS,
}

export const INDEXABLE_ROUTES = [
  "/",
  "/oto-servis-programi",
  "/dijital-arac-kabul",
  "/is-emri-programi",
  "/rehber/arac-kabul-formu",
  "/rehber/oto-servis-is-emri-nasil-hazirlanir",
  "/kilavuz",
  "/karsilastir/defter-excel-oto-servis-programi",
  "/blog",
  "/fiyatlar",
  "/demo",
  "/contact-us",
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
  image,
}: {
  path: PublicIndexablePath
  title: string
  description: string
  brandFirst?: boolean
  /** Page-specific share image; the site default otherwise. */
  image?: { url: string; alt?: string }
}): Metadata {
  const fullTitle = brandFirst ? `${BRAND_NAME} ${title}` : brandedTitle(title)
  return {
    title: brandFirst ? { absolute: fullTitle } : title,
    description,
    alternates: { canonical: path },
    // A page-level openGraph replaces the layout's wholesale (shallow merge), so
    // the image has to be repeated here or the page ships without one.
    openGraph: {
      title: fullTitle,
      description,
      url: path,
      type: "website",
      locale: "tr_TR",
      siteName: BRAND_NAME,
      images: [image ?? DEFAULT_OG_IMAGE],
    },
    // No `images`: Next copies openGraph.images into the X card while this is
    // unset, which keeps a page image (e.g. a blog cover) on both.
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
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
