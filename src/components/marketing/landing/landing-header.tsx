import Link from "next/link"
import { PillButton } from "../kit/pill-button"
import { Wordmark } from "../kit/wordmark"
import { CTA, NAV } from "./content"
import { SignupTrigger } from "./signup-dialog"
import styles from "./site-header.module.css"

/**
 * Yapışkan buzlu üst bant (e-santral `.top`). Mobil menü kaynakta da yok.
 *
 * (site) layout'unda `SiteHeader` üzerinden bir kez render edilir (#798).
 * Ana sayfada çapalar sayfa içinde kayar; ana sayfa dışında (`anchorBase="/"`)
 * aynı bölümlere `<Link>` ile istemci geçişi yapar, wordmark köke döner.
 * Telefonda (≤640px) bantta tek hap görünür: `mobileAction="login"` (varsayılan)
 * "Giriş yap"ı gösterir; `/login` kendine link vermesin diye `"trial"` geçer (#807).
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
          {NAV.map((item) =>
            anchorBase ? (
              <Link key={item.id} href={`${anchorBase}#${item.id}`}>
                {item.label}
              </Link>
            ) : (
              <a key={item.id} href={`#${item.id}`}>
                {item.label}
              </a>
            ),
          )}
        </nav>
        {/*
          /login istek anında üretilir; varsayılan Link onu önceden yüklemez ve
          tıklama sunucuyu bekler. Bant her sayfada göründüğü için tam önceden
          yüklenir (anonim ziyaretçide DB sorgusu yok). Ölçüm (#798, yerel prod):
          prefetch ~75–90 ms, varsayılan ~140 ms, loading.tsx ~850 ms — React'in
          Suspense gösterim eşiği geçişi uzatıyor, eklemeyin. Telefonda metin
          bağlantısı gizlidir, görünen "Giriş yap" hapıdır (PillButton prefetch
          prop'u taşımaz; varsayılan Link davranışı). "Ücretsiz
          deneyin" kayıt penceresini açar (#783); sağlayıcısı (site) layout'unda.
        */}
        <div className={styles.acts}>
          <Link className={styles.login} href="/login" prefetch>
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
