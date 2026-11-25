"use client"

import type { ComponentProps } from "react"
import { openCookiePreferences } from "@/lib/cookie-consent"
import { Button } from "@/components/ui/button"

type ButtonProps = ComponentProps<typeof Button>

export function CookiePreferencesButton({
  className,
  variant = "ghost",
  size = "sm",
}: {
  className?: string
  /** Altbilgi bağlantı listesinde `link` + `inline` (#889). */
  variant?: ButtonProps["variant"]
  size?: ButtonProps["size"]
}) {
  return (
    <Button type="button" variant={variant} size={size} onClick={() => openCookiePreferences()} className={className}>
      Çerez tercihleri
    </Button>
  )
}
