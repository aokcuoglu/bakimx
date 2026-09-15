import type { Metadata } from "next";
import Link from "next/link";
import { ArrowLeft, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { BrandLogo } from "@/components/shared/brand-logo";
import { PublicSite } from "@/components/public/PublicSite";

export const metadata: Metadata = {
  title: "Demo Özeti",
  description: "BakımX araç kabulü, iş emri ve müşteri takip akışını tek sayfada inceleyin.",
  alternates: { canonical: "/demo/ozet" },
  robots: { index: false, follow: false },
};

export default function DemoSummaryPage() {
  return <PublicSite><main className="min-h-screen bg-card px-5 py-8 text-foreground print:px-0 print:py-0">
    <div className="mx-auto max-w-3xl">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b pb-6">
        <BrandLogo variant="primary-light" size="lg" alt="BakımX" />
        <Button asChild variant="ghost" className="print:hidden"><Link href="/demo"><ArrowLeft /> Demo sayfasına dön</Link></Button>
      </div>
      <section className="py-12 print:py-6">
        <p className="text-xs uppercase tracking-widest text-muted-foreground">Oto servisler için demo özeti</p>
        <h1 className="mt-4 text-4xl font-semibold leading-tight tracking-tight sm:text-5xl">Her araç, her işlem, aynı yerde.</h1>
        <p className="mt-5 text-lg leading-8 text-muted-foreground">BakımX ile araç kabulünü, iş emirlerini ve müşteri takibini birlikte inceleyelim.</p>
      </section>
      <section className="border-y py-8 print:py-5">
        <h2 className="text-2xl font-semibold">Bir araçla üç adım</h2>
        <ol className="mt-5 space-y-5">
          {["Ruhsatı okutun; araç bilgilerini kontrol ederek kabulü başlatın.", "Şikâyet, fotoğraf, parça ve işçiliği aynı iş emrinde toplayın.", "Müşteriye güvenli takip linkini gönderin; işlem sürecini birlikte takip edin."].map((item, i) => <li key={item} className="flex gap-4"><span className="font-mono text-sm text-muted-foreground">0{i + 1}</span><span className="leading-7">{item}</span></li>)}
        </ol>
      </section>
      <section className="py-8 print:py-5">
        <h2 className="text-2xl font-semibold">Servisinize göre inceleyelim.</h2>
        <p className="mt-3 leading-7 text-muted-foreground">İletişim bilgilerinizi bırakın. Ekibimiz sizi arayıp servisinizin ihtiyaçlarını ve demo akışını birlikte değerlendirsin.</p>
        <Button asChild variant="navy" className="mt-5 print:hidden"><Link href="/demo#demo-talep">Demo isteyin <ArrowRight /></Link></Button>
      </section>
    </div>
  </main></PublicSite>;
}
