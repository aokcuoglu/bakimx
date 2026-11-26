"use client"

import { useOptimistic, useState, useTransition } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import { cn } from "@/lib/utils"
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Truck, BellRing, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { checkRemindersAction } from "@/app/(app)/calendar/actions"
import { Button } from "@/components/ui/button"
import { BrandSpinner } from "@/components/shared/brand-spinner"
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group"
import { eventStartLabel, eventTimeRangeLabel } from "@/lib/calendar/event-time"
import {
  dayKeysInView,
  dayOfMonth,
  formatDayHeading,
  formatDayTitle,
  formatMonthTitle,
  formatWeekdayName,
  groupByIstanbulDay,
  istanbulTodayKey,
  monthLeadingBlanks,
  type CalendarViewMode,
} from "@/lib/calendar/calendar-grid"
import { calendarHref, shiftCalendarDay } from "@/lib/calendar/calendar-navigation"

interface CalendarViewItem {
  id: string
  title: string
  type: "appointment" | "delivery" | "maintenance_reminder"
  startAt: string
  endAt?: string
  allDay?: boolean
  status?: string
  customerName?: string
  vehiclePlate?: string
  entityId?: string
  entityType?: string
}

const TYPE_CONFIG: Record<string, { label: string; color: string; bgColor: string; icon: React.ComponentType<{ className?: string }> }> = {
  appointment: { label: "Randevu", color: "text-foreground", bgColor: "bg-primary/10 border-primary/20", icon: CalendarDays },
  delivery: { label: "Teslimat", color: "text-foreground", bgColor: "bg-success/10 border-success/20", icon: Truck },
  maintenance_reminder: { label: "Bakım", color: "text-foreground", bgColor: "bg-warning/10 border-warning/20", icon: BellRing },
}

const STATUS_LABELS: Record<string, string> = {
  scheduled: "Planlandı",
  confirmed: "Onaylandı",
  arrived: "Geldi",
  converted: "Dönüştü",
  completed: "Tamamlandı",
  cancelled: "İptal",
  no_show: "Gelmedi",
  ready_for_delivery: "Teslimata Hazır",
  delivered: "Teslim Edildi",
  upcoming: "Yaklaşan",
  due_soon: "Yaklaşıyor",
  overdue: "Gecikmiş",
}

export function CalendarView({
  events,
  view,
  date,
}: {
  events: CalendarViewItem[]
  view: CalendarViewMode
  date: string
}) {
  const currentDate = date
  const router = useRouter()
  const [isNavigating, startNavigation] = useTransition()
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ jobType: string; processed: number; sent: number; failed: number }[] | null>(null)
  const [, startTransition] = useTransition()

  const [optimistic, setOptimistic] = useOptimistic({ view, date })

  function go(nextView: CalendarViewMode, nextDate: string) {
    if (nextView === optimistic.view && nextDate === optimistic.date) return
    startNavigation(() => {
      setOptimistic({ view: nextView, date: nextDate })
      router.push(calendarHref(nextView, nextDate), { scroll: false })
    })
  }

  async function handleCheckReminders() {
    setChecking(true)
    setCheckResult(null)
    startTransition(async () => {
      try {
        const results = await checkRemindersAction()
        setCheckResult(results)
      } catch {
        setCheckResult([])
      } finally {
        setChecking(false)
      }
    })
  }

  const eventsByDate = groupByIstanbulDay(events)
  const dayKeys = dayKeysInView(view, currentDate)
  const todayKey = istanbulTodayKey()

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <div className="flex items-center gap-1">
            <Button type="button" variant="ghost" size="icon" onClick={() => go(optimistic.view, shiftCalendarDay(optimistic.view, optimistic.date, "prev"))} aria-label="Önceki">
              <ChevronLeft className="size-5" />
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => go(optimistic.view, istanbulTodayKey())}>
              Bugün
            </Button>
            <Button type="button" variant="ghost" size="icon" onClick={() => go(optimistic.view, shiftCalendarDay(optimistic.view, optimistic.date, "next"))} aria-label="Sonraki">
              <ChevronRight className="size-5" />
            </Button>
          </div>
          <span className="min-w-0 text-base font-semibold text-foreground">
            {optimistic.view === "month" ? formatMonthTitle(optimistic.date) : formatDayTitle(optimistic.date)}
          </span>
        </div>

        <div className="flex flex-col gap-2 sm:flex-row sm:items-center">
          <ToggleGroup
            type="single"
            variant="segment"
            size="control"
            aria-label="Takvim görünümü"
            className="w-full sm:w-fit"
            value={optimistic.view}
            onValueChange={(v) => {
              if (v) go(v as CalendarViewMode, optimistic.date)
            }}
          >
            <ToggleGroupItem value="day" className="flex-1 sm:flex-none">Günlük</ToggleGroupItem>
            <ToggleGroupItem value="week" className="flex-1 sm:flex-none">Haftalık</ToggleGroupItem>
            <ToggleGroupItem value="month" className="flex-1 sm:flex-none">Aylık</ToggleGroupItem>
          </ToggleGroup>

          <Button
            type="button"
            variant="warning"
            className="w-full sm:w-auto"
            onClick={handleCheckReminders}
            disabled={checking}
          >
            {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Hatırlatmaları Kontrol Et
          </Button>
        </div>
      </div>

      {checkResult && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Hatırlatma Sonuçları</h3>
          {checkResult.map((r) => (
            <div key={r.jobType} className="flex items-center gap-2 text-sm">
              {r.failed > 0 ? <XCircle className="size-4 text-destructive-strong" /> : <CheckCircle2 className="size-4 text-success-strong" />}
              <span className="text-foreground font-medium">{r.jobType === "appointment_reminder" ? "Randevu" : r.jobType === "maintenance_reminder" ? "Bakım" : "Teslimat"} Hatırlatmaları:</span>
              <span className="text-muted-foreground">{r.processed} işlendi, {r.sent} gönderildi{r.failed > 0 ? `, ${r.failed} başarısız` : ""}</span>
            </div>
          ))}
          <Button type="button" variant="ghost" size="sm" onClick={() => setCheckResult(null)}>Kapat</Button>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-primary" /> Randevu</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-success" /> Teslimat</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warning" /> Bakım</span>
      </div>

      <div className="relative" role="region" aria-label="Takvim" aria-busy={isNavigating}>
        {isNavigating && (
          <div className="absolute inset-0 z-10 flex items-start justify-center rounded-lg bg-card/90">
            <BrandSpinner size={32} label="Takvim yükleniyor…" className="py-8" />
          </div>
        )}
      {view === "month" ? (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted">
            {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {(() => {
              const startDay = monthLeadingBlanks(currentDate)
              const cells: React.ReactNode[] = []
              for (let i = 0; i < startDay; i++) {
                cells.push(<div key={`empty-${i}`} className="min-h-24 border-b border-r border-border bg-muted/50" />)
              }
              for (const dayKey of dayKeys) {
                const dayEvents = eventsByDate[dayKey] || []
                const today = dayKey === todayKey
                cells.push(
                  <div key={dayKey} className={cn("min-h-24 border-b border-r border-border p-1.5", today && "bg-primary/5")}>
                    <div className={cn("text-xs font-medium mb-1", today ? "text-primary" : "text-muted-foreground")}>
                      {dayOfMonth(dayKey)}
                    </div>
                    <div className="space-y-0.5">
                      {dayEvents.slice(0, 3).map((event) => {
                        const config = TYPE_CONFIG[event.type]
                        return (
                          <Link
                            key={event.id}
                            href={getEventLink(event)}
                            className={cn("block text-[10px] leading-tight px-1 py-0.5 rounded truncate", config.bgColor, config.color)}
                          >
                            {eventStartLabel(event)} {event.title}
                          </Link>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground pl-1">+{dayEvents.length - 3} daha</span>
                      )}
                    </div>
                  </div>
                )
              }
              return cells
            })()}
          </div>
        </div>
      ) : view === "week" ? (
        <div className="rounded-lg border border-border bg-card overflow-x-auto">
         <div className="min-w-224 md:min-w-0">
          <div className="grid grid-cols-7 border-b border-border">
            {dayKeys.map((dayKey) => {
              const today = dayKey === todayKey
              return (
                <div key={dayKey} className={cn("px-2 py-2 text-center border-r border-border last:border-r-0", today && "bg-primary/5")}>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground">{formatWeekdayName(dayKey)}</div>
                  <div className={cn("text-lg font-bold", today ? "text-primary" : "text-foreground")}>{dayOfMonth(dayKey)}</div>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-7 min-h-64">
            {dayKeys.map((dayKey) => {
              const dayEvents = eventsByDate[dayKey] || []
              return (
                <div key={dayKey} className="border-r border-border last:border-r-0 p-1.5 space-y-1.5 min-h-48">
                  {dayEvents.length === 0 && (
                    <div className="text-xs text-muted-foreground text-center py-4">—</div>
                  )}
                  {dayEvents.map((event) => {
                    const config = TYPE_CONFIG[event.type]
                    const Icon = config.icon
                    return (
                      <Link
                        key={event.id}
                        href={getEventLink(event)}
                        className={cn("block rounded-lg border p-2 text-xs transition-colors hover:shadow-sm", config.bgColor)}
                      >
                        <div className="flex items-center gap-1 mb-0.5">
                          <Icon className={cn("size-3 shrink-0", config.color)} />
                          <span className={cn("font-semibold truncate", config.color)}>{eventStartLabel(event)}</span>
                        </div>
                        <div className="font-medium text-foreground line-clamp-2 break-words">{event.title}</div>
                        {event.vehiclePlate && (
                          <div className="text-muted-foreground mt-0.5 font-mono">{event.vehiclePlate}</div>
                        )}
                        {event.status && (
                          <span className={cn("inline-block mt-0.5 text-[10px] px-1 py-0.5 rounded", config.color)}>
                            {STATUS_LABELS[event.status] || event.status}
                          </span>
                        )}
                      </Link>
                    )
                  })}
                </div>
              )
            })}
          </div>
         </div>
        </div>
      ) : (
        <div className="rounded-lg border border-border bg-card overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <div className="text-sm font-semibold text-foreground">
              {formatDayHeading(currentDate)}
            </div>
          </div>
          <div className="p-4 space-y-2">
            {(() => {
              const dayEvents = eventsByDate[currentDate] || []
              if (dayEvents.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground">
                    <CalendarDays className="size-12 mx-auto mb-3 text-muted-foreground/50" />
                    <p className="text-sm font-medium">Bu tarihte etkinlik yok</p>
                  </div>
                )
              }
              return dayEvents.map((event) => {
                const config = TYPE_CONFIG[event.type]
                const Icon = config.icon
                return (
                  <Link
                    key={event.id}
                    href={getEventLink(event)}
                    className={cn("flex items-start gap-3 rounded-lg border p-3 transition-colors hover:shadow-sm", config.bgColor)}
                  >
                    <Icon className={cn("size-5 shrink-0 mt-0.5", config.color)} />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-foreground truncate">{event.title}</span>
                        <span className={cn("text-[10px] px-1.5 py-0.5 rounded font-medium", config.bgColor, config.color)}>
                          {config.label}
                        </span>
                      </div>
                      <div className="flex items-center gap-1 mt-0.5 text-sm text-muted-foreground">
                        <Clock className="size-3.5" />
                        <span>{eventTimeRangeLabel(event)}</span>
                      </div>
                      {event.vehiclePlate && (
                        <span className="inline-block mt-1 text-xs font-mono bg-card text-foreground px-1.5 py-0.5 rounded">
                          {event.vehiclePlate}
                        </span>
                      )}
                      {event.status && (
                        <span className="inline-block mt-1 text-xs text-muted-foreground">
                          {STATUS_LABELS[event.status] || event.status}
                        </span>
                      )}
                    </div>
                  </Link>
                )
              })
            })()}
          </div>
        </div>
      )}

      {events.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarDays className="size-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium">Bu dönemde etkinlik bulunamadı</p>
          <p className="text-xs mt-1">Randevu, teslimat veya bakım hatırlatması oluşturarak başlayın</p>
        </div>
      )}
      </div>
    </div>
  )
}

function getEventLink(event: CalendarViewItem): string {
  if (event.type === "appointment") return `/appointments/${event.entityId}`
  if (event.type === "delivery") return `/orders/${event.entityId}`
  if (event.type === "maintenance_reminder") return `/reminders/${event.entityId}`
  return "/calendar"
}
