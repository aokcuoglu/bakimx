"use client"

import { useEffect, useRef } from "react"

/**
 * Hero ölçekleme adası (e-santral app.js): metin bloğunun gerçek yüksekliğini
 * `--text` olarak hero'ya, telefon ekran deliğinin genişliğini 350px'lik maket
 * genişliğine bölüp `--s` olarak ele yazar. JS gelmeden CSS varsayılanları geçerli.
 */
export function HeroFit() {
  const marker = useRef<HTMLSpanElement>(null)

  useEffect(() => {
    const hero = marker.current?.closest<HTMLElement>("[data-hero]")
    const text = hero?.querySelector<HTMLElement>("[data-hero-text]")
    const hand = hero?.querySelector<HTMLElement>("[data-hand]")
    const screen = hero?.querySelector<HTMLElement>("[data-hand-screen]")
    if (!hero || !text || !hand || !screen) return

    const fit = () => {
      const gap = Math.max(44, Math.min(72, window.innerHeight * 0.06))
      hero.style.setProperty("--text", `${text.offsetHeight + gap}px`)
      hand.style.setProperty("--s", (screen.clientWidth / 350).toFixed(4))
    }
    fit()
    const observer = new ResizeObserver(fit)
    observer.observe(text)
    observer.observe(screen)
    window.addEventListener("resize", fit)
    return () => {
      observer.disconnect()
      window.removeEventListener("resize", fit)
    }
  }, [])

  return <span ref={marker} hidden />
}
