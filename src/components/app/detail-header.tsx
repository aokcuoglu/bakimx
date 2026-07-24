"use client"

import type { ComponentType, ReactNode } from "react"
import { ArrowLeft, Car, User, Loader2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { PlateBadge } from "@/components/app/plate-badge"
import { cn } from "@/lib/utils"

export type DetailHeaderAction = {
  key: string
  label: string
  onClick: () => void
  tone: "primary" | "secondary" | "danger"
  icon?: ComponentType<{ className?: string }>
}

/**
 * Shared detail-page header for İş Emri (order) and Araç Kabul (intake).
 * Single row: back + plate + vehicle/customer meta + status badges + actions.
 * Actions render inline in the header on every breakpoint (no sticky bottom
 * bar). Badges are provided by the caller so each page keeps its own status
 * dictionary while sharing the pill visuals.
 */
export function DetailHeader({
  plate,
  vehicleLabel,
  customerLabel,
  badges,
  actions = [],
  loading = false,
  onBack,
}: {
  plate: string
  vehicleLabel: string
  customerLabel: string
  badges?: ReactNode
  actions?: DetailHeaderAction[]
  loading?: boolean
  onBack: () => void
}) {
  // Enforce one visual order everywhere: destructive (left) → secondary →
  // primary (right, strongest slot). Callers stay free to pass any order.
  const TONE_ORDER: Record<DetailHeaderAction["tone"], number> = { danger: 0, secondary: 1, primary: 2 }
  const orderedActions = [...actions].sort((a, b) => TONE_ORDER[a.tone] - TONE_ORDER[b.tone])
  const hasActions = orderedActions.length > 0

  const renderButtons = (opts: { size: "default" | "lg"; stretch?: boolean }) =>
    orderedActions.map((a) => {
      const Icon = a.icon
      const isDanger = a.tone === "danger"
      return (
        <Button
          key={a.key}
          size={opts.size}
          variant={a.tone === "primary" ? "default" : a.tone === "secondary" ? "outline" : "ghost"}
          onClick={a.onClick}
          disabled={loading}
          className={cn(
            isDanger
              ? "shrink-0 text-destructive hover:bg-destructive/10 hover:text-destructive"
              : opts.stretch && "flex-1"
          )}
        >
          {loading ? <Loader2 className="size-4 animate-spin" /> : Icon ? <Icon className="size-4" /> : null}
          {a.label}
        </Button>
      )
    })

  return (
    <div className="flex items-start gap-3 sm:items-center">
        <button
          onClick={onBack}
          className="p-2.5 hover:bg-muted rounded-lg touch-manipulation shrink-0"
          aria-label="Geri"
        >
          <ArrowLeft className="size-5" />
        </button>
        <div className="flex-1 min-w-0 flex flex-col items-start gap-1.5 sm:flex-row sm:items-center sm:justify-between sm:gap-2">
          <div className="flex flex-col items-start gap-1 min-w-0 sm:flex-row sm:items-center sm:flex-nowrap sm:gap-2">
            <PlateBadge plate={plate} size="sm" className="shrink-0" />
            <span className="hidden sm:inline text-muted-foreground/40 shrink-0">•</span>
            <span className="inline-flex items-center gap-1 min-w-0 text-sm text-muted-foreground">
              <Car className="size-3.5 shrink-0" />
              <span className="truncate">{vehicleLabel}</span>
            </span>
            <span className="hidden sm:inline text-muted-foreground/40 shrink-0">•</span>
            <span className="inline-flex items-center gap-1 min-w-0 text-sm text-muted-foreground">
              <User className="size-3.5 shrink-0" />
              <span className="truncate">{customerLabel}</span>
            </span>
          </div>
          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {badges}
            {hasActions && (
              <div className="flex flex-wrap items-center gap-2">
                {renderButtons({ size: "default" })}
              </div>
            )}
          </div>
        </div>
      </div>
  )
}
