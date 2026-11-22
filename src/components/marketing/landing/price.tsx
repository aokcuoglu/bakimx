import { Reveal } from "@/components/shared/reveal"
import { PriceBlock } from "../kit/price-block"
import { CTA, PRICE } from "./content"
import { SignupTrigger } from "./signup-dialog"
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
              <SignupTrigger variant="pill-lg" location="price">
                {CTA.trial}
              </SignupTrigger>
            }
          />
        </Reveal>
      </div>
    </section>
  )
}
