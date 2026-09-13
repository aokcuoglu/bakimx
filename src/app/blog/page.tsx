import { PublicSite } from "@/components/public/PublicSite"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { BlogIndex } from "@/components/sections/BlogIndex"
import { JsonLd } from "@/components/seo/json-ld"
import { SITE_URL } from "@/lib/seo"

const description =
  "BakımX blog: oto servis operasyonu, dijital araç kabul, iş emri ve atölye yazılımı üzerine rehberler."

const blogStructuredData = {
  "@context": "https://schema.org",
  "@type": "Blog",
  name: "BakımX Blog",
  description,
  url: `${SITE_URL}/blog`,
  publisher: {
    "@type": "Organization",
    name: "BakımX",
    url: SITE_URL,
  },
  inLanguage: "tr-TR",
}

export default function BlogPage() {
  return (
    <PublicSite landing frame={false}>
      <JsonLd data={blogStructuredData} />
      <Header />
      <BlogIndex />
      <Footer />
    </PublicSite>
  )
}
