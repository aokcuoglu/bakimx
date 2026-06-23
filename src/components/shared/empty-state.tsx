import * as React from "react"
import Link from "next/link"

import { cn } from "@/lib/utils"

type EmptyStateAction = {
  label: string
  href: string
}

export function EmptyState({
  icon: Icon,
  title,
  description,
  action,
  className,
}: {
  icon: React.ComponentType<{ className?: string }>
  title: string
  description?: string
  /** Tek bir CTA linki ya da özel bir aksiyon düğümü. */
  action?: EmptyStateAction | React.ReactNode
  className?: string
}) {
  const isLinkAction =
    action != null &&
    typeof action === "object" &&
    "href" in (action as EmptyStateAction)

  return (
    <div
      className={cn(
        "text-center py-16 px-4 text-muted-foreground bg-card border border-dashed border-border rounded-lg",
        className
      )}
    >
      <Icon className="size-14 mx-auto mb-4 text-muted-foreground/50" />
      <p className="text-base font-medium text-foreground">{title}</p>
      {description && <p className="text-sm mt-1">{description}</p>}
      {isLinkAction ? (
        <Link
          href={(action as EmptyStateAction).href}
          className="inline-flex items-center gap-1.5 mt-4 text-sm text-primary hover:text-primary/80 font-medium"
        >
          {(action as EmptyStateAction).label}
        </Link>
      ) : (
        action != null && <div className="mt-4">{action as React.ReactNode}</div>
      )}
    </div>
  )
}
