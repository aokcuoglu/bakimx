"use client"

import { useEffect, useRef, useState, type ReactNode } from "react"
import { RoundIconButton } from "./round-icon-button"
import styles from "./kit.module.css"

const GAP = 20

/** Başlık + ok düğmeli, yatay kaydırmalı kart rayı (e-santral `.d-strip`). */
export function PhotoRail({ title, titleId, children }: { title: ReactNode; titleId: string; children: ReactNode }) {
  const rail = useRef<HTMLDivElement>(null)
  const [atStart, setAtStart] = useState(true)
  const [atEnd, setAtEnd] = useState(false)

  useEffect(() => {
    const el = rail.current
    if (!el) return
    const sync = () => {
      const max = el.scrollWidth - el.clientWidth - 2
      setAtStart(el.scrollLeft <= 2)
      setAtEnd(el.scrollLeft >= max)
    }
    const frame = requestAnimationFrame(sync)
    el.addEventListener("scroll", sync, { passive: true })
    window.addEventListener("resize", sync)
    return () => {
      cancelAnimationFrame(frame)
      el.removeEventListener("scroll", sync)
      window.removeEventListener("resize", sync)
    }
  }, [])

  const step = (direction: -1 | 1) => {
    const el = rail.current
    if (!el) return
    const card = el.firstElementChild
    const width = card ? card.getBoundingClientRect().width + GAP : el.clientWidth * 0.8
    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches
    el.scrollBy({ left: width * direction, behavior: reduced ? "auto" : "smooth" })
  }

  return (
    <>
      <div className={styles.railHead}>
        <h2 id={titleId} className={styles.railTitle}>
          {title}
        </h2>
        <div className={styles.railArrows}>
          <RoundIconButton label="Önceki kart" disabled={atStart} onClick={() => step(-1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.arrowIcon}>
              <path d="M10 3.5 5.5 8l4.5 4.5" />
            </svg>
          </RoundIconButton>
          <RoundIconButton label="Sonraki kart" disabled={atEnd} onClick={() => step(1)}>
            <svg viewBox="0 0 16 16" aria-hidden="true" className={styles.arrowIcon}>
              <path d="M6 3.5 10.5 8 6 12.5" />
            </svg>
          </RoundIconButton>
        </div>
      </div>
      <div ref={rail} className={styles.rail} role="region" aria-labelledby={titleId} tabIndex={0}>
        {children}
      </div>
    </>
  )
}
