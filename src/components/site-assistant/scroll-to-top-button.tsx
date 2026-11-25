"use client"

import { useEffect, useState } from "react"
import { ArrowUp } from "lucide-react"
import { Button } from "@/components/ui/button"
import { scrollToPageTop } from "@/lib/scroll-to-page-top"

const SHOW_AFTER_PX = 80

export function ScrollToTopButton() {
  const [visible, setVisible] = useState(false)

  useEffect(() => {
    const updateVisibility = () => setVisible(window.scrollY > SHOW_AFTER_PX)

    updateVisibility()
    window.addEventListener("scroll", updateVisibility, { passive: true })
    return () => window.removeEventListener("scroll", updateVisibility)
  }, [])

  if (!visible) return null

  return (
    <Button
      type="button"
      variant="outline"
      size="icon-lg"
      aria-label="Sayfanın başına dön"
      onClick={scrollToPageTop}
      className="fixed bottom-4 right-[4.75rem] z-40 shadow-md transition-transform hover:scale-105 active:scale-95 motion-reduce:transition-none motion-reduce:hover:scale-100 motion-reduce:active:scale-100 sm:bottom-6 sm:right-[5.25rem] [&_svg]:size-5"
      style={{ marginBottom: "env(safe-area-inset-bottom)" }}
    >
      <ArrowUp className="size-6" />
    </Button>
  )
}
