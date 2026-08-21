"use client";

import { useState, type CSSProperties } from "react";
import Link from "next/link";
import { ShieldCheck, Zap, CalendarCheck, ArrowRight } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { ObjectionCards } from "@/components/sections/ObjectionCards";
import { HeroAskBar } from "@/components/sections/HeroAskBar";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

const trustBadges = [
  { icon: ShieldCheck, label: "KVKK uyumlu" },
  { icon: Zap, label: "Kurulumsuz" },
  { icon: CalendarCheck, label: "7 gün ücretsiz" },
];

export function HeroSection() {
  // Ask bar'ın metni hero'da tutulur: Faz 2'nin itiraz kartları ona yazar.
  const [askQuery, setAskQuery] = useState("");
  const [askFocusSignal, setAskFocusSignal] = useState(0);

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-brand/10 via-background to-background pt-10 pb-16 sm:pt-14 sm:pb-20 lg:pt-20 lg:pb-24">
      <div
        aria-hidden
        className="pointer-events-none absolute -top-32 right-[-8%] h-[440px] w-[440px] rounded-full bg-brand/10 blur-3xl"
      />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/*
          Hero kompozisyonu (BAK-78 planı):
          - üst satır: sol kolon (mesaj + CTA) + sağ kolon (soru→cevap şeridi)
          - ikinci satır: iki kolona yayılan "BakımX'e sorun" ask bar.
          DOM sırası görsel grid sırasından bağımsız olarak klavye akışını korur.
        */}
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-x-14 lg:gap-y-12">
          {/* Sol: mesaj + CTA */}
          <div className="flex max-w-xl flex-col gap-6">
            <span
              style={{ "--enter-from": "0.75rem", "--enter-duration": "0.4s" } as CSSProperties}
              className="enter-up inline-flex w-fit items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Erken üyelere özel başlangıç fiyatları
            </span>

            <h1
              style={{ "--enter-from": "1.25rem", "--enter-delay": "50ms" } as CSSProperties}
              className="enter-up text-3xl font-bold leading-[1.12] tracking-tight text-navy sm:text-4xl lg:text-[3rem] lg:leading-[1.08] dark:text-foreground"
            >
              Ruhsatı okutun, servis{" "}
              <span className="text-primary">kendi kendine</span> yazılsın
            </h1>

            <p
              style={{ "--enter-delay": "150ms" } as CSSProperties}
              className="enter-up text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Plaka, marka, model ve şasi ruhsattan dolar; iş emri, fotoğraf
              kanıtı ve teklif aynı panelde ilerler.
            </p>

            <div
              style={{ "--enter-delay": "250ms" } as CSSProperties}
              className="enter-up flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/register"
                onClick={() => trackMarketingEvent("trial_cta_click", { cta_location: "hero_primary" })}
                className={buttonVariants({
                  size: "lg",
                  className: "gap-2 px-7 text-base shadow-lg shadow-primary/25",
                })}
              >
                7 Gün Ücretsiz Dene
                <ArrowRight className="h-4 w-4" />
              </Link>
              <a
                href="#demo-form"
                onClick={() => trackMarketingEvent("demo_cta_click", { cta_location: "hero_secondary", destination: "form" })}
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "border-primary/25 px-7 text-base",
                })}
              >
                Demo İste
              </a>
            </div>

            {/* Kanıtlanabilir tek satır: hero'yu sayfadaki canlı ruhsat demosuna bağlar. */}
            <a
              href="#ruhsat-demo"
              style={{ "--enter-from": "0.75rem", "--enter-delay": "300ms" } as CSSProperties}
              className="enter-up group inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
            >
              Örnek bir ruhsatı hemen aşağıda deneyin
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            </a>

            <ul
              style={{ "--enter-from": "0", "--enter-delay": "350ms" } as CSSProperties}
              className="enter-up flex flex-wrap items-center gap-x-5 gap-y-2 pt-1"
            >
              {trustBadges.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* DOM sırası klavye akışını belirler: hero CTA'larından sonra ask bar
              ve çipler, ardından kart şeridi gelir. Desktop grid kartları yine
              sağ kolonda, ask bar'ı iki kolonun altında gösterir. */}
          <div
            style={{ "--enter-delay": "400ms" } as CSSProperties}
            className="enter-up lg:col-span-2 lg:row-start-2"
          >
            <HeroAskBar
              value={askQuery}
              onValueChange={setAskQuery}
              focusSignal={askFocusSignal}
            />
          </div>

          {/* Sağ: soru→cevap kart şeridi (BAK-80). Faz 1'deki tek statik ürün
              görselinin yerini aldı. Artık hero'nun en büyük elemanı bir görsel
              değil H1 metni; şeritteki görsellerin hiçbiri `priority` almaz. */}
          <div
            style={{
              "--enter-from": "1.5rem",
              "--enter-duration": "0.6s",
              "--enter-delay": "200ms",
            } as CSSProperties}
            className="enter-up w-full min-w-0 lg:col-start-2 lg:row-start-1"
          >
            {/* Faz 2'de açık bırakılan bağ (BAK-81): kart tıklaması artık SSS'e
                gitmek yerine ask bar'ı o soruyla doldurup odağı oraya taşır.
                `href` yerinde kalır, JS'siz yol bozulmaz. */}
            <ObjectionCards
              onSelect={(objection) => {
                setAskQuery(objection.question);
                setAskFocusSignal((signal) => signal + 1);
              }}
            />
          </div>
        </div>
      </div>
    </section>
  );
}
