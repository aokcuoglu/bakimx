"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { BlueprintGrid, BrandEyebrow } from "@/components/shared/brand-decor";
import { Reveal } from "@/components/shared/reveal";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

/**
 * Sayfayı kapatan koyu "bookend" — marka rehberi §7: hero ve final CTA lacivert
 * otorite taşır. Demo formu bu bölümün ALTINDA geldiği için secondary CTA
 * aşağı kaydırır; kullanıcı dönüşümün en kritik anında geriye gitmez
 * (UI denetimi §3.5).
 */
export function FinalCTASection() {
  return (
    <section className="relative overflow-hidden bg-navy py-16 text-navy-foreground sm:py-20">
      <BlueprintGrid />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal amount={0.3}>
          <BrandEyebrow tone="on-dark">Hemen başlayın</BrandEyebrow>
        </Reveal>
        <Reveal
          as="h2"
          amount={0.3}
          delay={50}
          className="mt-3 text-balance text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
        >
          Servisinizi bugün dijitale taşıyın
        </Reveal>
        <Reveal
          as="p"
          amount={0.3}
          delay={100}
          className="mx-auto mt-4 max-w-xl text-base sm:text-lg"
        >
          Kurulum yok, taahhüt yok. Kart doğrulamasının ardından 7 günlük
          denemeniz anında başlar.
        </Reveal>
        <Reveal
          amount={0.3}
          delay={200}
          className="mt-8 flex flex-col justify-center gap-3 sm:flex-row sm:gap-4"
        >
          <Link
            href="/register"
            onClick={() => trackMarketingEvent("trial_cta_click", { cta_location: "final_primary" })}
            className={buttonVariants({
              variant: "gradient",
              size: "lg",
              className: "h-12 gap-2 px-8 text-base",
            })}
          >
            7 Gün Ücretsiz Dene
            <ArrowRight className="h-4 w-4" />
          </Link>
          {/* Form hemen alt bölümde: çapa aşağı gider, yukarı değil.
              Outline varyantı koyu zemine göre ez: şeffaf zemin + beyaz metin
              (marka rehberi §7 "koyu zeminde border-white/25 şeffaf"). */}
          <Link
            href="/#demo-form"
            onClick={() => trackMarketingEvent("demo_cta_click", { cta_location: "final_secondary", destination: "form" })}
            className={buttonVariants({
              variant: "outline",
              size: "lg",
              className:
                "border-white/30 bg-transparent px-8 text-base text-navy-foreground hover:border-white/50 hover:bg-white/10 hover:text-navy-foreground dark:border-white/30 dark:bg-transparent dark:text-navy-foreground dark:hover:bg-white/10 dark:hover:text-navy-foreground",
            })}
          >
            Demo İste
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
