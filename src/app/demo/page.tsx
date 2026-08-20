import type { Metadata } from "next";
import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { DemoRequestSection } from "@/components/sections/DemoRequestSection";
import { publicPageMetadata } from "@/lib/seo";

export const metadata: Metadata = publicPageMetadata({
  path: "/demo",
  title: "BakımX Oto Servis Programı Demo Talebi",
  description: "BakımX oto servis programını iş yerinize göre görün. Demo talebinizi bırakın; araç kabulü, iş emri ve müşteri takibini birlikte inceleyelim.",
});

export default function DemoPage() {
  return (
    <>
      <Header />
      <main>
        <DemoRequestSection />
      </main>
      <Footer />
    </>
  );
}
