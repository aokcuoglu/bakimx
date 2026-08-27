"use client";

import { useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { Pause, Play, ShieldCheck, Zap, CalendarCheck, ArrowRight, Volume2, VolumeX } from "lucide-react";
import { buttonVariants } from "@/components/ui/button";
import { HeroAskBar } from "@/components/sections/HeroAskBar";
import { HeroWorkshop } from "@/components/sections/hero-workshop";
import { trackMarketingEvent } from "@/lib/marketing-analytics";

const trustBadges = [
  { icon: ShieldCheck, label: "KVKK uyumlu" },
  { icon: Zap, label: "Kurulumsuz" },
  { icon: CalendarCheck, label: "7 iş günü ücretsiz" },
];

const VIDEO_SRC = "/landing/bakimx-landing-page.mp4";
const VIDEO_POSTER = "/landing/hero-video-poster.jpg";

export function HeroSection() {
  // Ask bar'ın metni hero'da tutulur: çipler ve form aynı değeri yazar.
  const [askQuery, setAskQuery] = useState("");

  return (
    <section className="relative overflow-hidden bg-gradient-to-b from-navy via-navy/90 to-navy/75 pt-8 pb-16 sm:pt-12 sm:pb-20 lg:pt-16 lg:pb-24">
      <HeroWorkshop />
      <div className="relative mx-auto max-w-7xl px-4 sm:px-6 lg:px-8">
        {/*
          Hero kompozisyonu:
          - üst satır: sol kolon (mesaj + CTA) + sağ kolon (tanıtım videosu)
          - ikinci satır: iki kolona yayılan "BakımX'e sorun" ask bar.
          DOM sırası görsel grid sırasından bağımsız olarak klavye akışını korur.
        */}
        <div className="grid items-center gap-10 lg:grid-cols-[1fr_1.05fr] lg:gap-x-14 lg:gap-y-12">
          {/* Sol: mesaj + CTA */}
          <div className="flex max-w-xl flex-col gap-6">
            <span
              style={{ "--enter-from": "0.75rem", "--enter-duration": "0.4s" } as CSSProperties}
              className="enter-up inline-flex w-fit items-center gap-2 rounded-full border border-white/20 bg-white/10 px-3 py-1 text-xs font-semibold text-white"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-primary" />
              Erken üyelere özel başlangıç fiyatları
            </span>

            <h1
              className="text-balance text-3xl font-bold leading-[1.12] tracking-tight text-white sm:text-4xl lg:text-[3rem] lg:leading-[1.08]"
            >
              Oto servisinizde iş emri açmak ve parça bulmak artık{" "}
              <span className="text-primary">10 saniye.</span>
            </h1>

            <p
              style={{ "--enter-delay": "150ms" } as CSSProperties}
              className="enter-up text-base leading-relaxed text-white sm:text-lg"
            >
              Ruhsat okutarak araca %100 uyumlu yedek parçaları anında bulun,
              tek tıkla iş emrine ekleyin. Yanlış parça siparişi ve zaman
              kaybına son verin.
            </p>

            <div
              style={{ "--enter-delay": "250ms" } as CSSProperties}
              className="enter-up flex flex-col gap-3 sm:flex-row sm:items-center"
            >
              <Link
                href="/register"
                onClick={() => trackMarketingEvent("trial_cta_click", { cta_location: "hero_primary" })}
                className={buttonVariants({
                  variant: "gradient",
                  size: "lg",
                  className: "h-12 gap-2 px-8 text-base",
                })}
              >
                Ücretsiz Dene
                <ArrowRight className="h-4 w-4" />
              </Link>
              <Link
                href="/#demo-form"
                onClick={() => trackMarketingEvent("demo_cta_click", { cta_location: "hero_secondary", destination: "form" })}
                className={buttonVariants({
                  variant: "outline",
                  size: "lg",
                  className: "h-12 border-primary/25 px-8 text-base font-semibold",
                })}
              >
                Demo İste
              </Link>
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

            {/* Mobilde gizli: aynı üçlü DemoForm'un tepesinde tekrar ediyor;
                hero'nun ilk ekranını CTA + videoya bırakır (UI denetimi §3.3). */}
            <ul
              style={{ "--enter-from": "0", "--enter-delay": "350ms" } as CSSProperties}
              className="enter-up hidden flex-wrap items-center gap-x-5 gap-y-2 pt-1 sm:flex"
            >
              {trustBadges.map(({ icon: Icon, label }) => (
                <li
                  key={label}
                  className="inline-flex items-center gap-1.5 text-sm text-white"
                >
                  <Icon className="h-4 w-4 text-primary" />
                  {label}
                </li>
              ))}
            </ul>
          </div>

          {/* DOM sırası klavye akışını belirler: hero CTA'larından sonra ask bar
              ve çipler, ardından video gelir. Desktop grid videoyu yine sağ
              kolonda, ask bar'ı iki kolonun altında gösterir. */}
          <div
            style={{ "--enter-delay": "400ms" } as CSSProperties}
            className="enter-up lg:col-span-2 lg:row-start-2"
          >
            <HeroAskBar value={askQuery} onValueChange={setAskQuery} />
          </div>

          {/* Sağ: tanıtım videosu — otomatik oynar, sessiz, döngüde. WCAG 2.2.2
              için duraklat düğmesi vardır (10 sn'lik döngü hareketi). */}
          <div
            style={{
              "--enter-from": "1.5rem",
              "--enter-duration": "0.6s",
              "--enter-delay": "200ms",
            } as CSSProperties}
            className="enter-up w-full min-w-0 lg:col-start-2 lg:row-start-1"
          >
            <HeroVideo />
          </div>
        </div>
      </div>
    </section>
  );
}

/** Hero'nun sağ kolonundaki tanıtım videosu: çerçeve + duraklat denetimi. */
function HeroVideo() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const [paused, setPaused] = useState(false);
  const [muted, setMuted] = useState(true);

  function toggle() {
    const video = videoRef.current;
    if (!video) return;
    if (video.paused) {
      void video.play();
      setPaused(false);
    } else {
      video.pause();
      setPaused(true);
    }
  }

  function toggleMute() {
    const video = videoRef.current;
    if (!video) return;
    video.muted = !video.muted;
    setMuted(video.muted);
  }

  return (
    <figure className="space-y-2.5">
      <div className="relative overflow-hidden rounded-2xl border border-white/10 bg-navy shadow-2xl shadow-navy/25">
        <video
          ref={videoRef}
          autoPlay
          muted
          loop
          playsInline
          preload="auto"
          poster={VIDEO_POSTER}
          aria-label="BakımX tanıtım videosu: ruhsatı okutun, araca uygun parçayı anında bulun"
          className="aspect-video w-full object-cover"
        >
          <source src={VIDEO_SRC} type="video/mp4" />
        </video>
        <button
          type="button"
          onClick={toggle}
          aria-label={paused ? "Videoyu oynat" : "Videoyu duraklat"}
          className="absolute right-3 bottom-3 inline-flex size-9 items-center justify-center rounded-full bg-navy/70 text-navy-foreground backdrop-blur-sm transition-colors hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {paused ? <Play className="size-4" /> : <Pause className="size-4" />}
        </button>
        <button
          type="button"
          onClick={toggleMute}
          aria-label={muted ? "Sesi aç" : "Sesi kapat"}
          className="absolute right-14 bottom-3 inline-flex size-9 items-center justify-center rounded-full bg-navy/70 text-navy-foreground backdrop-blur-sm transition-colors hover:bg-navy/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring/60"
        >
          {muted ? <VolumeX className="size-4" /> : <Volume2 className="size-4" />}
        </button>
      </div>
      <figcaption className="text-center text-xs text-white">
        Ruhsat okutun, uyumlu parçayı anında bulun — 10 saniye
      </figcaption>
    </figure>
  );
}
