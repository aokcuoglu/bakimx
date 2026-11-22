import Image from "next/image"
import { cn } from "@/lib/utils"
import { MOCKUP } from "./content"
import styles from "./landing.module.css"

const PILL_CLASS = { info: styles.mPill, warn: cn(styles.mPill, styles.mPillWarn), ok: cn(styles.mPill, styles.mPillOk) } as const

const TAB_ICONS = [
  <path key="today" d="M3 10.5 12 3l9 7.5V20a1 1 0 0 1-1 1h-5v-6H9v6H4a1 1 0 0 1-1-1z" />,
  <>
    <rect x="8" y="2" width="8" height="4" rx="1" />
    <path d="M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2" />
  </>,
  <>
    <path d="M21 8a2 2 0 0 0-1-1.73l-7-4a2 2 0 0 0-2 0l-7 4A2 2 0 0 0 3 8v8a2 2 0 0 0 1 1.73l7 4a2 2 0 0 0 2 0l7-4A2 2 0 0 0 21 16Z" />
    <path d="m3.3 7 8.7 5 8.7-5M12 22V12" />
  </>,
  <>
    <path d="M19 7V4a1 1 0 0 0-1-1H5a2 2 0 0 0 0 4h15a1 1 0 0 1 1 1v4h-3a2 2 0 0 0 0 4h3a1 1 0 0 0 1-1v-2a1 1 0 0 0-1-1" />
    <path d="M3 5v14a2 2 0 0 0 2 2h15a1 1 0 0 0 1-1v-4" />
  </>,
]

/**
 * Hero telefonundaki uygulama ekranı (e-santral `.d-screen`), 350×760 tasarlanıp
 * `--s` ile ekran deliğine ölçeklenir. Dekoratif bir ürün görseli: ekran okuyucuya
 * tek bir `img` olarak sunulur, içi gizlidir. Veriler sentetik.
 */
export function AppMockup() {
  return (
    <div className={styles.mScreen} role="img" aria-label="BakımX uygulama ekranı: bugün serviste 7 araç, 3 hazır, iş emirleri ve bildirimler">
      <div aria-hidden="true">
        <div className={styles.mAppbar}>
          <span className={styles.mLogo}>
            Bakım
            <Image src="/landing/esantral/bakimx-x.svg" alt="" width={190} height={168} unoptimized />
          </span>
          <span className={styles.mAvatar}>{MOCKUP.avatar}</span>
        </div>
        <div className={styles.mHead}>
          <p className={styles.mTitle}>{MOCKUP.workshop}</p>
          <span>{MOCKUP.date}</span>
        </div>
        <div className={styles.mStats}>
          {MOCKUP.stats.map((stat) => (
            <div key={stat.label}>
              <b>{stat.value}</b>
              <span>{stat.label}</span>
            </div>
          ))}
        </div>
        <div className={styles.mList}>
          {MOCKUP.rows.map((row) => (
            <div key={row.plate} className={styles.mRow}>
              <span className={styles.mPlate}>{row.plate}</span>
              <p>
                {row.car}
                <small>{row.job}</small>
              </p>
              <span className={PILL_CLASS[row.status]}>{row.label}</span>
            </div>
          ))}
        </div>
        <p className={styles.mSec}>{MOCKUP.section}</p>
        {MOCKUP.notes.map((note) => (
          <div key={note.title} className={styles.mNote}>
            {note.kind === "whatsapp" ? (
              <span className={styles.mWa}>
                <svg viewBox="0 0 24 24">
                  <path d="M5 13l4 4L19 7" />
                </svg>
              </span>
            ) : (
              <span className={note.kind === "calendar" ? styles.mCal : styles.mStock}>{note.badge}</span>
            )}
            <p>
              <b>{note.title}</b>
              <small>{note.text}</small>
            </p>
          </div>
        ))}
        <div className={styles.mTabs}>
          {MOCKUP.tabs.map((tab, index) => (
            <span key={tab} className={index === 0 ? styles.mTabOn : undefined}>
              <svg viewBox="0 0 24 24">{TAB_ICONS[index]}</svg>
              {tab}
            </span>
          ))}
        </div>
      </div>
    </div>
  )
}
