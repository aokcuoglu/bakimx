import Image from "next/image"
import type { ReactNode } from "react"
import styles from "./kit.module.css"

/** Fotoğraf kartı (e-santral `.d-card`): 4:5, alt degrade, sol üstte hap etiket. */
export function PhotoCard({ src, alt, label, children }: { src: string; alt: string; label: string; children: ReactNode }) {
  return (
    <div className={styles.photoCard}>
      <Image className={styles.photoImg} src={src} alt={alt} fill sizes="(max-width: 640px) 82vw, 380px" />
      <span className={styles.photoLabel}>{label}</span>
      <p className={styles.photoText}>{children}</p>
    </div>
  )
}
