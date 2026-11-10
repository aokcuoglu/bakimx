import * as React from "react"
import { HighlightCard } from "@/components/shared/highlight-card"
import { cn } from "@/lib/utils"

/** List summary / filter tile. A badge is shown only when explicitly supplied. */
export function StatCard({
  label,
  value,
  badge,
  accent = "bg-muted text-muted-foreground border-border",
  href,
  active = false,
  className,
}: {
  label: string
  value: React.ReactNode
  badge?: React.ReactNode
  accent?: string
  href?: string
  active?: boolean
  className?: string
}) {
  return (
    <HighlightCard
      label={label}
      value={value}
      href={href}
      active={active}
      className={className}
      accessory={badge != null ? (
        <span className={cn("inline-flex min-h-5 items-center rounded-xs border px-1.5 text-xs font-medium", accent)}>
          {badge}
        </span>
      ) : undefined}
    />
  )
}
