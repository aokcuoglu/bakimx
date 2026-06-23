"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Wrench, Clock, CheckCircle2, Truck, AlertTriangle,
  ChevronRight,
} from "lucide-react"
import { TECHNICIAN_ROLES, ORDER_STATUS } from "@/lib/constants"
import { useState } from "react"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"

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
  technicianName: string | null
  checklistProgress: { completed: number; total: number }
  hasActiveLabor: boolean
}

export function TechnicianDashboard({
  technicians,
  selectedTechnicianId,
  stats,
  orders,
}: {
  technicians: TechnicianInfo[]
  selectedTechnicianId: string
  stats: DashboardStats
  orders: OrderRow[]
}) {
  const [selectedId, setSelectedId] = useState(selectedTechnicianId)

  const activeOrders = orders.filter((o) =>
    ["in_progress", "approved", "waiting_parts"].includes(o.status)
  )
  const waitingOrders = orders.filter((o) => ["draft", "waiting_approval"].includes(o.status))
  const completedOrders = orders.filter((o) => ["ready_for_delivery", "delivered"].includes(o.status))

  const kpiCards = [
    { label: "Bana Atanan", value: stats.assignedToMe, icon: Wrench, color: "bg-primary/10 text-primary" },
    { label: "Devam Eden", value: stats.inProgress, icon: Clock, color: "bg-warning/10 text-warning" },
    { label: "Bekleyen", value: stats.waiting, icon: AlertTriangle, color: "bg-warning/10 text-warning" },
    { label: "Tamamlanan", value: stats.completed, icon: CheckCircle2, color: "bg-success/10 text-success" },
    { label: "Bugün Teslim", value: stats.todayDelivery, icon: Truck, color: "bg-primary/10 text-primary" },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold text-foreground">Teknisyen Paneli</h2>
          <p className="text-sm text-muted-foreground mt-0.5">İş atamalarınızı ve görevlerinizi yönetin</p>
        </div>
        <Select
          value={selectedId}
          onValueChange={(v) => setSelectedId(v ?? "")}
        >
          <SelectTrigger className="h-11" aria-label="Teknisyen seç">
            <SelectValue placeholder="Teknisyen seç">
              {(value: string | null) => {
                if (!value) return null
                const tech = technicians.find((t) => t.id === value)
                if (!tech) return value
                const roleLabel = (TECHNICIAN_ROLES as Record<string, { label: string }>)[tech.role]?.label || tech.role
                return `${tech.fullName} — ${roleLabel}`
              }}
            </SelectValue>
          </SelectTrigger>
          <SelectContent>
            {technicians.map((t) => (
              <SelectItem key={t.id} value={t.id}>
                {t.fullName} — {(TECHNICIAN_ROLES as Record<string, { label: string }>)[t.role]?.label || t.role}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-5 gap-3">
        {kpiCards.map((card) => {
          const Icon = card.icon
          return (
            <div key={card.label} className="rounded-lg border border-border bg-white p-4">
              <div className={cn("inline-flex items-center justify-center size-9 rounded-lg mb-2", card.color)}>
                <Icon className="size-4" />
              </div>
              <p className="text-2xl font-bold text-foreground">{card.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5">{card.label}</p>
            </div>
          )
        })}
      </div>

      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">Aktif İşler</h3>
        {activeOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Aktif iş bulunmuyor</div>
        ) : (
          <div className="space-y-2">
            {activeOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">Bekleyen İşler</h3>
        {waitingOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Bekleyen iş bulunmuyor</div>
        ) : (
          <div className="space-y-2">
            {waitingOrders.map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>

      <section>
        <h3 className="text-base font-semibold text-foreground mb-3">Son Tamamlananlar</h3>
        {completedOrders.length === 0 ? (
          <div className="text-center py-8 text-muted-foreground text-sm">Tamamlanan iş bulunmuyor</div>
        ) : (
          <div className="space-y-2">
            {completedOrders.slice(0, 5).map((order) => (
              <OrderCard key={order.id} order={order} />
            ))}
          </div>
        )}
      </section>
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
              <span className="inline-flex items-center px-2 py-0.5 rounded-full text-[11px] font-medium bg-success/10 text-success border border-success/20">
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
        <ChevronRight className="size-5 text-muted-foreground/70 shrink-0 mt-1" />
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