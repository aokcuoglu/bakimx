import Link from "next/link"
import { cn } from "@/lib/utils"
import { Wordmark } from "../kit/wordmark"
import { CTA, FOOTER, NAV } from "./content"
import styles from "./landing.module.css"

/** Alt bant (e-santral `.foot`) + yasal bağlantılar (spec §8.3). */
export function LandingFooter() {
  return (
    <footer className={styles.foot}>
      <div className={cn(styles.wrap, styles.footIn)}>
        <Wordmark variant="footer" href="#hero" />
        <nav className={styles.footNav} aria-label="Alt menü">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              {item.label}
            </a>
          ))}
          <Link href="/login">{CTA.login}</Link>
        </nav>
        <p>{FOOTER.copyright}</p>
      </div>
      <nav className={cn(styles.wrap, styles.footLegal)} aria-label="Yasal">
        {FOOTER.legal.map((item) => (
          <Link key={item.href} href={item.href}>
            {item.label}
          </Link>
        ))}
      </nav>
    </footer>
  )
}
