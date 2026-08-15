"use client"

import { formatDistanceToNow } from "date-fns"
import { tr } from "date-fns/locale"
import { getOrderStatusLabel, ORDER_STATUS_COLORS } from "@/lib/orders/bakimx-order-utils"

interface StatusEvent {
  status: string
  timestamp: Date
}

interface OrderStatusTimelineProps {
  events: StatusEvent[]
  currentStatus: string
}

export function OrderStatusTimeline({ events, currentStatus }: OrderStatusTimelineProps) {
  const sortedEvents = [...events].sort((a, b) => new Date(b.timestamp).getTime() - new Date(a.timestamp).getTime())

  if (sortedEvents.length === 0) {
    return (
      <div className="text-center py-8 text-muted-foreground">
        <p>Durum geçişi kaydı bulunmamaktadır</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {sortedEvents.map((event, index) => {
        const { label } = getOrderStatusLabel(event.status)
        const color = ORDER_STATUS_COLORS[event.status as keyof typeof ORDER_STATUS_COLORS] || "gray"

        return (
          <div key={`${event.status}-${index}`} className="flex gap-4">
            <div className="flex flex-col items-center">
              <div
                className={`w-4 h-4 rounded-full ring-2 ring-white z-10 bg-${color}-600`}
                style={{
                  backgroundColor: `var(--color-${color}-600)` // Fallback to CSS variable
                }}
              />
              {index < sortedEvents.length - 1 && (
                <div className="w-1 h-12 bg-muted mt-2" />
              )}
            </div>
            <div className="pt-1">
              <div className="font-medium">{label}</div>
              <div className="text-sm text-muted-foreground">
                {formatDistanceToNow(new Date(event.timestamp), {
                  addSuffix: true,
                  locale: tr
                })}
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}
