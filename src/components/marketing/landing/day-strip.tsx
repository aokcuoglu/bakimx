import { PhotoCard } from "../kit/photo-card"
import { PhotoRail } from "../kit/photo-rail"
import { Wordmark } from "../kit/wordmark"
import { DAY_CARDS, DAY_STRIP } from "./content"
import styles from "./landing.module.css"

/**
 * "BakımX ile dükkanınızda bir gün." — kaydırmalı fotoğraf kartları (e-santral `.d-strip`).
 * Bölge adını kart rayı taşır (`PhotoRail` role=region); section'a ayrıca ad verilmez,
 * yoksa aynı adlı iç içe iki bölge oluşur.
 */
export function DayStrip() {
  return (
    <section id="nasil" className={styles.strip}>
      <PhotoRail
        titleId="nasil-t"
        title={
          <>
            <Wordmark variant="inline" /> {DAY_STRIP.titleAfterMark}
          </>
        }
      >
        {DAY_CARDS.map((card) => (
          <PhotoCard key={card.label} src={card.img} alt={card.alt} label={card.label}>
            {card.text}
          </PhotoCard>
        ))}
      </PhotoRail>
    </section>
  )
}
