import type { Metadata } from "next";
import { Header } from "@/components/sections/Header";
import { Footer } from "@/components/sections/Footer";
import { DemoRequestSection } from "@/components/sections/DemoRequestSection";

export const metadata: Metadata = {
  title: "Demo Talep",
  description:
    "BakimX'i işletmenizde deneyin. Demo talebinizi oluşturun, sizinle iletişime geçelim.",
};

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
