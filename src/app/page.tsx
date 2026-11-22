import type { Metadata } from "next";
import { JsonLd } from "@/components/seo/json-ld";
import { CallbackDialogProvider } from "@/components/marketing/landing/callback-dialog";
import { LANDING_DESCRIPTION, LANDING_FAQ, PRICE } from "@/components/marketing/landing/content";
import { DayStrip } from "@/components/marketing/landing/day-strip";
import { Faq } from "@/components/marketing/landing/faq";
import { Features } from "@/components/marketing/landing/features";
import { FinalCta } from "@/components/marketing/landing/final-cta";
import { Hero } from "@/components/marketing/landing/hero";
import { LandingFooter } from "@/components/marketing/landing/landing-footer";
import { LandingHeader } from "@/components/marketing/landing/landing-header";
import { Move } from "@/components/marketing/landing/move";
import { Price } from "@/components/marketing/landing/price";
import styles from "@/components/marketing/landing/landing.module.css";
import { HOME_TITLE, ORGANIZATION_STRUCTURED_DATA, SITE_URL, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...publicPageMetadata({
    path: "/",
    title: "Oto Servis Yönetim Platformu",
    description: LANDING_DESCRIPTION,
  }),
  title: { absolute: HOME_TITLE },
};

const homeStructuredData = [
  ORGANIZATION_STRUCTURED_DATA,
  {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    name: "BakımX",
    applicationCategory: "BusinessApplication",
    operatingSystem: "Web",
    url: SITE_URL,
    description: LANDING_DESCRIPTION,
    offers: {
      "@type": "Offer",
      price: String(PRICE.monthlyPriceTry),
      priceCurrency: "TRY",
      url: `${SITE_URL}/register`,
    },
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LANDING_FAQ.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  },
];

/** Ana sayfa — e-santral.com/bakimx düzeni (#781, docs/superpowers/specs/2026-11-22-esantral-landing-design.md). */
export default function Home() {
  return (
    <CallbackDialogProvider>
      <div className={styles.page}>
        <JsonLd data={homeStructuredData} />
        <LandingHeader />
        <main>
          <Hero />
          <DayStrip />
          <Features />
          <Move />
          <Price />
          <Faq />
          <FinalCta />
        </main>
        <LandingFooter />
      </div>
    </CallbackDialogProvider>
  );
}
