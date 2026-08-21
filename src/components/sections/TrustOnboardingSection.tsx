import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { Zap, MessageCircle, LifeBuoy, ArrowRight } from "lucide-react";
import { BrandEyebrow } from "@/components/shared/brand-decor";
import { Reveal } from "@/components/shared/reveal";

/**
 * "Kurulumsuz başlangıç + destek" — Shopmonkey world-class-support kaldıracının
 * dürüst hali. BakimX'i solo bir ekip geliştirir; "destek ekibi", telefon/WhatsApp
 * hattı gibi çalıştırmadığımız kanal iddiası YOKTUR — gerçek e-posta desteği,
 * kurulumsuzluk ve başlangıç yardımı vurgulanır.
 */

const steps = [
  { title: "Ücretsiz hesabınızı açın", description: "Kurulum, indirme yok. Kart doğrulaması sonrası 7 gün ücretsiz." },
  { title: "Ruhsatı okutun, ilk aracı ekleyin", description: "Araç, müşteri ve şasi bilgisi fotoğraftan otomatik dolsun." },
  { title: "İş emri açın, linki paylaşın", description: "İlk iş emrinizi bugün oluşturun; müşteriye canlı takip linki gönderin." },
];

const reassurances = [
  { icon: Zap, title: "Kurulum & indirme yok", description: "Telefon, tablet veya bilgisayardan aynı gün çalışmaya başlarsınız." },
  { icon: MessageCircle, title: "Türkçe, gerçek destek", description: "Sorularınıza e-postayla yanıt veriyoruz — arada bir bot değil." },
  { icon: LifeBuoy, title: "Başlarken yanınızdayız", description: "İlk aracınızı ve iş emrinizi kurarken takıldığınız yerde yardımcı oluruz." },
];

export function TrustOnboardingSection() {
  return (
    <section className="bg-brand/10 py-16 sm:py-24">
      <div className="mx-auto max-w-6xl px-4 sm:px-6 lg:px-8">
        <div className="mx-auto max-w-2xl text-center">
          <BrandEyebrow>Nasıl başlarım</BrandEyebrow>
          <h2 className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl">
            Kurulumsuz başlayın, yalnız kalmayın
          </h2>
          <p className="mt-4 text-base leading-relaxed text-muted-foreground">
            Karmaşık kurulum, uzun eğitim yok. Bugün açın, ilk iş emrinizi bugün
            oluşturun — takıldığınız yerde Türkçe destek yanınızda.
          </p>
        </div>

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

        <div className="mt-8 grid gap-x-8 gap-y-6 border-t border-border/60 pt-8 sm:grid-cols-3">
          {reassurances.map(({ icon: Icon, title, description }) => (
            <div key={title} className="flex items-start gap-3">
              <Icon className="mt-0.5 h-5 w-5 shrink-0 text-primary" />
              <div>
                <p className="text-sm font-semibold">{title}</p>
                <p className="mt-1 text-sm leading-relaxed text-muted-foreground">
                  {description}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="mt-10 text-center">
          <Link
            href="/register"
            className={buttonVariants({ size: "lg", className: "gap-2 px-8 text-base shadow-lg shadow-primary/25" })}
          >
            7 Gün Ücretsiz Dene
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </section>
  );
}
