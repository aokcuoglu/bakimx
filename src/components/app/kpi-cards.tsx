"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import type { LucideIcon } from "lucide-react"

type KpiItem = {
  key: string
  label: string
  count: number
  accent: string
  href?: string
  icon?: LucideIcon
}

export function KpiCards({ items, className }: { items: KpiItem[]; className?: string }) {
  const cols =
    items.length <= 2
      ? "grid-cols-2"
      : items.length <= 4
        ? "grid-cols-2 sm:grid-cols-4"
        : "grid-cols-2 sm:grid-cols-3 lg:grid-cols-6"

  return (
    <div className={cn(`grid ${cols} gap-3`, className)}>
      {items.map((item) => {
        const Icon = item.icon
        const content = (
          <div
            className={cn(
              "rounded-xl border bg-white p-3 sm:p-4 transition-all hover:shadow-sm",
              "border-slate-200"
            )}
          >
            <div className="flex items-center justify-between">
              <span className="text-xs text-slate-500 font-medium">{item.label}</span>
              <span
                className={cn(
                  "h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold",
                  item.accent
                )}
              >
                {item.count}
              </span>
            </div>
            <p className="mt-1 text-2xl font-bold text-slate-900">{item.count}</p>
            {Icon && <Icon className="size-4 text-slate-400 mt-1" />}
          </div>
        )

        if (item.href) {
          return (
            <Link key={item.key} href={item.href} prefetch={false} className="touch-manipulation">
              {content}
            </Link>
          )
        }

        return <div key={item.key}>{content}</div>
      })}
    </div>
  )
}

export function KpiCardsLinked({
  items,
  activeKey,
  baseHref,
  className,
}: {
  items: (Omit<KpiItem, "href"> & { filterValue?: string })[]
  activeKey?: string
  baseHref: string
  className?: string
}) {
  const linkedItems: KpiItem[] = items.map((item) => {
    const isActive = activeKey === item.key
    const href = isActive ? baseHref : `${baseHref}${baseHref.includes("?") ? "&" : "?"}${item.filterValue ? `status=${item.filterValue}` : ""}`
    return {
      ...item,
      href,
    }
  })

  return <KpiCards items={linkedItems} className={className} />
}