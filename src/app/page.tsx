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

export default function Home() {
  return (
    <>
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
        <DemoFormSection />
        <FinalCTASection />
      </main>
      <Footer />
    </>
  );
}
