import Link from "next/link"
import { PillButton } from "../kit/pill-button"
import { Wordmark } from "../kit/wordmark"
import { CTA, NAV } from "./content"
import styles from "./site-header.module.css"

/**
 * Yapışkan buzlu üst bant (e-santral `.top`). Mobil menü kaynakta da yok.
 *
 * (site) layout'unda `SiteHeader` üzerinden bir kez render edilir (#798).
 * Ana sayfada menü sayfa içi çapalara kayar; diğer sayfalarda aynı bölümlere
 * `<Link>` ile istemci geçişi yapar, wordmark ana sayfaya döner.
 */
export function LandingHeader({ onHome }: { onHome: boolean }) {
  return (
    <header className={styles.top}>
      <div className={styles.topIn}>
        <Wordmark variant="header" href={onHome ? "#hero" : "/"} />
        <nav className={styles.nav} aria-label="Ana menü">
          {NAV.map((item) =>
            onHome ? (
              <a key={item.id} href={`#${item.id}`}>
                {item.label}
              </a>
            ) : (
              <Link key={item.id} href={`/#${item.id}`}>
                {item.label}
              </Link>
            ),
          )}
        </nav>
        {/*
          /login ve /register istek anında üretilir; varsayılan Link onları önceden
          yüklemez ve tıklama sunucuyu bekler. Bant her sayfada göründüğü için
          ikisi tam önceden yüklenir (anonim ziyaretçide DB sorgusu yok). Ölçüm
          (#798, yerel prod): prefetch ~90 ms, varsayılan ~140 ms, loading.tsx
          ~850 ms — React'in Suspense gösterim eşiği geçişi uzatıyor, eklemeyin.
          Telefonda gizli "Giriş yap" görünüm alanına girmediği için yüklenmez.
        */}
        <div className={styles.acts}>
          <Link className={styles.login} href="/login" prefetch>
            {CTA.login}
          </Link>
          <PillButton href="/register" prefetch size="nav" track={{ name: "trial_cta_click", location: "header" }}>
            {CTA.trial}
          </PillButton>
        </div>
      </div>
    </header>
  )
}
