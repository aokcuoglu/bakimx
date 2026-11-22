import { PublicSite } from "@/components/public/PublicSite";
import type { Metadata } from "next";
import { Footer } from "@/components/sections/Footer";
import { DemoCampaignIntro } from "@/components/sections/DemoCampaignIntro";
import { DemoRequestSection } from "@/components/sections/DemoRequestSection";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  path: "/demo",
  title: "Canlı Demo Talebi",
  description: "BakımX oto servis programını iş yerinize göre görün. Demo talebinizi bırakın; araç kabulü, iş emri ve müşteri takibini birlikte inceleyelim.",
});

export default function DemoPage() {
  return (
    <PublicSite>
      <main>
        <DemoCampaignIntro />
        <DemoRequestSection />
      </main>
      <Footer />
    </PublicSite>
  );
}
