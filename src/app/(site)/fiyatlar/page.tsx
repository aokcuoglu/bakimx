import { PublicSite } from "@/components/public/PublicSite"
import styles from "./pricing.module.css"
import { isLiteRegistrationOpen } from "@/lib/lite-campaign"
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
    <PublicSite customLayout>
      <div className={styles.page}>
        <JsonLd data={softwareApplicationStructuredData} />
        <main className="bg-card pb-20">
          <div className="mx-auto max-w-5xl px-5 pb-8 pt-16 text-center sm:pt-24 lg:pt-28">
            <h1 className="text-4xl font-semibold tracking-[-0.015em] text-foreground sm:text-5xl lg:text-[56px] lg:leading-[60px] text-balance">
              Servisinizle büyür.
            </h1>
            <p className="mx-auto mt-5 max-w-2xl text-lg leading-[26px] text-foreground sm:text-xl text-balance">
              Servisinizin her aşaması için tasarlandı.<br />
              Bugün başlayın, kart bilgisi gerekmez.
            </p>
          </div>
          <div className="mx-auto max-w-[1124px] px-5 sm:px-8">
            <PlanPackages presentation="public" checkoutBasePath="/register" liteRegistrationOpen={isLiteRegistrationOpen()} />
          </div>
        </main>
        <Footer />
      </div>
    </PublicSite>
  )
}
