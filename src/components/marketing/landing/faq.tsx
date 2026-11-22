import { cn } from "@/lib/utils"
import { FaqAccordion } from "../kit/faq-accordion"
import { FAQ_TITLE, LANDING_FAQ } from "./content"
import styles from "./landing.module.css"

/** Sık sorulan sorular (e-santral `#sorular`). */
export function Faq() {
  return (
    <section id="sorular" className={styles.sec} aria-labelledby="sorular-t">
      <div className={cn(styles.wrap, styles.faqWrap)}>
        <h2 id="sorular-t" className={styles.title}>
          {FAQ_TITLE}
        </h2>
        <FaqAccordion items={LANDING_FAQ} />
      </div>
    </section>
  )
}
