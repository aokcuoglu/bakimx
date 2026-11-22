import Image from "next/image"
import { PillButton } from "../kit/pill-button"
import { AppMockup } from "./app-mockup"
import { CallbackTrigger } from "./callback-dialog"
import { CTA, HERO } from "./content"
import { HeroFit } from "./hero-fit"
import styles from "./landing.module.css"

/**
 * İlk ekran (e-santral `.d-hero`). Başlık ve CTA'lar sunucuda render edilir ve
 * asla gizli başlamaz (LCP — docs/landing-performance.md). Eldeki telefon
 * fotoğrafı ilk ekranda yüklenir.
 */
export function Hero() {
  return (
    <section id="hero" className={styles.hero} aria-labelledby="hero-title" data-hero>
      <div className={styles.heroIn} data-hero-text>
        <h1 id="hero-title" className={styles.heroTitle}>
          {HERO.title[0]}
          <br />
          {HERO.title[1]}
        </h1>
        <p className={styles.heroSub}>{HERO.subtitle}</p>
        <div className={styles.cta}>
          <PillButton href="/register" track={{ name: "trial_cta_click", location: "hero_primary" }}>
            {CTA.trial}
          </PillButton>
          <CallbackTrigger variant="text" location="hero_secondary">
            {CTA.callback}
          </CallbackTrigger>
        </div>
      </div>
      <div className={styles.hand} data-hand>
        <div className={styles.handScreen} data-hand-screen>
          <AppMockup />
        </div>
        <Image
          className={styles.handImg}
          src={HERO.image.src}
          alt={HERO.image.alt}
          width={HERO.image.width}
          height={HERO.image.height}
          loading="eager"
          fetchPriority="high"
          sizes="(max-width: 640px) 200vw, 100vw"
        />
      </div>
      <HeroFit />
    </section>
  )
}
