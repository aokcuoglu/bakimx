import { cn } from "@/lib/utils"
import {
  CUSTOMER_TYPES,
  CUSTOMER_TAGS,
  CUSTOMER_PRICE_GROUPS,
  type CustomerTypeKey,
  type CustomerTagKey,
  type CustomerPriceGroupKey,
} from "@/lib/constants"

export function CustomerTypeBadge({ type, className }: { type: string; className?: string }) {
  const info = CUSTOMER_TYPES[type as CustomerTypeKey]
  if (!info) {
    return (
      <span className={cn("inline-flex items-center h-5 px-2 rounded-full border bg-muted text-muted-foreground border-border text-xs font-medium", className)}>
      —
    </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-xs font-medium", info.color, className)}>
      {info.label}
    </span>
  )
}

export function CustomerTagBadge({ tag, className }: { tag: string | null | undefined; className?: string }) {
  if (!tag) {
    return (
      <span className={cn("inline-flex items-center h-5 px-2 rounded-full border bg-muted text-muted-foreground/70 border-border text-[11px] font-medium", className)}>
        —
      </span>
    )
  }
  const info = CUSTOMER_TAGS[tag as CustomerTagKey]
  if (!info) {
    return (
      <span className={cn("inline-flex items-center h-5 px-2 rounded-full border bg-muted text-muted-foreground border-border text-[11px] font-medium", className)}>
        {tag}
      </span>
    )
  }
  return (
    <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-[11px] font-medium", info.color, className)}>
      {info.label}
    </span>
  )
}

export function PriceGroupBadge({ group, className }: { group: string | null | undefined; className?: string }) {
  if (!group) return null
  const info = CUSTOMER_PRICE_GROUPS[group as CustomerPriceGroupKey]
  if (!info) return null
  return (
    <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-[11px] font-medium", info.color, className)}>
      {info.label}
    </span>
  )
}
