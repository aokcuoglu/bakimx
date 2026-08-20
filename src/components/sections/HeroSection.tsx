"use client";

import { useState } from "react";
import Link from "next/link";
import { motion, useReducedMotion } from "framer-motion";
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
  const prefersReducedMotion = useReducedMotion();
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
            <motion.span
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.4 }}
              className="inline-flex w-fit items-center gap-2 rounded-full border border-brand/20 bg-brand/10 px-3 py-1 text-xs font-semibold text-primary"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Erken üyelere özel başlangıç fiyatları
            </motion.span>

            <motion.h1
              initial={prefersReducedMotion ? false : { opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.05 }}
              className="text-3xl font-bold leading-[1.12] tracking-tight text-navy sm:text-4xl lg:text-[3rem] lg:leading-[1.08] dark:text-foreground"
            >
              Ruhsatı okutun, servis{" "}
              <span className="text-primary">kendi kendine</span> yazılsın
            </motion.h1>

            <motion.p
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.15 }}
              className="text-base leading-relaxed text-muted-foreground sm:text-lg"
            >
              Plaka, marka, model ve şasi ruhsattan dolar; iş emri, fotoğraf
              kanıtı ve teklif aynı panelde ilerler.
            </motion.p>

            <motion.div
              initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.25 }}
              className="flex flex-col gap-3 sm:flex-row sm:items-center"
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
            </motion.div>

            {/* Kanıtlanabilir tek satır: hero'yu sayfadaki canlı ruhsat demosuna bağlar. */}
            <motion.a
              href="#ruhsat-demo"
              initial={prefersReducedMotion ? false : { opacity: 0, y: 12 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ duration: 0.5, delay: 0.3 }}
              className="group inline-flex w-fit items-center gap-1.5 rounded-md text-sm font-medium text-primary underline-offset-4 transition-colors hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 focus-visible:ring-offset-2"
            >
              Örnek bir ruhsatı hemen aşağıda deneyin
              <ArrowRight className="h-4 w-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" />
            </motion.a>

            <motion.ul
              initial={prefersReducedMotion ? false : { opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ duration: 0.5, delay: 0.35 }}
              className="flex flex-wrap items-center gap-x-5 gap-y-2 pt-1"
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
            </motion.ul>
          </div>

          {/* DOM sırası klavye akışını belirler: hero CTA'larından sonra ask bar
              ve çipler, ardından kart şeridi gelir. Desktop grid kartları yine
              sağ kolonda, ask bar'ı iki kolonun altında gösterir. */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.4 }}
            className="lg:col-span-2 lg:row-start-2"
          >
            <HeroAskBar
              value={askQuery}
              onValueChange={setAskQuery}
              focusSignal={askFocusSignal}
            />
          </motion.div>

          {/* Sağ: soru→cevap kart şeridi (BAK-80). Faz 1'deki tek statik ürün
              görselinin yerini aldı. Artık hero'nun en büyük elemanı bir görsel
              değil H1 metni; şeritteki görsellerin hiçbiri `priority` almaz. */}
          <motion.div
            initial={prefersReducedMotion ? false : { opacity: 0, y: 24 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.6, delay: 0.2 }}
            className="w-full min-w-0 lg:col-start-2 lg:row-start-1"
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
          </motion.div>
        </div>
      </div>
    </section>
  );
}
