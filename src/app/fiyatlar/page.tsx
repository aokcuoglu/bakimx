import Link from "next/link"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { PlanPackages } from "@/components/billing/plan-packages"
import { JsonLd } from "@/components/seo/json-ld"
import { PLAN_PACKAGES } from "@/lib/plans-catalog"
import { publicPageMetadata, SITE_URL } from "@/lib/seo"

const description =
  "BakımX oto servis programı paketlerini ve KDV dahil fiyatlarını karşılaştırın. 7 iş günü ücretsiz deneyin; aylık veya yıllık planınızı seçin."

export const metadata = publicPageMetadata({
  path: "/fiyatlar",
  title: "Oto Servis Programı Fiyatları",
  description,
})

const softwareApplicationStructuredData = {
  "@context": "https://schema.org",
  "@type": "SoftwareApplication",
  name: "BakımX",
  applicationCategory: "BusinessApplication",
  operatingSystem: "Web",
  url: `${SITE_URL}/fiyatlar`,
  description,
  offers: PLAN_PACKAGES.map((plan) => ({
    "@type": "Offer",
    name: `${plan.name} aylık plan`,
    price: plan.monthlyPrice.toString(),
    priceCurrency: "TRY",
    url: `${SITE_URL}/register?tier=${plan.tier}&cycle=monthly`,
  })),
}

export default function FiyatlarPage() {
  return (
    <>
      <JsonLd data={softwareApplicationStructuredData} />
      <Header />
      <main className="mx-auto max-w-7xl px-4 py-12 sm:px-6 space-y-8">
        <div className="text-center">
          <h1 className="text-2xl sm:text-3xl font-bold text-foreground">Oto servis programı paketleri ve fiyatları</h1>
          <p className="text-sm text-muted-foreground mt-2 max-w-xl mx-auto">
            İş yerinize uygun paketi seçin. Kart bilgisi olmadan{" "}
            <Link href="/register" className="text-primary underline underline-offset-2">ücretsiz deneyin</Link>
            ; deneme bitince uygulama içinden paketinizi etkinleştirirsiniz.
          </p>
        </div>
        <PlanPackages checkoutBasePath="/register" />
      </main>
      <Footer />
    </>
  )
}
