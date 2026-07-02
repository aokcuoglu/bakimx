"use client"

import { useState } from "react"
import {
  History,
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
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
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
    <Card>
      <CardHeader className="pb-3">
        <CardTitle className="text-base flex items-center justify-between">
          <span className="flex items-center gap-2"><History className="size-4" /> İşlem Geçmişi</span>
          {entries.length > 0 && (
            <span className="text-sm font-normal text-muted-foreground">{entries.length} kayıt</span>
          )}
        </CardTitle>
      </CardHeader>
      <CardContent>
        {entries.length === 0 ? (
          <div className="text-center py-4 text-muted-foreground text-xs">
            <Clock className="size-5 mx-auto mb-1 opacity-30" />
            Henüz işlem kaydı yok
          </div>
        ) : (
          <div className="space-y-0 text-sm">
            {visible.map((entry, idx) => {
              const Icon = CATEGORY_ICONS[entry.category] || Clock
              const isLast = idx === visible.length - 1
              return (
                <div key={entry.id} className="flex gap-3">
                  <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center rounded-full shrink-0 size-9 bg-muted text-muted-foreground">
                      <Icon className="size-4" />
                    </div>
                    {!isLast && <div className="w-px flex-1 min-h-4 bg-border" />}
                  </div>
                  <div className={`pb-4 min-w-0 ${isLast ? "pb-0" : ""}`}>
                    <p className="font-medium leading-snug">{entry.label}</p>
                    {entry.detail && (
                      <p className="text-xs text-muted-foreground mt-0.5">{entry.detail}</p>
                    )}
                    <p className="text-xs text-muted-foreground mt-0.5">
                      {formatDate(entry.at)} · {entry.actor}
                    </p>
                  </div>
                </div>
              )
            })}
          </div>
        )}

        {collapsible && (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => setExpanded((v) => !v)}
            className="mt-1 w-full text-muted-foreground"
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
        )}
      </CardContent>
    </Card>
  )
}
