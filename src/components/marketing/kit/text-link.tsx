"use client"

import Link from "next/link"
import type { MouseEvent } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { trackCta, type CtaTrack } from "./cta-track"
import styles from "./kit.module.css"

export type TextLinkProps = {
  href?: string
  /** Yeni sekmede açılan dış bağlantı (ör. WhatsApp). */
  external?: boolean
  track?: CtaTrack
  onClick?: (event: MouseEvent<HTMLElement>) => void
  className?: string
  children: string
}

/** Mavi metin bağlantısı, sonunda "›" (e-santral `.d-more`). */
export function TextLink({ href, external, track, onClick, className, children }: TextLinkProps) {
  const label = `${children} ›`
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (track) trackCta(track)
    onClick?.(event)
  }

  if (href && external) {
    return (
      <a href={href} target="_blank" rel="noopener noreferrer" className={cn(styles.textLink, className)} onClick={handleClick}>
        {label}
      </a>
    )
  }

  if (href) {
    return (
      <Link href={href} className={cn(styles.textLink, className)} onClick={handleClick}>
        {label}
      </Link>
    )
  }

  return (
    <Button type="button" variant="link" className={cn(styles.textLink, styles.textLinkButton, className)} onClick={handleClick}>
      {label}
    </Button>
  )
}
