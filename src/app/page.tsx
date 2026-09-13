import { PublicSite } from "@/components/public/PublicSite";
import type { Metadata } from "next";
import { Header } from "@/components/sections/Header";
import { HeroSection } from "@/components/sections/HeroSection";
import {
  ProductTourSection,
  OperationsSection,
  GettingStartedSection,
} from "@/components/sections/LandingContent";
import { FAQSection } from "@/components/sections/FAQSection";
import { Footer } from "@/components/sections/Footer";
import { JsonLd } from "@/components/seo/json-ld";
import { LANDING_FAQ_ITEMS } from "@/lib/faq-data";
import { SITE_URL, HOME_TITLE, publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = {
  ...publicPageMetadata({
    path: "/",
    title: "Oto Servis Yönetim Platformu",
    description: "Araç kabul, iş emri, stok, müşteri ve tahsilat takibini BakımX ile tek yerde yönetin.",
  }),
  title: { absolute: HOME_TITLE },
};

const homeStructuredData = [
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: "BakımX",
    url: SITE_URL,
    logo: `${SITE_URL}/01-bakimx-primary-light.png`,
  },
  {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    mainEntity: LANDING_FAQ_ITEMS.map((item) => ({
      "@type": "Question",
      name: item.question,
      acceptedAnswer: { "@type": "Answer", text: item.answer },
    })),
  },
];

export default function Home() {
  return (
    <PublicSite landing>
      <JsonLd data={homeStructuredData} />
      <Header />
      <main>
        <HeroSection />
        <ProductTourSection />
        <OperationsSection />
        <GettingStartedSection />
        <FAQSection />
      </main>
      <Footer />
    </PublicSite>
  );
}
