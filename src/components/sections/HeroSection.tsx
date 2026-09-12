"use client";

import Link from "next/link";
import { ArrowRight, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { trackMarketingEvent } from "@/lib/marketing-analytics";
import { DemoRequestButton } from "@/components/public/DemoRequestButton";
import styles from "./landing-editorial.module.css";

export function HeroSection() {
  return (
    <section id="hero" aria-labelledby="hero-title" className={styles.hero}>
      <div className={styles.heroInner}>
        <p className={styles.eyebrow}>
          Servisinizin yeni çalışma düzeni{" "}
          <ChevronRight size={14} aria-hidden />
        </p>
        <h1 id="hero-title" className={styles.headline}>
          Servisiniz büyüsün.
          <br />
          Kontrol sizde kalsın.
        </h1>
        <p className={styles.intro}>
          Araç kabulünden doğru parçaya, iş emrinden tahsilata.
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
              href="/fiyatlar#lite"
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
        <p className={styles.offer}>
          Lite 0 TL/ay <span aria-hidden>·</span> Kredi kartı gerekmez
        </p>
      </div>
    </section>
  );
}
