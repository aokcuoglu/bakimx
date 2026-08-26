import type { Metadata } from "next";
import { AnnouncementBar } from "@/components/sections/AnnouncementBar";
import { Header } from "@/components/sections/Header";
import { HeroSection } from "@/components/sections/HeroSection";
import { PartnersStrip } from "@/components/sections/PartnersStrip";
import { RuhsatDemoSection } from "@/components/sections/RuhsatDemoSection";
import { FeatureShowcaseSection } from "@/components/sections/FeatureShowcaseSection";
import { StandOutSection } from "@/components/sections/StandOutSection";
import { SegmentsSection } from "@/components/sections/SegmentsSection";
import { BeforeAfterSection } from "@/components/sections/BeforeAfterSection";
import { TrustOnboardingSection } from "@/components/sections/TrustOnboardingSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { DemoFormSection } from "@/components/sections/DemoFormSection";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { Footer } from "@/components/sections/Footer";
import { JsonLd } from "@/components/seo/json-ld";
import { LANDING_FAQ_ITEMS } from "@/lib/faq-data";
import { SITE_URL } from "@/lib/seo";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
  openGraph: { url: "/" },
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
    <>
      <JsonLd data={homeStructuredData} />
      <AnnouncementBar />
      <Header />
      <main>
        <HeroSection />
        <PartnersStrip />
        <RuhsatDemoSection />
        <FeatureShowcaseSection />
        <StandOutSection />
        <SegmentsSection />
        <BeforeAfterSection />
        <TrustOnboardingSection />
        <FAQSection />
        <FinalCTASection />
        <DemoFormSection />
      </main>
      <Footer />
    </>
  );
}
