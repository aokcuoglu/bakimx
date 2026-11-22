import Image from "next/image"
import Link from "next/link"
import { cn } from "@/lib/utils"
import styles from "./kit.module.css"

export type WordmarkProps = {
  /** header 23px (telefonda 20px), footer 18px, inline bulunduğu başlığın yazısını devralır. */
  variant: "header" | "footer" | "inline"
  /**
   * Verilirse wordmark bağlantıdır: `#…` aynı sayfada başa döner, yol (`/`)
   * `<Link>` ile istemci geçişi yapar.
   */
  href?: string
}

const VARIANT_CLASS = {
  header: styles.wmHeader,
  footer: styles.wmFooter,
  inline: styles.wmInline,
} as const

/** "Bakım" yazısı + mavi X logosu (e-santral `.mark`). */
export function Wordmark({ variant, href }: WordmarkProps) {
  const className = cn(styles.wordmark, VARIANT_CLASS[variant])
  const content = (
    <>
      Bakım
      <Image className={styles.wmX} src="/landing/esantral/bakimx-x.svg" alt="X" width={190} height={168} unoptimized />
    </>
  )

  if (href?.startsWith("#")) {
    return (
      <a href={href} className={className} aria-label="BakımX, başa dön">
        {content}
      </a>
    )
  }

  if (href) {
    return (
      <Link href={href} className={className} aria-label="BakımX ana sayfa">
        {content}
      </Link>
    )
  }

  return <span className={className}>{content}</span>
}
