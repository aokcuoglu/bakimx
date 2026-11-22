import Link from "next/link"
import { Wordmark } from "../kit/wordmark"
import { CTA, NAV } from "./content"
import { SignupTrigger } from "./signup-dialog"
import styles from "./landing.module.css"

/** Yapışkan buzlu üst bant (e-santral `.top`). Mobil menü kaynakta da yok. */
export function LandingHeader() {
  return (
    <header className={styles.top}>
      <div className={styles.topIn}>
        <Wordmark variant="header" href="#hero" />
        <nav className={styles.nav} aria-label="Ana menü">
          {NAV.map((item) => (
            <a key={item.id} href={`#${item.id}`}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className={styles.acts}>
          <Link className={styles.login} href="/login">
            {CTA.login}
          </Link>
          <SignupTrigger variant="nav" location="header">
            {CTA.trial}
          </SignupTrigger>
        </div>
      </div>
    </header>
  )
}
