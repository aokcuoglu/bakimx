"use client"

import { openCookiePreferences } from "@/lib/cookie-consent"
import { Button } from "@/components/ui/button"

export function CookiePreferencesButton({
  className,
}: {
  className?: string
}) {
  return (
    <Button type="button" variant="ghost" size="sm" onClick={() => openCookiePreferences()} className={className}>
      Çerez tercihleri
    </Button>
  )
}
