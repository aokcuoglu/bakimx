import * as React from "react"
import Link from "next/link"
import { ChevronLeft } from "lucide-react"

import { cn } from "@/lib/utils"
import { pageTitle } from "@/lib/ui"

/**
 * Sayfa başlığı + opsiyonel alt başlık + aksiyon kümesi.
 * Mobilde başlık ile aksiyonlar dikey, sm+ yatay dizilir.
 */
export function PageHeader({
  title,
  description,
  actions,
  backHref,
  className,
}: {
  title: React.ReactNode
  description?: React.ReactNode
  /** Sağ tarafta yer alan butonlar / aksiyonlar. */
  actions?: React.ReactNode
  /** Verilirse başlığın soluna geri oku gösterir. */
  backHref?: string
  className?: string
}) {
  return (
    <div
      className={cn(
        "flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between",
        className
      )}
    >
      <div className="flex items-start gap-2 min-w-0">
        {backHref && (
          <Link
            href={backHref}
            aria-label="Geri"
            className="mt-0.5 inline-flex size-9 shrink-0 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground touch-manipulation"
          >
            <ChevronLeft className="size-5" />
          </Link>
        )}
        <div className="min-w-0">
          <h1 className={cn(pageTitle, "truncate")}>{title}</h1>
          {description && (
            <p className="mt-0.5 text-sm text-muted-foreground">{description}</p>
          )}
        </div>
      </div>
      {actions && (
        <div className="flex shrink-0 items-center gap-2">{actions}</div>
      )}
    </div>
  )
}
