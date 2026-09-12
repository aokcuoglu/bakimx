import { isLiteRegistrationOpen } from "@/lib/lite-campaign"
import { Header } from "@/components/sections/Header"
import { Footer } from "@/components/sections/Footer"
import { PlanPackages } from "@/components/billing/plan-packages"
import { JsonLd } from "@/components/seo/json-ld"
import { PLAN_PACKAGES } from "@/lib/plans-catalog"
import { publicPageMetadata, SITE_URL } from "@/lib/seo"

const description =
  "BakımX oto servis programı paketlerini ve KDV dahil fiyatlarını karşılaştırın. Lite kampanyasında süresiz 0 TL kullanın; ücretli paketleri karşılaştırın."

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

export const dynamic = "force-dynamic"

export default function FiyatlarPage() {
  return (
    <>
      <JsonLd data={softwareApplicationStructuredData} />
      <Header />
      <main className="bg-card pb-20">
        <div className="mx-auto max-w-4xl px-5 pb-9 pt-20 text-center sm:pt-28 lg:pt-32">
          <h1 className="text-4xl font-semibold tracking-tight text-foreground sm:text-5xl lg:text-6xl text-balance">
            Servisiniz büyürken, BakımX yanınızda.
          </h1>
          <p className="mx-auto mt-6 max-w-2xl text-lg leading-relaxed text-muted-foreground sm:text-xl text-balance">
            İlk iş emrinden büyüyen ekibinize, size uygun bir paket.
            Kart bilgisi gerekmeden bugün başlayın.
          </p>
        </div>
        <div className="mx-auto max-w-7xl px-5 sm:px-8">
          <PlanPackages presentation="public" checkoutBasePath="/register" liteRegistrationOpen={isLiteRegistrationOpen()} />
        </div>
      </main>
      <Footer />
    </>
  )
}
