"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackMarketingEvent } from "@/lib/marketing-analytics";
import { DemoRequestButton } from "@/components/public/DemoRequestButton";
import styles from "./landing-editorial.module.css";

/** Servis sahiplerinin en sık yaşadığı 3 ağrı — hero kolajı. */
const HERO_COLLAGE = [
  "İş emri 10 saniyede",
  "Şaseden parça listesi",
  "Her kayıt yerinde",
] as const;

export function HeroSection() {
  return (
    <section id="hero" aria-labelledby="hero-title" className={styles.hero}>
      <div className={styles.heroBgArt} aria-hidden="true">
        <picture>
          <source
            srcSet="/illustrations/hero-workshop-bg.webp"
            type="image/webp"
          />
          <img
            src="/illustrations/hero-workshop-bg.jpg"
            alt=""
            className={styles.heroBgArtImage}
            width={1280}
            height={720}
            decoding="async"
            // Decorative; keep out of LCP contention with the H1.
            loading="lazy"
          />
        </picture>
      </div>

      <div className={styles.heroInner}>
        <p className={styles.eyebrow}>
          Servisinizin yeni çalışma düzeni{" "}
          <ChevronRight size={14} aria-hidden />
        </p>
        <h1 id="hero-title" className={styles.headline}>
          <span className={styles.collage}>
            {HERO_COLLAGE.map((line, index) => (
              <span
                key={line}
                className={styles.collageLine}
                data-i={index}
              >
                {line}
              </span>
            ))}
          </span>
        </h1>
        <p className={styles.intro}>
          Hızlı iş emri, araca özel parça, kaybolmayan geçmiş.
          <br className={styles.desktopBreak} /> Servisinizin bütün işi, tek bir
          yerde.
        </p>
        <div className={styles.actions}>
          <DemoRequestButton
            onClick={() =>
              trackMarketingEvent("demo_cta_click", {
                cta_location: "hero_secondary",
                destination: "form",
              })
            }
          />
          <Button asChild variant="navy" size="xl" className="h-12 px-6">
            <Link
              href="/register"
              onClick={() =>
                trackMarketingEvent("lite_cta_click", {
                  cta_location: "hero_primary",
                  plan_tier: "lite",
                })
              }
            >
              Ücretsiz başlayın <ArrowRight />
            </Link>
          </Button>
        </div>
      </div>
    </section>
  );
}
