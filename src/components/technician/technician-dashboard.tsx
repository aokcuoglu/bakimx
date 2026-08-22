"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Wrench, Clock, CheckCircle2, Truck, AlertTriangle,
  ChevronRight,
} from "lucide-react"
import { TECHNICIAN_ROLES, ORDER_STATUS } from "@/lib/constants"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { TECHNICIAN_PARAM } from "@/lib/technician/selected-technician"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"

type DashboardFilter = "all" | "assigned" | "in_progress" | "waiting" | "completed" | "today_delivery"

const DASHBOARD_FILTER_PARAM = "filter"

type TechnicianInfo = {
  id: string
  fullName: string
  phone: string
  role: string
  isActive: boolean
}

type DashboardStats = {
  assignedToMe: number
  inProgress: number
  waiting: number
  completed: number
  todayDelivery: number
}

type OrderRow = {
  id: string
  workOrderNo: string
  status: string
  customerName: string
  customerPhone: string
  plate: string
  brand: string
  model: string
  customerComplaint: string
  estimatedDeliveryAt: string | null
  assignedAt: string | null
  completedAt: string | null
  createdAt: string
  assignedTechnicianId: string | null
  technicianName: string | null
  checklistProgress: { completed: number; total: number }
  hasActiveLabor: boolean
}

export function TechnicianDashboard({
  technicians,
  selectedTechnicianId,
  canSelectTechnician,
  stats,
  orders,
}: {
  technicians: TechnicianInfo[]
  selectedTechnicianId: string
  canSelectTechnician: boolean
  stats: DashboardStats
  orders: OrderRow[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Seçim URL'de taşınır: sunucu KPI'ları ve iş emirlerini seçilen teknisyene
  // göre yeniden sorgular. Yerel state yalnızca gezinme sürerken seçimi anında
  // göstermek için tutulur; sunucudan yeni seçim gelince (ör. geri/ileri) ona
  // hizalanır.
  const [optimisticId, setOptimisticId] = useState(selectedTechnicianId)
  const [lastServerId, setLastServerId] = useState(selectedTechnicianId)
  if (lastServerId !== selectedTechnicianId) {
    setLastServerId(selectedTechnicianId)
    setOptimisticId(selectedTechnicianId)
  }

  function handleTechnicianChange(value: string | null) {
    if (!value || value === optimisticId) return
    setOptimisticId(value)
    startTransition(() => {
      const params = new URLSearchParams(searchParams.toString())
      params.set(TECHNICIAN_PARAM, value)
      router.replace(`/technician?${params.toString()}`, { scroll: false })
    })
  }

  const requestedFilter = searchParams.get(DASHBOARD_FILTER_PARAM)
  const activeFilter: DashboardFilter = ["assigned", "in_progress", "waiting", "completed", "today_delivery"].includes(requestedFilter ?? "")
    ? requestedFilter as DashboardFilter
    : "all"

  function handleFilterChange(filter: DashboardFilter) {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === activeFilter) params.delete(DASHBOARD_FILTER_PARAM)
    else params.set(DASHBOARD_FILTER_PARAM, filter)
    startTransition(() => router.replace(`/technician${params.size ? `?${params.toString()}` : ""}`, { scroll: false }))
  }

  const activeOrders = orders.filter((o) =>
    ["in_progress", "approved", "waiting_parts"].includes(o.status)
  )
  const waitingOrders = orders.filter((o) => ["draft", "waiting_approval"].includes(o.status))
  const completedOrders = orders.filter((o) => ["ready_for_delivery", "delivered"].includes(o.status))

  const today = new Date().toLocaleDateString("en-CA")
  const selectedOrders = orders.filter((o) => o.assignedTechnicianId === selectedTechnicianId)
  const assignedOrders = selectedOrders.filter((o) => !["delivered", "cancelled"].includes(o.status))
  const inProgressOrders = selectedOrders.filter((o) => o.status === "in_progress")
  const selectedWaitingOrders = selectedOrders.filter((o) => ["approved", "waiting_parts"].includes(o.status))
  const selectedCompletedOrders = selectedOrders.filter((o) =>
    o.status === "delivered" && o.completedAt && new Date(o.completedAt).toLocaleDateString("en-CA") === today
  )
  const todayDeliveryOrders = selectedOrders.filter((o) =>
    o.estimatedDeliveryAt && new Date(o.estimatedDeliveryAt).toLocaleDateString("en-CA") === today && !["delivered", "cancelled"].includes(o.status)
  )

  const visibleSections = activeFilter === "all"
    ? [
        { title: "Aktif İşler", orders: activeOrders, empty: "Aktif iş bulunmuyor" },
        { title: "Bekleyen İşler", orders: waitingOrders, empty: "Bekleyen iş bulunmuyor" },
        { title: "Son Tamamlananlar", orders: completedOrders.slice(0, 5), empty: "Tamamlanan iş bulunmuyor" },
      ]
    : activeFilter === "assigned"
      ? [{ title: "Bana Atanan İşler", orders: assignedOrders, empty: "Atanmış iş bulunmuyor" }]
      : activeFilter === "in_progress"
      ? [{ title: "Devam Eden İşler", orders: inProgressOrders, empty: "Devam eden iş bulunmuyor" }]
      : activeFilter === "waiting"
        ? [{ title: "Bekleyen İşler", orders: selectedWaitingOrders, empty: "Bekleyen iş bulunmuyor" }]
        : activeFilter === "completed"
          ? [{ title: "Tamamlanan İşler", orders: selectedCompletedOrders, empty: "Bugün tamamlanan iş bulunmuyor" }]
          : [{ title: "Bugün Teslim Edilecekler", orders: todayDeliveryOrders, empty: "Bugün teslim edilecek iş bulunmuyor" }]

  const kpiCards = [
    { filter: "assigned" as const, label: "Bana Atanan", value: stats.assignedToMe, icon: Wrench, color: "bg-primary/10 text-primary-strong" },
    { filter: "in_progress" as const, label: "Devam Eden", value: stats.inProgress, icon: Clock, color: "bg-warning/10 text-warning-strong" },
    { filter: "waiting" as const, label: "Bekleyen", value: stats.waiting, icon: AlertTriangle, color: "bg-warning/10 text-warning-strong" },
    { filter: "completed" as const, label: "Tamamlanan", value: stats.completed, icon: CheckCircle2, color: "bg-success/10 text-success-strong" },
    { filter: "today_delivery" as const, label: "Bugün Teslim", value: stats.todayDelivery, icon: Truck, color: "bg-primary/10 text-primary-strong" },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Teknisyen Paneli</h2>
          <p className="text-sm text-muted-foreground mt-0.5">
            {canSelectTechnician
              ? "Seçili teknisyenin iş atamalarını yönetin"
              : "Atölyedeki iş emirlerini görüntüleyin, kendi görevlerinizi yönetin"}
          </p>
        </div>
        {canSelectTechnician && (
          <Select
            value={optimisticId}
            onValueChange={handleTechnicianChange}
          >
            <SelectTrigger aria-label="Teknisyen seç">
              <SelectValue placeholder="Teknisyen seç" />
            </SelectTrigger>
            <SelectContent>
              {technicians.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.fullName} — {(TECHNICIAN_ROLES as Record<string, { label: string }>)[t.role]?.label || t.role}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        )}
      </div>

      <div
        aria-busy={isPending}
        className={cn(
          "space-y-5 sm:space-y-6 transition-opacity",
          isPending && "opacity-60 pointer-events-none"
        )}
      >
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
          {kpiCards.map((card) => {
            const Icon = card.icon
            return (
              <Button
                key={card.label}
                type="button"
                variant="ghost"
                aria-pressed={activeFilter === card.filter}
                onClick={() => handleFilterChange(card.filter)}
                className={cn(
                  "h-auto min-w-0 items-start justify-start rounded-lg border border-border bg-card p-4 text-left hover:border-primary hover:bg-primary/5",
                  activeFilter === card.filter && "border-primary bg-primary/5 ring-2 ring-primary/20"
                )}
              >
                <span className="w-full">
                <div className={cn("inline-flex items-center justify-center size-9 rounded-lg mb-2", card.color)}>
                  <Icon className="size-4" />
                </div>
                <p className="text-2xl font-bold text-foreground">{card.value}</p>
                <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
                </span>
              </Button>
            )
          })}
        </div>

        {visibleSections.map((section) => (
          <section key={section.title}>
            <h3 className="text-base font-semibold text-foreground mb-3">{section.title}</h3>
            {section.orders.length === 0 ? (
              <div className="text-center py-8 text-muted-foreground text-sm">{section.empty}</div>
            ) : (
              <div className="space-y-2">
                {section.orders.map((order) => (
                  <OrderCard key={order.id} order={order} />
                ))}
              </div>
            )}
          </section>
        ))}
      </div>
    </div>
  )
}

function OrderCard({ order }: { order: OrderRow }) {
  const statusInfo = (ORDER_STATUS as Record<string, { label: string; color: string }>)[order.status]
  const statusLabel = statusInfo?.label || order.status
  const statusColor = statusInfo?.color || "bg-muted text-foreground"
  const progressPct = order.checklistProgress.total > 0
    ? Math.round((order.checklistProgress.completed / order.checklistProgress.total) * 100)
    : 0

  return (
    <Link
      href={`/technician/orders/${order.id}`}
      className="block rounded-lg border border-border bg-card p-4 hover:border-primary hover:bg-primary/5 transition-colors touch-manipulation"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-mono font-semibold text-foreground">{order.workOrderNo}</span>
            <span className={cn("inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium border", statusColor)}>
              {statusLabel}
            </span>
            {order.hasActiveLabor && (
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success-strong border border-success/20">
                ⏱ İşçilik
              </span>
            )}
          </div>
          <div className="text-sm font-semibold text-foreground">
            {order.plate} — {order.brand} {order.model}
          </div>
          <div className="text-xs text-muted-foreground mt-0.5">
            {order.customerName} {order.technicianName && `· ${order.technicianName}`}
          </div>
          {order.customerComplaint && (
            <p className="text-xs text-muted-foreground mt-1 line-clamp-2">{order.customerComplaint}</p>
          )}
        </div>
        <ChevronRight className="size-5 text-muted-foreground shrink-0 mt-1" />
      </div>

      {order.checklistProgress.total > 0 && (
        <div className="mt-3">
          <div className="flex items-center justify-between text-xs text-muted-foreground mb-1">
            <span>Kontrol listesi</span>
            <span>{order.checklistProgress.completed}/{order.checklistProgress.total}</span>
          </div>
          <div className="h-1.5 bg-muted rounded-full overflow-hidden">
            <div
              className={cn(
                "h-full rounded-full transition-all",
                progressPct === 100 ? "bg-success" : progressPct >= 50 ? "bg-primary" : "bg-warning"
              )}
              style={{ width: `${progressPct}%` }}
            />
          </div>
        </div>
      )}
    </Link>
  )
}
