import Link from "next/link"
import { PillButton } from "../kit/pill-button"
import { Wordmark } from "../kit/wordmark"
import { CTA, NAV } from "./content"
import { SignupTrigger } from "./signup-dialog"
import styles from "./landing.module.css"

/**
 * Yapışkan buzlu üst bant (e-santral `.top`). Mobil menü kaynakta da yok.
 * Ana sayfa dışında (`anchorBase="/"`) çapalar ana sayfaya, wordmark köke gider.
 * Telefonda (≤640px) bantta tek hap görünür: `mobileAction="login"` (varsayılan)
 * "Giriş yap"ı gösterir; `/login` sayfası kendine link vermesin diye `"trial"` geçer.
 */
export function LandingHeader({
  anchorBase = "",
  mobileAction = "login",
}: {
  anchorBase?: "" | "/"
  mobileAction?: "login" | "trial"
}) {
  const mobileLogin = mobileAction === "login"
  return (
    <header className={styles.top}>
      <div className={styles.topIn}>
        <Wordmark variant="header" href={anchorBase ? "/" : "#hero"} />
        <nav className={styles.nav} aria-label="Ana menü">
          {NAV.map((item) => (
            <a key={item.id} href={`${anchorBase}#${item.id}`}>
              {item.label}
            </a>
          ))}
        </nav>
        <div className={styles.acts}>
          <Link className={styles.login} href="/login">
            {CTA.login}
          </Link>
          {mobileLogin && (
            <PillButton href="/login" size="nav" className={styles.loginPill}>
              {CTA.login}
            </PillButton>
          )}
          <span className={mobileLogin ? styles.trialNav : styles.trialNavPlain}>
            <SignupTrigger variant="nav" location="header">
              {CTA.trial}
            </SignupTrigger>
          </span>
        </div>
      </div>
    </header>
  )
}
