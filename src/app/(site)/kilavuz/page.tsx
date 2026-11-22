import type { Metadata } from "next"
import { Footer } from "@/components/sections/Footer"
import { PublicSite } from "@/components/public/PublicSite"
import { JsonLd } from "@/components/seo/json-ld"
import { KilavuzShell } from "@/components/guide/kilavuz-shell"
import {
  KILAVUZ_CONTENT_OWNER,
  KILAVUZ_DESCRIPTION,
  KILAVUZ_H1,
  KILAVUZ_PATH,
  KILAVUZ_SECTIONS,
  KILAVUZ_TITLE,
} from "@/lib/guide/kilavuz"
import { publicPageMetadata, SITE_URL } from "@/lib/seo"

export const metadata: Metadata = publicPageMetadata({
  path: KILAVUZ_PATH,
  title: KILAVUZ_TITLE,
  description: KILAVUZ_DESCRIPTION,
})

const articleStructuredData = {
  "@context": "https://schema.org",
  "@type": "TechArticle",
  headline: KILAVUZ_TITLE,
  description: KILAVUZ_DESCRIPTION,
  url: `${SITE_URL}${KILAVUZ_PATH}`,
  datePublished: KILAVUZ_CONTENT_OWNER.publishedAt,
  dateModified: KILAVUZ_CONTENT_OWNER.updatedAt,
  author: { "@type": "Organization", name: KILAVUZ_CONTENT_OWNER.role },
  publisher: { "@type": "Organization", name: "BakımX" },
  inLanguage: "tr-TR",
}

const howToStructuredData = {
  "@context": "https://schema.org",
  "@type": "HowTo",
  name: KILAVUZ_H1,
  description: KILAVUZ_DESCRIPTION,
  step: KILAVUZ_SECTIONS.map((section) => ({
    "@type": "HowToStep",
    name: section.title,
    url: `${SITE_URL}${KILAVUZ_PATH}#${section.id}`,
  })),
}

export default function KilavuzPage() {
  return (
    <PublicSite editorial>
      <JsonLd data={[articleStructuredData, howToStructuredData]} />
      <KilavuzShell />
      <div className="print:hidden">
        <Footer />
      </div>
    </PublicSite>
  )
}
