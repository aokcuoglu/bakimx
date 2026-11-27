import { Badge } from "@/components/ui/badge"
import { cn } from "@/lib/utils"
import { statusToneBadgeVariant } from "@/lib/status-tone"
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
      <Badge variant="secondary" className={className}>
        —
      </Badge>
    )
  }
  return (
    <Badge variant={statusToneBadgeVariant(info.tone)} className={className}>
      {info.label}
    </Badge>
  )
}

export function CustomerTagBadge({ tag, className }: { tag: string | null | undefined; className?: string }) {
  if (!tag) {
    return (
      <Badge variant="secondary" className={cn("text-[11px]", className)}>
        —
      </Badge>
    )
  }
  const info = CUSTOMER_TAGS[tag as CustomerTagKey]
  if (!info) {
    return (
      <Badge variant="secondary" className={cn("text-[11px]", className)}>
        {tag}
      </Badge>
    )
  }
  return (
    <Badge variant={statusToneBadgeVariant(info.tone)} className={cn("text-[11px]", className)}>
      {info.label}
    </Badge>
  )
}

export function PriceGroupBadge({ group, className }: { group: string | null | undefined; className?: string }) {
  if (!group) return null
  const info = CUSTOMER_PRICE_GROUPS[group as CustomerPriceGroupKey]
  if (!info) return null
  return (
    <Badge variant={statusToneBadgeVariant(info.tone)} className={cn("text-[11px]", className)}>
      {info.label}
    </Badge>
  )
}
