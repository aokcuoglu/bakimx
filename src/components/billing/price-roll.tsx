import styles from "./price-roll.module.css"

/** Both amounts share a fixed-width window, so changing periods never shifts the card. */
export function PriceRoll({ monthly, yearly, cycle }: {
  monthly: string
  yearly: string
  cycle: "monthly" | "yearly"
}) {
  if (monthly === yearly) return <>{monthly}</>

  return (
    <span className={styles.window} data-cycle={cycle} data-slot="price-roll">
      <span className="sr-only">{cycle === "monthly" ? monthly : yearly}</span>
      <span aria-hidden="true" className={`${styles.amount} ${styles.monthly}`}>{monthly}</span>
      <span aria-hidden="true" className={`${styles.amount} ${styles.yearly}`}>{yearly}</span>
    </span>
  )
}
