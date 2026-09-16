"use client"

import { useEffect, useMemo, useState } from "react"
import { Search } from "lucide-react"
import { PrintButton } from "@/components/shared/print-button"
import { GuideBlocks } from "@/components/guide/kilavuz-blocks"
import {
  KILAVUZ_H1,
  KILAVUZ_INTRO,
  KILAVUZ_SECTIONS,
  KILAVUZ_UPDATED_LABEL,
  guideSectionSearchText,
  type GuideSection,
} from "@/lib/guide/kilavuz"
import styles from "@/components/guide/kilavuz.module.css"

const SECTION_SEARCH = KILAVUZ_SECTIONS.map((section) => ({
  id: section.id,
  text: guideSectionSearchText(section),
}))

export function KilavuzShell() {
  const [query, setQuery] = useState("")
  const [activeId, setActiveId] = useState(KILAVUZ_SECTIONS[0]?.id ?? "")

  const visible: GuideSection[] = useMemo(() => {
    const q = query.trim().toLocaleLowerCase("tr-TR")
    if (!q) return KILAVUZ_SECTIONS
    const matched = new Set(
      SECTION_SEARCH.filter((row) => row.text.includes(q)).map((row) => row.id),
    )
    return KILAVUZ_SECTIONS.filter((section) => matched.has(section.id))
  }, [query])

  useEffect(() => {
    const headings = visible.map((section) => section.id)
    let frame = 0
    const update = () => {
      const elements = headings
        .map((id) => document.getElementById(id))
        .filter((el): el is HTMLElement => el !== null)
      let current = elements[0]
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= 120) current = element
      }
      setActiveId(current?.id ?? "")
    }
    const schedule = () => {
      cancelAnimationFrame(frame)
      frame = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener("scroll", schedule, { passive: true })
    window.addEventListener("resize", schedule)
    window.addEventListener("hashchange", schedule)
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener("scroll", schedule)
      window.removeEventListener("resize", schedule)
      window.removeEventListener("hashchange", schedule)
    }
  }, [visible])

  return (
    <>
      <a className={styles.skip} href="#kilavuz-icerik">
        İçeriğe atla
      </a>

      <section className={styles.hero}>
        <div className={styles.heroInner}>
          <p className={styles.eyebrow}>Ürün kılavuzu</p>
          <h1 className={styles.title}>{KILAVUZ_H1}</h1>
          <p className={styles.lede}>{KILAVUZ_INTRO}</p>
          <div className={styles.meta}>
            <span className="text-xs text-muted-foreground">Son güncelleme: {KILAVUZ_UPDATED_LABEL}</span>
          </div>
          <div className={`${styles.toolbar} print:hidden`}>
            <label className={styles.search}>
              <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
              <span className="sr-only">Kılavuzda ara</span>
              <input
                type="search"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                placeholder="Kılavuzda ara…"
                autoComplete="off"
              />
            </label>
            <PrintButton label="Kılavuzu yazdır" />
          </div>
        </div>
      </section>

      <div className={styles.layout}>
        <nav className={`${styles.toc} print:hidden`} aria-labelledby="kilavuz-toc-title">
          <h2 className={styles.tocTitle} id="kilavuz-toc-title">
            İçindekiler
          </h2>
          <ol className={styles.tocList}>
            {visible.map((section, index) => (
              <li key={section.id}>
                <a
                  href={`#${section.id}`}
                  aria-current={activeId === section.id ? "location" : undefined}
                >
                  <span className={styles.tocNum}>{index + 1}</span>
                  <span>{section.title}</span>
                </a>
              </li>
            ))}
          </ol>
        </nav>

        <main className={styles.content} id="kilavuz-icerik" tabIndex={-1}>
          {visible.length === 0 ? (
            <p className={styles.noResults}>
              Aramanızla eşleşen bölüm bulunamadı. Farklı bir terim deneyin.
            </p>
          ) : (
            visible.map((section) => (
              <section key={section.id} id={section.id} className={styles.section}>
                <div className={styles.sectionHead}>
                  <h2>{section.title}</h2>
                  <a className={styles.anchor} href={`#${section.id}`} aria-label="Bölüm bağlantısı">
                    #
                  </a>
                </div>
                <GuideBlocks blocks={section.blocks} />
              </section>
            ))
          )}

          <p className={styles.footerNote}>
            BakımX Kullanım Kılavuzu — son güncelleme: {KILAVUZ_UPDATED_LABEL}. Ekran görüntüleri demo
            anlatımıyla hazırlanır; canlı müşteri verisi içermez.
          </p>
        </main>
      </div>
    </>
  )
}
