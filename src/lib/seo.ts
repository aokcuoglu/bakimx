import type { Metadata } from "next"

export const SITE_URL = "https://bakimx.com"

export const INDEXABLE_ROUTES = [
  "/",
  "/oto-servis-programi",
  "/dijital-arac-kabul",
  "/is-emri-programi",
  "/rehber/arac-kabul-formu",
  "/fiyatlar",
  "/demo",
  "/status",
  "/terms",
  "/privacy",
  "/kvkk",
  "/acik-riza",
] as const

export function publicPageMetadata({
  path,
  title,
  description,
}: {
  path: (typeof INDEXABLE_ROUTES)[number]
  title: string
  description: string
}): Metadata {
  return {
    title,
    description,
    alternates: { canonical: path },
    openGraph: {
      title,
      description,
      url: path,
      type: "website",
      locale: "tr_TR",
      siteName: "BakimX",
    },
    twitter: {
      card: "summary_large_image",
      title,
      description,
    },
  }
}

export const PRIVATE_ROBOTS: Metadata["robots"] = {
  index: false,
  follow: false,
  googleBot: { index: false, follow: false },
}
