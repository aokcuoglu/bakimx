import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Zap, MessageCircle, LifeBuoy, ArrowRight } from "lucide-react";
import { SectionHeading } from "@/components/shared/SectionHeading";
import { Reveal } from "@/components/shared/reveal";

/**
 * "Kurulumsuz başlangıç + destek" — Shopmonkey world-class-support kaldıracının
 * dürüst hali. BakimX'i solo bir ekip geliştirir; "destek ekibi", telefon/WhatsApp
 * hattı gibi çalıştırmadığımız kanal iddiası YOKTUR — gerçek e-posta desteği,
 * kurulumsuzluk ve başlangıç yardımı vurgulanır.
 */

const steps = [
  { title: "Ücretsiz hesabınızı açın", description: "Kurulum, paket veya kart seçimi yok. E-posta doğrulaması sonrası 7 iş günü ücretsiz." },
  { title: "Ruhsatı okutun, ilk aracı ekleyin", description: "Araç, müşteri ve şasi bilgisi fotoğraftan otomatik dolsun." },
  { title: "İş emri açın, linki paylaşın", description: "Müşteriye canlı takip linkini gönderin." },
];

// Tek satırlık güvence şeridi: başlık kendini anlatır, açıklama gürültü olur.
const reassurances = [
  { icon: Zap, title: "Kurulum & indirme yok" },
  { icon: MessageCircle, title: "Türkçe, gerçek destek" },
  { icon: LifeBuoy, title: "Başlarken yanınızdayız" },
];

export function TrustOnboardingSection() {
  return (
    <section className="bg-brand/10 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <SectionHeading
          badge="Nasıl başlarım"
          title="Kurulumsuz başlayın, yalnız kalmayın"
          subtitle="Kurulum ve uzun eğitim yok; ilk iş emrinizi bugün oluşturun."
        />

        <div className="mt-12 grid gap-5 md:grid-cols-3">
          {steps.map((step, i) => (
            <Reveal
              key={step.title}
              delay={i * 100}
              className="rounded-xl bg-background/70 p-6"
            >
              <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-sm font-bold text-primary-foreground">
                {i + 1}
              </div>
              <h3 className="mt-4 text-base font-semibold">{step.title}</h3>
              <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
                {step.description}
              </p>
            </Reveal>
          ))}
        </div>

        <div className="mt-8 grid gap-x-8 gap-y-4 border-t border-border/60 pt-8 sm:grid-cols-3">
          {reassurances.map(({ icon: Icon, title }) => (
            <div key={title} className="flex items-center gap-3">
              <Icon aria-hidden className="h-5 w-5 shrink-0 text-primary" />
              <p className="text-sm font-semibold">{title}</p>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/register"
            className={buttonVariants({
              variant: "gradient",
              size: "lg",
              className: "h-12 gap-2 px-8 text-base",
            })}
          >
            Ücretsiz Dene
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
