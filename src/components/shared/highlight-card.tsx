import type { ReactNode } from "react"
import Link from "next/link"
import { Card } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/** Compact record summary: label, optional icon, then value. */
export function HighlightCard({
  label,
  value,
  accessory,
  description,
  href,
  active = false,
  className,
}: {
  label: string
  value: ReactNode
  accessory?: ReactNode
  description?: ReactNode
  href?: string
  active?: boolean
  className?: string
}) {
  const content = (
    <Card
      data-slot="highlight-card"
      size="sm"
      className={cn(
        "min-h-24 min-w-0 gap-5 px-3 py-3 shadow-none",
        href && "h-full transition-colors group-hover/highlight:bg-muted motion-reduce:transition-none",
        active && "ring-2 ring-primary",
        className,
      )}
    >
      <div className="flex min-w-0 items-start justify-between gap-2">
        <span data-slot="highlight-label" className="text-xs leading-4 font-medium text-muted-foreground">{label}</span>
        {accessory && <span className="shrink-0 text-muted-foreground [&_svg]:size-4">{accessory}</span>}
      </div>
      <div className="mt-auto min-w-0">
        <div data-slot="highlight-value" className="text-sm leading-5 font-medium tabular-nums text-foreground wrap-anywhere">{value}</div>
        {description && <p data-slot="highlight-description" className="mt-1 text-xs leading-4 text-muted-foreground">{description}</p>}
      </div>
    </Card>
  )

  return href ? (
    <Link
      href={href}
      prefetch={false}
      aria-current={active ? "page" : undefined}
      className="group/highlight block min-w-0 rounded-xl outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
    >
      {content}
    </Link>
  ) : content
}
