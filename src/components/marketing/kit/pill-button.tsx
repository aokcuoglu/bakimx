"use client"

import Link from "next/link"
import type { MouseEvent, ReactNode } from "react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"
import { trackCta, type CtaTrack } from "./cta-track"
import styles from "./kit.module.css"

export type PillSize = "md" | "lg" | "nav"

const SIZE_CLASS: Record<PillSize, string> = {
  md: styles.pillMd,
  lg: styles.pillLg,
  nav: styles.pillNav,
}

export type PillButtonProps = {
  href?: string
  /**
   * `href` ile: `true` dinamik hedefi de tam önceden yükler (Next `Link`
   * `prefetch`). Varsayılan Next davranışıdır (statik hedef tam, dinamik yok).
   */
  prefetch?: boolean
  size?: PillSize
  track?: CtaTrack
  onClick?: (event: MouseEvent<HTMLElement>) => void
  type?: "button" | "submit"
  disabled?: boolean
  fullWidth?: boolean
  className?: string
  children: ReactNode
}

/** Mavi hap düğme (e-santral `.d-blue`): md 44px, lg 50px, nav üst bant ölçüsü. */
export function PillButton({
  href,
  prefetch,
  size = "md",
  track,
  onClick,
  type = "button",
  disabled,
  fullWidth,
  className,
  children,
}: PillButtonProps) {
  const classes = cn(styles.pill, SIZE_CLASS[size], fullWidth && styles.full, className)
  const handleClick = (event: MouseEvent<HTMLElement>) => {
    if (track) trackCta(track)
    onClick?.(event)
  }

  if (href) {
    return (
      <Button asChild variant="default" className={classes}>
        <Link href={href} prefetch={prefetch} onClick={handleClick}>
          {children}
        </Link>
      </Button>
    )
  }

  return (
    <Button type={type} variant="default" disabled={disabled} className={classes} onClick={handleClick}>
      {children}
    </Button>
  )
}
