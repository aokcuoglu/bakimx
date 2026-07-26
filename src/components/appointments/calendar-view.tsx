"use client"

import { useState, useTransition } from "react"
import Link from "next/link"
import { cn } from "@/lib/utils"
import { CalendarDays, ChevronLeft, ChevronRight, Clock, Truck, BellRing, RefreshCw, CheckCircle2, XCircle, Loader2 } from "lucide-react"
import { checkRemindersAction } from "@/app/(app)/calendar/actions"
import { Button } from "@/components/ui/button"

type ViewMode = "day" | "week" | "month"

interface CalendarViewItem {
  id: string
  title: string
  type: "appointment" | "delivery" | "maintenance_reminder"
  startAt: string
  endAt?: string
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

function formatDate(date: Date): string {
  return date.toISOString().split("T")[0]
}

function formatTime(isoString: string): string {
  const d = new Date(isoString)
  return d.toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

function formatDayHeader(date: Date): string {
  const days = ["Pazar", "Pazartesi", "Salı", "Çarşamba", "Perşembe", "Cuma", "Cumartesi"]
  return days[date.getDay()]
}

function formatMonthHeader(date: Date): string {
  return date.toLocaleDateString("tr-TR", { month: "long", year: "numeric" })
}

export function CalendarView({
  initialEvents,
  initialView,
  initialDate,
}: {
  initialEvents: CalendarViewItem[]
  initialView: string
  initialDate: string
}) {
  const [view, setView] = useState<ViewMode>((initialView as ViewMode) || "week")
  const [currentDate, setCurrentDate] = useState(initialDate)
  const [checking, setChecking] = useState(false)
  const [checkResult, setCheckResult] = useState<{ jobType: string; processed: number; sent: number; failed: number }[] | null>(null)
  const [, startTransition] = useTransition()

  const baseDate = new Date(currentDate + "T00:00:00")

  function navigate(direction: "prev" | "next") {
    const d = new Date(currentDate + "T00:00:00")
    if (view === "day") {
      d.setDate(d.getDate() + (direction === "next" ? 1 : -1))
    } else if (view === "week") {
      d.setDate(d.getDate() + (direction === "next" ? 7 : -7))
    } else {
      d.setMonth(d.getMonth() + (direction === "next" ? 1 : -1))
    }
    setCurrentDate(formatDate(d))
  }

  function goToToday() {
    setCurrentDate(formatDate(new Date()))
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

  const eventsByDate: Record<string, CalendarViewItem[]> = {}
  for (const event of initialEvents) {
    const dateKey = new Date(event.startAt).toISOString().split("T")[0]
    if (!eventsByDate[dateKey]) eventsByDate[dateKey] = []
    eventsByDate[dateKey].push(event)
  }

  function getDatesInView(): Date[] {
    const dates: Date[] = []
    if (view === "day") {
      dates.push(baseDate)
    } else if (view === "week") {
      const dayOfWeek = baseDate.getDay()
      const mondayOffset = dayOfWeek === 0 ? -6 : 1 - dayOfWeek
      const monday = new Date(baseDate)
      monday.setDate(baseDate.getDate() + mondayOffset)
      for (let i = 0; i < 7; i++) {
        const d = new Date(monday)
        d.setDate(monday.getDate() + i)
        dates.push(d)
      }
    } else {
      const year = baseDate.getFullYear()
      const month = baseDate.getMonth()
      const daysInMonth = new Date(year, month + 1, 0).getDate()
      for (let i = 1; i <= daysInMonth; i++) {
        dates.push(new Date(year, month, i))
      }
    }
    return dates
  }

  const dates = getDatesInView()
  const isToday = (d: Date) => formatDate(d) === formatDate(new Date())

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div className="flex items-center gap-2">
          <button onClick={() => navigate("prev")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground touch-manipulation" aria-label="Önceki">
            <ChevronLeft className="size-5" />
          </button>
          <Button variant="outline" size="sm" onClick={goToToday}>
            Bugün
          </Button>
          <button onClick={() => navigate("next")} className="p-1.5 rounded-lg hover:bg-muted text-muted-foreground touch-manipulation" aria-label="Sonraki">
            <ChevronRight className="size-5" />
          </button>
          <span className="text-base font-semibold text-foreground ml-2">
            {view === "month" ? formatMonthHeader(baseDate) : `${formatDayHeader(baseDate)}, ${baseDate.toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric" })}`}
          </span>
        </div>

        <div className="flex items-center gap-2">
          <div className="flex items-center rounded-lg border border-border overflow-hidden">
            {(["day", "week", "month"] as ViewMode[]).map((v) => {
              const labels: Record<ViewMode, string> = { day: "Günlük", week: "Haftalık", month: "Aylık" }
              return (
                <button
                  key={v}
                  onClick={() => setView(v)}
                  className={cn(
                    "px-3 py-1.5 text-sm font-medium transition-colors touch-manipulation",
                    view === v ? "bg-primary text-primary-foreground" : "bg-card text-muted-foreground hover:bg-muted"
                  )}
                >
                  {labels[v]}
                </button>
              )
            })}
          </div>

          <button
            onClick={handleCheckReminders}
            disabled={checking}
            className="inline-flex items-center gap-1.5 h-9 px-3 rounded-lg bg-warning hover:bg-warning/90 disabled:opacity-50 text-warning-foreground text-sm font-medium transition-colors touch-manipulation"
          >
            {checking ? <Loader2 className="size-4 animate-spin" /> : <RefreshCw className="size-4" />}
            Hatırlatmaları Kontrol Et
          </button>
        </div>
      </div>

      {checkResult && (
        <div className="rounded-lg border border-border bg-card p-4 space-y-2">
          <h3 className="text-sm font-semibold text-foreground">Hatırlatma Sonuçları</h3>
          {checkResult.map((r) => (
            <div key={r.jobType} className="flex items-center gap-2 text-sm">
              {r.failed > 0 ? <XCircle className="size-4 text-destructive" /> : <CheckCircle2 className="size-4 text-success" />}
              <span className="text-foreground font-medium">{r.jobType === "appointment_reminder" ? "Randevu" : r.jobType === "maintenance_reminder" ? "Bakım" : "Teslimat"} Hatırlatmaları:</span>
              <span className="text-muted-foreground">{r.processed} işlendi, {r.sent} gönderildi{r.failed > 0 ? `, ${r.failed} başarısız` : ""}</span>
            </div>
          ))}
          <button onClick={() => setCheckResult(null)} className="text-xs text-muted-foreground/70 hover:text-muted-foreground">Kapat</button>
        </div>
      )}

      <div className="flex items-center gap-4 text-xs text-muted-foreground">
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-primary" /> Randevu</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-success" /> Teslimat</span>
        <span className="flex items-center gap-1"><span className="size-2.5 rounded-full bg-warning" /> Bakım</span>
      </div>

      {view === "month" ? (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border bg-muted">
            {["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"].map((d) => (
              <div key={d} className="px-2 py-2 text-center text-xs font-semibold text-muted-foreground">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7">
            {(() => {
              const firstDay = new Date(baseDate.getFullYear(), baseDate.getMonth(), 1)
              const startDay = firstDay.getDay() === 0 ? 6 : firstDay.getDay() - 1
              const cells: React.ReactNode[] = []
              for (let i = 0; i < startDay; i++) {
                cells.push(<div key={`empty-${i}`} className="min-h-24 border-b border-r border-border bg-muted/50" />)
              }
              for (const date of dates) {
                const dateKey = formatDate(date)
                const dayEvents = eventsByDate[dateKey] || []
                const today = isToday(date)
                cells.push(
                  <div key={dateKey} className={cn("min-h-24 border-b border-r border-border p-1.5", today && "bg-primary/5")}>
                    <div className={cn("text-xs font-medium mb-1", today ? "text-primary" : "text-muted-foreground")}>
                      {date.getDate()}
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
                            {formatTime(event.startAt)} {event.title}
                          </Link>
                        )
                      })}
                      {dayEvents.length > 3 && (
                        <span className="text-[10px] text-muted-foreground/70 pl-1">+{dayEvents.length - 3} daha</span>
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
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <div className="grid grid-cols-7 border-b border-border">
            {dates.map((date) => {
              const today = isToday(date)
              return (
                <div key={formatDate(date)} className={cn("px-2 py-2 text-center border-r border-border last:border-r-0", today && "bg-primary/5")}>
                  <div className="text-[10px] uppercase font-semibold text-muted-foreground/70">{formatDayHeader(date)}</div>
                  <div className={cn("text-lg font-bold", today ? "text-primary" : "text-foreground")}>{date.getDate()}</div>
                </div>
              )
            })}
          </div>
          <div className="grid grid-cols-7 min-h-64">
            {dates.map((date) => {
              const dateKey = formatDate(date)
              const dayEvents = eventsByDate[dateKey] || []
              return (
                <div key={dateKey} className="border-r border-border last:border-r-0 p-1.5 space-y-1.5 min-h-48">
                  {dayEvents.length === 0 && (
                    <div className="text-xs text-muted-foreground/50 text-center py-4">—</div>
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
                          <span className={cn("font-semibold truncate", config.color)}>{formatTime(event.startAt)}</span>
                        </div>
                        <div className="font-medium text-foreground truncate">{event.title}</div>
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
      ) : (
        <div className="rounded-lg border border-border bg-white overflow-hidden">
          <div className="px-4 py-3 border-b border-border bg-muted">
            <div className="text-sm font-semibold text-foreground">
              {baseDate.toLocaleDateString("tr-TR", { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
            </div>
          </div>
          <div className="p-4 space-y-2">
            {(() => {
              const dateKey = formatDate(baseDate)
              const dayEvents = eventsByDate[dateKey] || []
              if (dayEvents.length === 0) {
                return (
                  <div className="text-center py-12 text-muted-foreground/70">
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
                        <span>{formatTime(event.startAt)}</span>
                        {event.endAt && <span> — {formatTime(event.endAt)}</span>}
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

      {initialEvents.length === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <CalendarDays className="size-12 mx-auto mb-3 text-muted-foreground/50" />
          <p className="text-sm font-medium">Bu dönemde etkinlik bulunamadı</p>
          <p className="text-xs mt-1">Randevu, teslimat veya bakım hatırlatması oluşturarak başlayın</p>
        </div>
      )}
    </div>
  )
}

function getEventLink(event: CalendarViewItem): string {
  if (event.type === "appointment") return `/appointments/${event.entityId}`
  if (event.type === "delivery") return `/orders/${event.entityId}`
  if (event.type === "maintenance_reminder") return `/reminders/${event.entityId}`
  return "/calendar"
}