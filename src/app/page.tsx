import { AnnouncementBar } from "@/components/sections/AnnouncementBar";
import { Header } from "@/components/sections/Header";
import { HeroSection } from "@/components/sections/HeroSection";
import { TrustStrip } from "@/components/sections/TrustStrip";
import { HowItWorksSection } from "@/components/sections/HowItWorksSection";
import { WhyBakimxSection } from "@/components/sections/WhyBakimxSection";
import { EarlyAccessCTASection } from "@/components/sections/EarlyAccessCTASection";
import { FAQSection } from "@/components/sections/FAQSection";
import { Footer } from "@/components/sections/Footer";

export default function Home() {
  return (
    <>
      <AnnouncementBar />
      <Header />
      <main>
        <HeroSection />
        <TrustStrip />
        <HowItWorksSection />
        <WhyBakimxSection />
        <EarlyAccessCTASection />
        <FAQSection />
      </main>
      <Footer />
    </>
  );
}
