"use client";

import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Check, ScanLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HERO_SLIDES } from "@/lib/landing/hero-slides";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

const labels = ["Ruhsat okuma", "Parça bulma", "İş emri"];

export function HeroSection() {
  const lead = HERO_SLIDES[0];
  return (
    <section
      aria-labelledby="hero-title"
      className="border-b bg-background"
      id="hero"
    >
      <div className="mx-auto grid max-w-7xl items-center gap-10 px-5 py-12 sm:px-8 sm:py-16 lg:grid-cols-[1fr_1.1fr] lg:gap-14 lg:py-20">
        <div className="min-w-0">
          <p className="text-xs font-semibold uppercase tracking-[0.14em] text-primary">
            {lead.eyebrow}
          </p>
          <h1
            id="hero-title"
            className="mt-5 text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.045em] text-navy sm:text-5xl lg:text-[3.5rem]"
          >
            {lead.title} <span className="text-primary">{lead.highlight}</span>
          </h1>
          <p className="mt-6 max-w-xl text-base leading-7 text-muted-foreground">
            {lead.description}
          </p>
          <p className="mt-6 text-sm font-semibold text-navy">
            Açılışa özel ücretsiz kayıt · Lite 0 TL/ay
          </p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <Button asChild size="xl" className="h-12">
              <Link
                href="/fiyatlar#lite"
                onClick={() =>
                  trackMarketingEvent("lite_cta_click", {
                    cta_location: "hero_primary",
                    plan_tier: "lite",
                  })
                }
              >
                Lite · 0 TL/ay ile başlayın <ArrowRight />
              </Link>
            </Button>
            <Button asChild variant="outline" size="xl" className="h-12">
              <a
                href="#demo-form"
                onClick={() =>
                  trackMarketingEvent("demo_cta_click", {
                    cta_location: "hero_secondary",
                    destination: "form",
                  })
                }
              >
                Birlikte inceleyelim
              </a>
            </Button>
          </div>
          <p className="mt-4 flex flex-wrap gap-x-4 gap-y-2 text-xs text-muted-foreground">
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5" />
              Lite kapsamı süresiz ücretsiz
            </span>
            <span className="flex items-center gap-1.5">
              <Check className="size-3.5" />
              Kredi kartı gerekmez
            </span>
          </p>
        </div>
        <Tabs defaultValue={lead.id} className="min-w-0 gap-4">
          <TabsList
            aria-label="BakımX öne çıkan servis özellikleri"
            className="grid h-11! w-full grid-cols-3 border bg-card"
          >
            {HERO_SLIDES.map((slide, index) => (
              <TabsTrigger
                key={slide.id}
                value={slide.id}
                className="h-full text-xs text-muted-foreground transition-none data-[state=active]:bg-navy data-[state=active]:text-navy-foreground sm:text-sm"
              >
                {labels[index]}
              </TabsTrigger>
            ))}
          </TabsList>
          {HERO_SLIDES.map((slide, index) => (
            <TabsContent
              key={slide.id}
              value={slide.id}
              className="rounded-2xl border bg-card focus-visible:ring-2 focus-visible:ring-ring"
            >
              <div className="flex items-center justify-between gap-2 border-b px-4 py-3 text-xs text-muted-foreground">
                <span className="font-semibold text-navy">
                  BakımX / {labels[index]}
                </span>
                <span>Örnek gösterim</span>
              </div>
              <div className="relative h-[330px] overflow-hidden bg-muted sm:h-[360px]">
                {index === 0 ? (
                  <div className="grid h-full grid-cols-[0.85fr_1fr] items-center gap-3 p-3 sm:gap-5 sm:p-5">
                    <div className="relative h-full">
                      <Image
                        src="/landing/ruhsat-demo.png"
                        alt="34 LKN 123 plakalı Honda PCX 125 örnek ruhsatı"
                        fill
                        loading="eager"
                        sizes="(max-width: 640px) 40vw, 250px"
                        className="object-contain"
                      />
                    </div>
                    <div className="rounded-xl border bg-card p-3 sm:p-4">
                      <ScanLine className="mb-3 size-5 text-primary" />
                      <p className="text-sm font-semibold text-navy">
                        Okunan bilgiler
                      </p>
                      <dl className="mt-3 space-y-3">
                        {[
                          ["Plaka", "34 LKN 123"],
                          ["Marka / Model", "HONDA PCX 125"],
                          ["Model yılı", "2024"],
                        ].map(([label, value]) => (
                          <div key={label}>
                            <dt className="text-xs text-muted-foreground">
                              {label}
                            </dt>
                            <dd className="mt-1 text-sm font-medium text-navy">
                              {value}
                            </dd>
                          </div>
                        ))}
                      </dl>
                      <p className="mt-4 text-xs leading-5 text-muted-foreground">
                        Sabit demo verisi · Canlı OCR sonucu değildir.
                      </p>
                    </div>
                  </div>
                ) : (
                  <Image
                    src={
                      index === 1
                        ? "/landing/screens/parts-catalog.png"
                        : "/landing/screens/order-detail.png"
                    }
                    alt={
                      index === 1
                        ? "BakımX parça kataloğunda örnek parça sonuçları"
                        : "BakımX iş emrinde örnek işlem ve tahsilat bilgileri"
                    }
                    width={1440}
                    height={900}
                    sizes="1000px"
                    className={
                      index === 1
                        ? "absolute left-1/2 -top-10 w-[1000px] max-w-none -translate-x-1/2"
                        : "absolute -left-36 top-0 w-[900px] max-w-none"
                    }
                  />
                )}
              </div>
              <div className="min-h-[190px] border-t p-4 sm:p-5">
                {index !== 0 && (
                  <p className="mb-3 text-sm leading-6 text-muted-foreground">
                    {slide.description}
                  </p>
                )}
                <ul className="space-y-2">
                  {slide.bullets.map((bullet) => (
                    <li
                      key={bullet}
                      className="flex items-start gap-2 text-sm leading-6 text-navy"
                    >
                      <Check className="mt-1 size-4 shrink-0 text-primary" />
                      {bullet}
                    </li>
                  ))}
                </ul>
              </div>
            </TabsContent>
          ))}
        </Tabs>
      </div>
    </section>
  );
}
