"use client"

import { useEffect, useState } from "react"
import type { BlogHeading } from "@/lib/blog/article"
import styles from "@/components/sections/blog-article.module.css"

export function ArticleToc({ headings }: { headings: BlogHeading[] }) {
  const [active, setActive] = useState("")
  useEffect(() => {
    let frame = 0
    const update = () => {
      const elements = headings.map(({ id }) => document.getElementById(id)).filter((el) => el !== null)
      let current = elements[0]
      for (const element of elements) {
        if (element.getBoundingClientRect().top <= 125) current = element
      }
      setActive(current?.id ?? "")
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
  }, [headings])

  if (!headings.length) return null
  return <nav aria-label="İçindekiler" className={styles.toc}>
    <ol>{headings.map((heading) => <li key={heading.id} data-depth={heading.depth}>
      <a href={`#${heading.id}`} aria-current={active === heading.id ? "location" : undefined}>{heading.text}</a>
    </li>)}</ol>
  </nav>
}
