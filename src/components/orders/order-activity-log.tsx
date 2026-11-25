"use client"

import { useState } from "react"
import {
  Clock,
  Wrench,
  Package,
  Wallet,
  Activity,
  Pencil,
  Camera,
  AlertTriangle,
  UserCog,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { DetailPanel, DetailPill, DetailEmpty, DetailItem, detail, surface } from "./order-detail-surface"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import type { OrderActivityEntry, ActivityCategory } from "@/lib/orders/activity"

const CATEGORY_ICONS: Record<ActivityCategory, React.ComponentType<{ className?: string }>> = {
  create: Wrench,
  part: Package,
  labor: Wrench,
  payment: Wallet,
  status: Activity,
  meta: Pencil,
  photo: Camera,
  damage: AlertTriangle,
  tech: UserCog,
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

const INITIAL_COUNT = 6

export function OrderActivityLog({ entries }: { entries: OrderActivityEntry[] }) {
  const [expanded, setExpanded] = useState(false)
  const visible = expanded ? entries : entries.slice(0, INITIAL_COUNT)
  const collapsible = entries.length > INITIAL_COUNT
  const hiddenCount = entries.length - INITIAL_COUNT

  return (
    <DetailPanel
      title="İşlem Geçmişi"
      aside={entries.length > 0 && <DetailPill tone="neutral">{entries.length} kayıt</DetailPill>}
    >
      {entries.length === 0 ? (
        <DetailEmpty>Henüz işlem kaydı yok</DetailEmpty>
      ) : (
        <div className={detail.group}>
          {visible.map((entry) => {
            const Icon = CATEGORY_ICONS[entry.category] || Clock
            return (
              <DetailItem
                key={entry.id}
                start={
                  <span aria-hidden className={cn(surface.tile, surface["tone-neutral"])} data-shape="circle">
                    <Icon />
                  </span>
                }
                title={entry.label}
                sub={entry.detail}
                meta={`${formatDate(entry.at)} · ${entry.actor}`}
              />
            )
          })}
        </div>
      )}

      {collapsible && (
        <div className={surface.cardFoot}>
          <Button
            type="button"
            variant="ghost"
            onClick={() => setExpanded((v) => !v)}
            className="w-full text-muted-foreground"
          >
            {expanded ? (
              <>
                <ChevronUp className="size-4" /> Daha az göster
              </>
            ) : (
              <>
                <ChevronDown className="size-4" /> {hiddenCount} kaydı daha göster
              </>
            )}
          </Button>
        </div>
      )}
    </DetailPanel>
  )
}
