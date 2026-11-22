import type { ReactNode } from "react"
import styles from "./kit.module.css"

/** Gri özellik kutusu (e-santral `.tile`): mavi çizgi ikon, başlık, gri açıklama. */
export function FeatureTile({ icon, title, children }: { icon: ReactNode; title: string; children: ReactNode }) {
  return (
    <article className={styles.tile}>
      {icon}
      <h3 className={styles.tileTitle}>{title}</h3>
      <p className={styles.tileText}>{children}</p>
    </article>
  )
}
