"use client"

import { CheckCircle2, Clock, ClipboardList, Camera, AlertTriangle, MessageSquare, Wrench, Package } from "lucide-react"
import { TIMELINE_EVENT_LABELS } from "@/lib/intake/timeline-constants"

type TimelineEntry = {
  eventType: string
  description: string
  createdAt: Date
}

type ApprovalTimelineProps = {
  events: TimelineEntry[]
  intakeCreatedAt: Date
  approvedAt: Date | null
  compact?: boolean
}

const EVENT_ICONS: Record<string, React.ComponentType<{ className?: string }>> = {
  intake_created: ClipboardList,
  photos_uploaded: Camera,
  damage_marks_added: AlertTriangle,
  approval_requested: MessageSquare,
  approval_verified: CheckCircle2,
  work_order_created: Wrench,
  delivery_output_generated: Package,
}

function formatTimelineDate(d: Date): string {
  return new Date(d).toLocaleDateString("tr-TR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  })
}

export function ApprovalTimeline({ events, intakeCreatedAt, approvedAt, compact = false }: ApprovalTimelineProps) {
  const allEvents: TimelineEntry[] = [
    { eventType: "intake_created", description: "Araç kabul formu oluşturuldu", createdAt: intakeCreatedAt },
    ...events.filter((e) => e.eventType !== "intake_created"),
  ]

  const lastIdx = allEvents.length - 1

  return (
    <div className={`space-y-0 ${compact ? "text-xs" : "text-sm"}`}>
      {allEvents.map((event, idx) => {
        const Icon = EVENT_ICONS[event.eventType] || Clock
        const label = TIMELINE_EVENT_LABELS[event.eventType] || event.description
        const isLast = idx === lastIdx
        const isApproval = event.eventType === "approval_verified"

        return (
          <div key={`${event.eventType}-${idx}`} className="flex gap-3">
            <div className="flex flex-col items-center">
              <div
                className={`flex items-center justify-center rounded-full shrink-0 ${
                  compact ? "size-7" : "size-9"
                } ${
                  isApproval
                    ? "bg-emerald-100 text-emerald-600 border-2 border-emerald-300"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                <Icon className={compact ? "size-3.5" : "size-4"} />
              </div>
              {!isLast && (
                <div className="w-px flex-1 min-h-4 bg-border" />
              )}
            </div>
            <div className={`pb-4 ${isLast ? "pb-0" : ""}`}>
              <p className={`font-medium ${isApproval ? "text-emerald-700" : ""}`}>
                {label}
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">
                {formatTimelineDate(event.createdAt)}
              </p>
              {isApproval && approvedAt && (
                <p className="text-xs text-emerald-600 mt-1 flex items-center gap-1">
                  <CheckCircle2 className="size-3" />
                  Müşteri onayı doğrulandı
                </p>
              )}
            </div>
          </div>
        )
      })}

      {allEvents.length === 0 && (
        <div className="text-center py-4 text-muted-foreground text-xs">
          <Clock className="size-5 mx-auto mb-1 opacity-30" />
          Zaman çizelgesi henüz oluşturulmadı
        </div>
      )}
    </div>
  )
}