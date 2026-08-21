"use client";

import Link from "next/link";
import { buttonVariants } from "@/components/ui/button";
import { ArrowRight } from "lucide-react";
import { BrandEyebrow } from "@/components/shared/brand-decor";
import { Reveal } from "@/components/shared/reveal";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

export function FinalCTASection() {
  return (
    <section className="relative overflow-hidden bg-brand/10 py-16 sm:py-20">
      <div
        aria-hidden
        className="pointer-events-none absolute left-1/2 top-0 h-[300px] w-[520px] -translate-x-1/2 rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-4xl px-4 text-center sm:px-6 lg:px-8">
        <Reveal amount={0.3}>
          <BrandEyebrow>Hemen başlayın</BrandEyebrow>
        </Reveal>
        <Reveal
          as="h2"
          amount={0.3}
          delay={50}
          className="mt-3 text-2xl font-bold tracking-tight sm:text-3xl lg:text-4xl"
        >
          Servisinizi bugün dijitale taşıyın
        </Reveal>
        <Reveal
          as="p"
          amount={0.3}
          delay={100}
          className="mx-auto mt-4 max-w-xl text-base text-muted-foreground sm:text-lg"
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
            className={buttonVariants({ size: "lg", className: "gap-2 px-8 text-base shadow-lg shadow-primary/25" })}
          >
            7 Gün Ücretsiz Dene
            <ArrowRight className="h-4 w-4" />
          </Link>
          <Link
            href="/#demo-form"
            onClick={() => trackMarketingEvent("demo_cta_click", { cta_location: "final_secondary", destination: "form" })}
            className={buttonVariants({ variant: "outline", size: "lg", className: "border-primary/25 px-8 text-base" })}
          >
            Demo İste
          </Link>
        </Reveal>
      </div>
    </section>
  );
}
