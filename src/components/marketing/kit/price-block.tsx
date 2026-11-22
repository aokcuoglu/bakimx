import type { ReactNode } from "react"
import { CheckList } from "./check-list"
import styles from "./kit.module.css"

export type PriceBlockProps = {
  titleId: string
  title: string
  subtitle: string
  amount: string
  unit: string
  items: readonly string[]
  cta: ReactNode
  note: string
}

/** Tek paket fiyat kutusu (e-santral `.price`). */
export function PriceBlock({ titleId, title, subtitle, amount, unit, items, cta, note }: PriceBlockProps) {
  return (
    <div className={styles.price}>
      <h2 id={titleId} className={styles.priceTitle}>
        {title}
      </h2>
      <p className={styles.priceSub}>{subtitle}</p>
      <p className={styles.amount}>
        <b className={styles.amountValue}>{amount}</b>
        <span className={styles.amountUnit}>{unit}</span>
      </p>
      <CheckList items={items} />
      {cta}
      <p className={styles.priceNote}>{note}</p>
    </div>
  )
}
