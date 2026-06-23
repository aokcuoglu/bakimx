import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

/**
 * Liste ekranlarındaki KPI tile'ı (etiket + küçük badge + büyük sayı).
 * `href` verilirse tıklanabilir filtre kartı (aktif halde ring) olur;
 * verilmezse statik bir kart olur.
 */
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
  /** Sağ üstteki küçük badge içeriği — verilmezse `value` kullanılır. */
  badge?: React.ReactNode
  /** Badge renk sınıfları (bg/text/border). */
  accent?: string
  href?: string
  active?: boolean
  className?: string
}) {
  const inner = (
    <>
      <div className="flex items-center justify-between">
        <span className="text-xs text-muted-foreground font-medium">{label}</span>
        <span
          className={cn(
            "h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold",
            accent
          )}
        >
          {badge ?? value}
        </span>
      </div>
      <p className="mt-1 text-2xl font-bold text-foreground">{value}</p>
    </>
  )

  if (href) {
    return (
      <Link
        href={href}
        prefetch={false}
        className={cn(
          "rounded-lg border bg-card p-3 sm:p-4 transition-all hover:shadow-sm touch-manipulation",
          active ? "ring-2 ring-primary border-primary" : "border-border",
          className
        )}
      >
        {inner}
      </Link>
    )
  }

  return (
    <div className={cn("rounded-lg border border-border bg-card p-3 sm:p-4", className)}>
      {inner}
    </div>
  )
}
