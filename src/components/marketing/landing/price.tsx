import { Reveal } from "@/components/shared/reveal"
import { PillButton } from "../kit/pill-button"
import { PriceBlock } from "../kit/price-block"
import { CTA, PRICE } from "./content"
import styles from "./landing.module.css"

/** Tek paket fiyat (e-santral `#fiyat`). Metin İş 2 (#782) ile content.ts'ten güncellenir. */
export function Price() {
  return (
    <section id="fiyat" className={styles.sec} aria-labelledby="fiyat-t">
      <div className={styles.wrap}>
        <Reveal>
          <PriceBlock
            titleId="fiyat-t"
            title={PRICE.title}
            subtitle={PRICE.subtitle}
            amount={PRICE.amount}
            unit={PRICE.unit}
            items={PRICE.items}
            note={PRICE.note}
            cta={
              <PillButton href="/register" size="lg" track={{ name: "trial_cta_click", location: "price" }}>
                {CTA.trial}
              </PillButton>
            }
          />
        </Reveal>
      </div>
    </section>
  )
}
