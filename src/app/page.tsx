import { AnnouncementBar } from "@/components/sections/AnnouncementBar";
import { Header } from "@/components/sections/Header";
import { HeroSection } from "@/components/sections/HeroSection";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { SolutionOverviewSection } from "@/components/sections/SolutionOverviewSection";
import { StorySection } from "@/components/sections/StorySection";
import { FeaturesSection } from "@/components/sections/FeaturesSection";
import { PricingSection } from "@/components/sections/PricingSection";
import { DemoRequestSection } from "@/components/sections/DemoRequestSection";
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
        <TrustStrip />
        <SolutionOverviewSection />
        <StorySection />
        <FeaturesSection />
        <PricingSection />
        <DemoRequestSection />
        <FAQSection />
        <FinalCTASection />
      </main>
      <Footer />
    </>
  );
}