"use client"

import { useState, useMemo } from "react"
import Link from "next/link"
import { useRouter } from "next/navigation"
import {
  Plus,
  Search,
  BellRing,
  Calendar,
  Gauge,
  Loader2,
} from "lucide-react"
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card"
import { ReminderStatusBadge, ReminderTypeBadge } from "@/components/app/reminder-status-badge"
import { PlateBadge } from "@/components/app/plate-badge"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import {
  Select,
  SelectTrigger,
  SelectValue,
  SelectContent,
  SelectItem,
} from "@/components/ui/select"
import { formatDate } from "@/lib/utils-client"
import { MAINTENANCE_REMINDER_TYPES } from "@/lib/constants"
import { cn } from "@/lib/utils"
import type { ReminderRow } from "@/lib/reminders/queries"
import {
  completeReminderAction,
  cancelReminderAction,
  createAppointmentFromReminderAction,
} from "@/app/app/reminders/actions"

type Props = {
  initialReminders: ReminderRow[]
  stats: Record<string, number>
}

function customerName(c: ReminderRow["customer"]): string {
  if (c.type === "corporate") return c.companyName || "Kurumsal"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "Müşteri"
}

export function ReminderList({ initialReminders, stats }: Props) {
  const router = useRouter()
  const [search, setSearch] = useState("")
  const [statusFilter, setStatusFilter] = useState("")
  const [typeFilter, setTypeFilter] = useState("")
  const [dateFilter, setDateFilter] = useState("")
  const [actionLoading, setActionLoading] = useState<string | null>(null)

  const filtered = useMemo(() => {
    let items = initialReminders
    if (search) {
      const q = search.toLowerCase()
      items = items.filter(
        (r) =>
          r.title.toLowerCase().includes(q) ||
          r.customer.phone.includes(q) ||
          r.vehicle.plate.toLowerCase().includes(q) ||
          customerName(r.customer).toLowerCase().includes(q) ||
          r.vehicle.brand.toLowerCase().includes(q) ||
          r.vehicle.model.toLowerCase().includes(q)
      )
    }
    if (statusFilter) {
      items = items.filter((r) => r.status === statusFilter)
    }
    if (typeFilter) {
      items = items.filter((r) => r.type === typeFilter)
    }
    if (dateFilter) {
      const now = new Date()
      const today = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0)
      switch (dateFilter) {
        case "today": {
          const tomorrow = new Date(today.getTime() + 86400000)
          items = items.filter((r) => r.dueDate && new Date(r.dueDate) >= today && new Date(r.dueDate) < tomorrow)
          break
        }
        case "week": {
          const weekEnd = new Date(today.getTime() + 7 * 86400000)
          items = items.filter((r) => r.dueDate && new Date(r.dueDate) >= today && new Date(r.dueDate) < weekEnd)
          break
        }
        case "month": {
          const monthEnd = new Date(today.getTime() + 30 * 86400000)
          items = items.filter((r) => r.dueDate && new Date(r.dueDate) >= today && new Date(r.dueDate) < monthEnd)
          break
        }
        case "overdue": {
          items = items.filter((r) => r.status === "overdue")
          break
        }
      }
    }
    return items
  }, [initialReminders, search, statusFilter, typeFilter, dateFilter])

  async function handleAction(action: string, id: string) {
    setActionLoading(id)
    try {
      switch (action) {
        case "complete": {
          const form = new FormData()
          form.append("id", id)
          await completeReminderAction(form)
          break
        }
        case "cancel": {
          const form = new FormData()
          form.append("id", id)
          await cancelReminderAction(form)
          break
        }
        case "create-appointment": {
          const form = new FormData()
          form.append("id", id)
          const result = await createAppointmentFromReminderAction(form)
          if (result?.redirect) {
            router.push(result.redirect)
            return
          }
          break
        }
      }
      router.refresh()
    } catch {
    } finally {
      setActionLoading(null)
    }
  }

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex items-center text-sm text-muted-foreground">
        <Link href="/app" className="hover:text-foreground">Ana Panel</Link>
        <span className="mx-2">/</span>
        <span className="text-foreground font-medium">Bakım Hatırlatmaları</span>
      </div>

      <KpiCards stats={stats} />

      <Card>
        <CardHeader className="flex flex-row items-center justify-between gap-3">
          <CardTitle className="flex items-center gap-2 text-sm font-semibold">
            <BellRing className="size-4 text-muted-foreground" />
            Hatırlatmalar
            <span className="text-xs text-muted-foreground font-normal">({filtered.length})</span>
          </CardTitle>
          <Button nativeButton={false} size="sm" className="gap-1.5" render={<Link href="/app/reminders/new" />}>
            <Plus className="size-4" />
            Yeni Hatırlatma
          </Button>
        </CardHeader>
        <CardContent className="pt-0 space-y-4">
          <div className="flex flex-col sm:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
              <Input
                placeholder="Müşteri, plaka, başlık ara..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9 text-sm"
              />
            </div>
            <div className="flex gap-2 flex-wrap">
              <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v || "")}>
                <SelectTrigger className="w-[130px] text-sm">
                  <SelectValue placeholder="Durum" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tümü</SelectItem>
                  <SelectItem value="upcoming">Yaklaşan</SelectItem>
                  <SelectItem value="due_soon">Yaklaşıyor</SelectItem>
                  <SelectItem value="overdue">Gecikmiş</SelectItem>
                  <SelectItem value="completed">Tamamlandı</SelectItem>
                  <SelectItem value="postponed">Ertelendi</SelectItem>
                  <SelectItem value="cancelled">İptal</SelectItem>
                </SelectContent>
              </Select>
              <Select value={typeFilter} onValueChange={(v) => setTypeFilter(v || "")}>
                <SelectTrigger className="w-[140px] text-sm">
                  <SelectValue placeholder="Bakım Türü" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tümü</SelectItem>
                  {Object.entries(MAINTENANCE_REMINDER_TYPES).map(([k, v]) => (
                    <SelectItem key={k} value={k}>{v.label}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select value={dateFilter} onValueChange={(v) => setDateFilter(v || "")}>
                <SelectTrigger className="w-[130px] text-sm">
                  <SelectValue placeholder="Tarih" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="">Tümü</SelectItem>
                  <SelectItem value="today">Bugün</SelectItem>
                  <SelectItem value="week">Bu Hafta</SelectItem>
                  <SelectItem value="month">Bu Ay</SelectItem>
                  <SelectItem value="overdue">Geciken</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <BellRing className="size-10 mx-auto mb-2 text-muted-foreground/50" />
              <p className="text-sm">Henüz hatırlatma bulunmuyor</p>
              <Link
                href="/app/reminders/new"
                className="inline-flex items-center gap-1.5 mt-2 text-sm text-primary hover:text-primary/80 font-medium"
              >
                <Plus className="size-3.5" />
                Yeni hatırlatma oluştur
              </Link>
            </div>
          ) : (
            <>
              <div className="hidden md:block">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border">
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Hatırlatma</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Müşteri</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Plaka / Araç</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Bakım Türü</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Planlanan Tarih</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Planlanan KM</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Durum</th>
                      <th className="text-left py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">Kanal</th>
                      <th className="text-right py-2.5 px-3 font-medium text-muted-foreground text-xs uppercase tracking-wider">İşlem</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    {filtered.map((r) => (
                      <tr key={r.id} className="hover:bg-muted transition-colors">
                        <td className="py-3 px-3">
                          <Link href={`/app/reminders/${r.id}`} className="font-medium text-foreground hover:text-primary">
                            {r.title}
                          </Link>
                        </td>
                        <td className="py-3 px-3">
                          <div>
                            <Link href={`/app/customers/${r.customer.id}`} className="text-foreground hover:text-primary">
                              {customerName(r.customer)}
                            </Link>
                            <p className="text-[11px] text-muted-foreground/70">{r.customer.phone}</p>
                          </div>
                        </td>
                        <td className="py-3 px-3">
                          <Link href={`/app/vehicles/${r.vehicle.id}`} className="flex items-center gap-2">
                            <PlateBadge plate={r.vehicle.plate} />
                            <span className="text-xs text-muted-foreground">{r.vehicle.brand} {r.vehicle.model}</span>
                          </Link>
                        </td>
                        <td className="py-3 px-3">
                          <ReminderTypeBadge type={r.type} />
                        </td>
                        <td className="py-3 px-3 text-foreground">
                          {r.dueDate ? (
                            <span className="inline-flex items-center gap-1">
                              <Calendar className="size-3 text-muted-foreground/70" />
                              {formatDate(r.dueDate)}
                            </span>
                          ) : <span className="text-muted-foreground/70">—</span>}
                        </td>
                        <td className="py-3 px-3 text-foreground">
                          {r.dueMileage ? (
                            <span className="inline-flex items-center gap-1">
                              <Gauge className="size-3 text-muted-foreground/70" />
                              {r.dueMileage.toLocaleString("tr-TR")} km
                            </span>
                          ) : <span className="text-muted-foreground/70">—</span>}
                        </td>
                        <td className="py-3 px-3">
                          <ReminderStatusBadge status={r.status} />
                        </td>
                        <td className="py-3 px-3 text-xs text-muted-foreground">
                          {channelLabel(r.preferredChannel)}
                        </td>
                        <td className="py-3 px-3 text-right">
                          <div className="inline-flex items-center gap-1">
                            <Link
                              href={`/app/reminders/${r.id}`}
                              className="inline-flex items-center h-7 px-2 rounded-md text-xs font-medium text-muted-foreground hover:bg-muted transition-colors"
                            >
                              Görüntüle
                            </Link>
                            {r.status === "upcoming" || r.status === "due_soon" || r.status === "overdue" ? (
                              <>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-success"
                                  onClick={() => handleAction("complete", r.id)}
                                  disabled={actionLoading === r.id}
                                >
                                  {actionLoading === r.id ? <Loader2 className="size-3 animate-spin" /> : "Tamamla"}
                                </Button>
                                <Button
                                  variant="ghost"
                                  size="sm"
                                  className="text-primary"
                                  onClick={() => handleAction("create-appointment", r.id)}
                                  disabled={actionLoading === r.id}
                                >
                                  Randevu
                                </Button>
                              </>
                            ) : null}
                            {r.status !== "cancelled" && r.status !== "completed" ? (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="text-destructive"
                                onClick={() => handleAction("cancel", r.id)}
                                disabled={actionLoading === r.id}
                              >
                                İptal
                              </Button>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden space-y-3">
                {filtered.map((r) => (
                  <Link
                    key={r.id}
                    href={`/app/reminders/${r.id}`}
                    className="block rounded-lg border border-border bg-card p-4 hover:border-border transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-2">
                      <div className="min-w-0 flex-1">
                        <div className="flex items-center gap-2 flex-wrap">
                          <PlateBadge plate={r.vehicle.plate} />
                          <ReminderTypeBadge type={r.type} />
                        </div>
                        <h3 className="text-sm font-semibold text-foreground mt-1">{r.title}</h3>
                      </div>
                      <ReminderStatusBadge status={r.status} />
                    </div>
                    <div className="flex items-center gap-3 text-xs text-muted-foreground">
                      <span>{customerName(r.customer)}</span>
                      {r.dueDate ? (
                        <span className="inline-flex items-center gap-1">
                          <Calendar className="size-3" />
                          {formatDate(r.dueDate)}
                        </span>
                      ) : null}
                      {r.dueMileage ? (
                        <span className="inline-flex items-center gap-1">
                          <Gauge className="size-3" />
                          {r.dueMileage.toLocaleString("tr-TR")} km
                        </span>
                      ) : null}
                    </div>
                    <div className="mt-2 flex items-center gap-2">
                      {r.status === "upcoming" || r.status === "due_soon" || r.status === "overdue" ? (
                        <>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-success"
                            onClick={(e) => { e.preventDefault(); handleAction("complete", r.id) }}
                            disabled={actionLoading === r.id}
                          >
                            Tamamla
                          </Button>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="text-primary"
                            onClick={(e) => { e.preventDefault(); handleAction("create-appointment", r.id) }}
                            disabled={actionLoading === r.id}
                          >
                            Randevu
                          </Button>
                        </>
                      ) : null}
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}

function KpiCards({ stats }: { stats: Record<string, number> }) {
  const items = [
    { key: "upcoming", label: "Yaklaşan", color: "bg-primary/10 text-primary border-primary/20" },
    { key: "due_soon", label: "Yaklaşıyor", color: "bg-warning/10 text-warning border-warning/20" },
    { key: "overdue", label: "Geciken", color: "bg-destructive/10 text-destructive border-destructive/20" },
    { key: "completed", label: "Tamamlanan", color: "bg-success/10 text-success border-success/20" },
    { key: "postponed", label: "Ertelenen", color: "bg-primary/10 text-primary border-primary/20" },
    { key: "cancelled", label: "İptal", color: "bg-muted text-muted-foreground border-border" },
  ]
  return (
    <div className="grid grid-cols-3 sm:grid-cols-6 gap-2 sm:gap-3">
      {items.map((item) => (
        <div
          key={item.key}
          className={cn("rounded-lg border px-3 py-2.5 text-center", item.color)}
        >
          <p className="text-lg sm:text-xl font-bold">{stats[item.key] || 0}</p>
          <p className="text-[10px] sm:text-xs font-medium opacity-80">{item.label}</p>
        </div>
      ))}
    </div>
  )
}

function channelLabel(channel: string): string {
  const labels: Record<string, string> = {
    none: "Yok",
    sms: "SMS",
    whatsapp: "WhatsApp",
    phone: "Telefon",
    email: "E-posta",
  }
  return labels[channel] || channel
}
