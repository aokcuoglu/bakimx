"use client"

import Link from "next/link"
import { cn } from "@/lib/utils"
import {
  Clock, CheckCircle2, Truck, AlertTriangle,
  ChevronRight, Car, User,
} from "lucide-react"
import { TECHNICIAN_ROLES } from "@/lib/constants"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { TECHNICIAN_PARAM } from "@/lib/technician/selected-technician"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { Card, CardContent } from "@/components/ui/card"
import { Label } from "@/components/ui/label"
import { Switch } from "@/components/ui/switch"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemDescription,
  ItemGroup,
  ItemHeader,
  ItemTitle,
} from "@/components/ui/item"
import { StatusBadge } from "@/components/shared/status-badge"
import { TechnicianQuickActions } from "@/components/technician/technician-quick-actions"
// e-santral yazı ölçeği: /dashboard ile aynı başlık/KPI/bölüm sınıfları.
import { DashPlate, surface } from "@/components/dashboard/surface"
import { DashboardPagination, useDashboardPage } from "@/components/dashboard/dashboard-pagination"

type DashboardFilter = "all" | "in_progress" | "waiting" | "completed" | "today_delivery"

const DASHBOARD_FILTER_PARAM = "filter"
const ONLY_MINE_PARAM = "mine"

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
  onlyAssignedToMe,
  stats,
  orders,
  recentCompletedOrders,
}: {
  technicians: TechnicianInfo[]
  selectedTechnicianId: string
  canSelectTechnician: boolean
  onlyAssignedToMe: boolean
  stats: DashboardStats
  orders: OrderRow[]
  recentCompletedOrders: OrderRow[]
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
  const activeFilter: DashboardFilter = ["in_progress", "waiting", "completed", "today_delivery"].includes(requestedFilter ?? "")
    ? requestedFilter as DashboardFilter
    : "all"

  function handleFilterChange(filter: DashboardFilter) {
    const params = new URLSearchParams(searchParams.toString())
    if (filter === activeFilter) params.delete(DASHBOARD_FILTER_PARAM)
    else params.set(DASHBOARD_FILTER_PARAM, filter)
    startTransition(() => router.replace(`/technician${params.size ? `?${params.toString()}` : ""}`, { scroll: false }))
  }

  // "Bana atananlar" anahtarı da URL'de taşınır; sunucu KPI'ları ve listeyi
  // buna göre daraltır. Yerel state yalnız gezinme sürerken anında tepki için.
  const [optimisticOnlyMine, setOptimisticOnlyMine] = useState(onlyAssignedToMe)
  const [lastServerOnlyMine, setLastServerOnlyMine] = useState(onlyAssignedToMe)
  if (lastServerOnlyMine !== onlyAssignedToMe) {
    setLastServerOnlyMine(onlyAssignedToMe)
    setOptimisticOnlyMine(onlyAssignedToMe)
  }

  function handleOnlyMineChange(checked: boolean) {
    setOptimisticOnlyMine(checked)
    const params = new URLSearchParams(searchParams.toString())
    if (checked) params.set(ONLY_MINE_PARAM, "1")
    else params.delete(ONLY_MINE_PARAM)
    startTransition(() => router.replace(`/technician${params.size ? `?${params.toString()}` : ""}`, { scroll: false }))
  }

  // Varsayılan görünümdeki listeler, Özet kartlarıyla aynı tanımı kullanır:
  // Aktif = Devam Eden kartı, Bekleyen = Bekleyen kartı (başlamaya hazır ya da
  // parça bekliyor). Taslak / onay bekleyen kabuller "Taslak İşler"de durur.
  const activeOrders = orders.filter((o) => o.status === "in_progress")
  const waitingOrders = orders.filter((o) => ["approved", "waiting_parts"].includes(o.status))
  const draftOrders = orders.filter((o) => ["draft", "waiting_approval"].includes(o.status))
  const { page: completedPage, pageCount: completedPageCount, pageItems: completedPageItems, setPage: setCompletedPage } =
    useDashboardPage(recentCompletedOrders, 10)

  const today = new Date().toLocaleDateString("en-CA")
  // Liste sunucudan zaten kapsamına göre gelir: saha rolünde anahtar kapalıyken
  // atölyenin tamamı, açıkken yalnız kendi atamaları; yöneticide seçili teknisyen.
  const selectedCompletedOrders = orders.filter((o) =>
    o.status === "delivered" && o.completedAt && new Date(o.completedAt).toLocaleDateString("en-CA") === today
  )
  const todayDeliveryOrders = orders.filter((o) =>
    o.estimatedDeliveryAt && new Date(o.estimatedDeliveryAt).toLocaleDateString("en-CA") === today && !["delivered", "cancelled"].includes(o.status)
  )

  const visibleSections = activeFilter === "all"
    ? [
        { title: "Aktif İşler", orders: activeOrders, empty: "Aktif iş bulunmuyor" },
        { title: "Bekleyen İşler", orders: waitingOrders, empty: "Bekleyen iş bulunmuyor" },
        { title: "Taslak İşler", orders: draftOrders, empty: "Taslak iş bulunmuyor", collapsible: true },
        {
          title: "Son Tamamlananlar",
          orders: completedPageItems,
          total: recentCompletedOrders.length,
          empty: "Son 2 günde tamamlanan iş bulunmuyor",
          paginated: true,
        },
      ]
    : activeFilter === "in_progress"
      ? [{ title: "Devam Eden İşler", orders: activeOrders, empty: "Devam eden iş bulunmuyor" }]
      : activeFilter === "waiting"
        ? [{ title: "Bekleyen İşler", orders: waitingOrders, empty: "Bekleyen iş bulunmuyor" }]
        : activeFilter === "completed"
          ? [{ title: "Tamamlanan İşler", orders: selectedCompletedOrders, empty: "Bugün tamamlanan iş bulunmuyor" }]
          : [{ title: "Bugün Teslim Edilecekler", orders: todayDeliveryOrders, empty: "Bugün teslim edilecek iş bulunmuyor" }]

  const kpiCards = [
    { filter: "in_progress" as const, label: "Devam Eden", value: stats.inProgress, icon: Clock, color: "bg-warning/10 text-warning-strong" },
    { filter: "waiting" as const, label: "Bekleyen", value: stats.waiting, icon: AlertTriangle, color: "bg-warning/10 text-warning-strong" },
    { filter: "completed" as const, label: "Tamamlanan", value: stats.completed, icon: CheckCircle2, color: "bg-success/10 text-success-strong" },
    { filter: "today_delivery" as const, label: "Bugün Teslim", value: stats.todayDelivery, icon: Truck, color: "bg-primary/10 text-primary-strong" },
  ]

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h2 className={surface.heroTitle}>Servis Yönetimi</h2>
          {canSelectTechnician && (
            <p className={surface.heroSub}>Seçili teknisyenin iş atamalarını yönetin</p>
          )}
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

      <TechnicianQuickActions />

      <div
        aria-busy={isPending}
        className={cn(
          "space-y-5 sm:space-y-6 transition-opacity",
          isPending && "opacity-60 pointer-events-none"
        )}
      >
        {/* Hızlı işlemlerden (yeni kayıt / sorgu) ayrı bir bölüm: araç kabul filtreleri. */}
        <section aria-labelledby="technician-filters-title" className="space-y-3">
          <div className="space-y-2">
            <h3 id="technician-filters-title" className={surface.panelTitle}>
              Özet
            </h3>
            {!canSelectTechnician && (
              // Rozet görünümlü anahtar: hapın tamamı etikete bağlı, dokunma alanı geniş.
              <Label
                htmlFor="technician-only-mine"
                className={cn(
                  "inline-flex min-h-11 cursor-pointer items-center gap-3 rounded-full py-1.5 pr-2 pl-4 text-base font-medium ring-1 transition-colors",
                  optimisticOnlyMine
                    ? "bg-primary/10 text-primary-strong ring-primary/30"
                    : "bg-card text-foreground ring-foreground/10"
                )}
              >
                Bana atananlar
                <Badge variant={optimisticOnlyMine ? "default" : "secondary"} className="tabular-nums">
                  {stats.assignedToMe}
                </Badge>
                <Switch
                  id="technician-only-mine"
                  checked={optimisticOnlyMine}
                  onCheckedChange={handleOnlyMineChange}
                />
              </Label>
            )}
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
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
                    "h-auto min-w-0 cursor-pointer items-start justify-start rounded-xl bg-card p-3 text-left ring-1 ring-foreground/10 hover:bg-card hover:ring-2 hover:ring-primary",
                    // Hover: beyaz zemin + 2px mavi kenar (saydam bg-primary/5 kartı gri
                    // sayfaya karıştırıp 1px kenarı yutuyordu). Seçili: aynı kenar + ton.
                    activeFilter === card.filter && "bg-primary/10 ring-2 ring-primary hover:bg-primary/10"
                  )}
                >
                  <span className="flex w-full min-w-0 items-center gap-2.5 sm:block">
                    <span className={cn("inline-flex size-8 shrink-0 items-center justify-center rounded-lg sm:mb-2 sm:size-9", card.color)}>
                      <Icon className="size-4" />
                    </span>
                    <span className="min-w-0">
                      {/* Başlık üstte, sayı altta; başlık belirgin (koyu, kalın, büyük).
                          statLabel modül CSS'i katmansız olduğundan boşluk/boyut/renk
                          yalnız !important ile ezilir. */}
                      <span className={cn(surface.statLabel, "mt-0! text-sm! font-semibold text-foreground! sm:text-base!")}>
                        {card.label}
                      </span>
                      <span className={cn(surface.statValue, "mt-0.5 text-2xl! leading-7! sm:text-3xl! sm:leading-9!")}>{card.value}</span>
                    </span>
                  </span>
                </Button>
              )
            })}
          </div>
        </section>

        {visibleSections.map((section) => {
          const count = section.total !== undefined ? section.total : section.orders.length
          const body = (
            <>
              {section.orders.length === 0 ? (
                <Card>
                  <CardContent className="py-8 text-center text-base text-muted-foreground">
                    {section.empty}
                  </CardContent>
                </Card>
              ) : (
                <ItemGroup className="gap-2">
                  {section.orders.map((order) => (
                    <OrderCard key={order.id} order={order} />
                  ))}
                </ItemGroup>
              )}
              {"paginated" in section && section.paginated && completedPageCount > 1 && (
                <div className="rounded-lg border border-border bg-card">
                  <DashboardPagination
                    page={completedPage}
                    pageCount={completedPageCount}
                    onPageChange={setCompletedPage}
                  />
                </div>
              )}
            </>
          )

          // Taslak işler varsayılan olarak kapalı gelir (defaultValue yok);
          // başlıktaki sayı kapalıyken de görünür.
          if ("collapsible" in section && section.collapsible) {
            return (
              <Accordion key={section.title} type="single" collapsible>
                <AccordionItem value="section" className="border-b-0">
                  {/* Kapalıyken de dokunulabilir olduğu belli olsun: kart görünümlü,
                      tam genişlik, 44px+ dokunma alanı, hover/basılı geri bildirimi. */}
                  <AccordionTrigger className="min-h-14 items-center rounded-xl bg-card px-4 py-3 ring-1 ring-foreground/10 transition-colors hover:bg-muted/60 hover:no-underline active:bg-muted **:data-[slot=accordion-trigger-icon]:size-5! **:data-[slot=accordion-trigger-icon]:text-foreground!">
                    <span className={surface.panelTitle}>
                      {section.title}
                      <span className={surface.panelMeta}>({count})</span>
                    </span>
                  </AccordionTrigger>
                  {/* AccordionContent içerikteki linklerin altını çizer ([&_a]:underline);
                      buradaki linkler kart olduğundan bu bölümde kapatılır. */}
                  <AccordionContent className="space-y-3 pt-2 pb-0 [&_a]:no-underline">
                    {body}
                  </AccordionContent>
                </AccordionItem>
              </Accordion>
            )
          }

          return (
            <section key={section.title} className="space-y-3">
              <h3 className={surface.panelTitle}>
                {section.title}
                <span className={surface.panelMeta}>({count})</span>
              </h3>
              {body}
            </section>
          )
        })}
      </div>
    </div>
  )
}

function OrderCard({ order }: { order: OrderRow }) {
  // Kart sade tutulur: durum rozeti, plaka, araç ve müşteri. Kontrol
  // listesi, teknisyen, şikâyet gibi ayrıntılar iş emri detayında.
  return (
    <Item
      variant="outline"
      asChild
      className="cursor-pointer bg-card/80 shadow-xs transition-all hover:bg-muted/60 hover:bg-primary/10 hover:ring-2 hover:ring-primary/20"
    >
      <Link href={`/technician/orders/${order.id}`}>
        <ItemContent>
          {/* Üst satır: büyük e-santral plaka + mavi bant solda,
              durum rozetleri sağda. Dar ekranda rozetler alt satıra sarar. */}
          <ItemHeader className="flex-wrap">
            <DashPlate plate={order.plate} country size="lg" />
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              <StatusBadge status={order.status} size="lg" className="text-sm" />
              {order.hasActiveLabor && (
                <Badge variant="outline" className="h-7 px-3 text-sm border-success/20 bg-success/10 text-success-strong">
                  İşçilik
                </Badge>
              )}
            </span>
          </ItemHeader>
          <ItemTitle className="flex items-center gap-2 text-base font-semibold">
            <Car className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="line-clamp-1">{order.brand} {order.model}</span>
          </ItemTitle>
          <ItemDescription className="flex items-center gap-2">
            <User className="size-4 shrink-0" aria-hidden="true" />
            <span className="line-clamp-1">{order.customerName}</span>
          </ItemDescription>
        </ItemContent>
        <ItemActions>
          <ChevronRight className="size-4 text-muted-foreground" />
        </ItemActions>
      </Link>
    </Item>
  )
}
