"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

/** Large getdesign.md-style color card: swatch block + name + hex + role. */
export function ColorCard({
  name,
  hex,
  token,
  description,
  swatchClass,
  className,
}: {
  name: string
  hex: string
  token: string
  description: string
  swatchClass: string
  className?: string
}) {
  const [copied, setCopied] = useState(false)

  async function copy() {
    try {
      await navigator.clipboard.writeText(hex)
      setCopied(true)
      window.setTimeout(() => setCopied(false), 1400)
    } catch {
      /* clipboard may be blocked */
    }
  }

  return (
    <button
      type="button"
      onClick={copy}
      className={cn(
        "group flex flex-col overflow-hidden rounded-lg border border-border bg-card text-left transition-colors hover:bg-muted/40 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      aria-label={`${name} ${hex} kopyala`}
    >
      <span
        className={cn("h-24 w-full border-b border-border sm:h-28", swatchClass)}
        aria-hidden
      />
      <span className="flex flex-1 flex-col gap-1.5 p-3.5">
        <span className="flex items-start justify-between gap-2">
          <span className="text-sm font-medium text-foreground">{name}</span>
          <span className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
            {copied ? (
              <Check className="size-3.5 text-success-strong" aria-hidden />
            ) : (
              <Copy className="size-3.5" aria-hidden />
            )}
          </span>
        </span>
        <span className="font-mono text-xs text-muted-foreground">{hex}</span>
        <span className="text-xs leading-relaxed text-muted-foreground">
          {description}
        </span>
        <span className="mt-auto pt-1 font-mono text-[10px] text-muted-foreground/80">
          {token}
        </span>
      </span>
    </button>
  )
}
