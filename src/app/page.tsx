import { AnnouncementBar } from "@/components/sections/AnnouncementBar";
import { Header } from "@/components/sections/Header";
import { HeroSection } from "@/components/sections/HeroSection";
import { PillarsSection } from "@/components/sections/PillarsSection";
import { PartnersStrip } from "@/components/sections/PartnersStrip";
import { RuhsatDemoSection } from "@/components/sections/RuhsatDemoSection";
import { FeatureShowcaseSection } from "@/components/sections/FeatureShowcaseSection";
import { StandOutSection } from "@/components/sections/StandOutSection";
import { BeforeAfterSection } from "@/components/sections/BeforeAfterSection";
import { FAQSection } from "@/components/sections/FAQSection";
import { FinalCTASection } from "@/components/sections/FinalCTASection";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main>
        <HeroSection />
        <PillarsSection />
        <PartnersStrip />
        <RuhsatDemoSection />
        <FeatureShowcaseSection />
        <StandOutSection />
        <BeforeAfterSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </>
  );
}
