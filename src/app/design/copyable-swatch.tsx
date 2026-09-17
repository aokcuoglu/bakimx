"use client"

import { useState } from "react"
import { Check, Copy } from "lucide-react"
import { cn } from "@/lib/utils"

export function CopyableSwatch({
  name,
  hex,
  token,
  swatchClass,
  className,
}: {
  name: string
  hex: string
  token: string
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
        "group flex w-full items-center gap-3 rounded-lg border border-border bg-card p-3 text-left transition-colors hover:bg-muted/60 focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50",
        className
      )}
      aria-label={`${name} ${hex} kopyala`}
    >
      <span
        className={cn(
          "size-10 shrink-0 rounded-md border border-border shadow-sm",
          swatchClass
        )}
        aria-hidden
      />
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium text-foreground">
          {name}
        </span>
        <span className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-0.5 font-mono text-xs text-muted-foreground">
          <span>{hex}</span>
          <span className="text-border">·</span>
          <span className="truncate">{token}</span>
        </span>
      </span>
      <span className="shrink-0 text-muted-foreground opacity-0 transition-opacity group-hover:opacity-100 group-focus-visible:opacity-100">
        {copied ? (
          <Check className="size-4 text-success-strong" aria-hidden />
        ) : (
          <Copy className="size-4" aria-hidden />
        )}
      </span>
    </button>
  )
}
