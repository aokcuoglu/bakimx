"use client"

import Link from "next/link"
import { ChevronRight, Clock, ListChecks, MessageSquareText, User, UserX } from "lucide-react"
import { useRouter, useSearchParams } from "next/navigation"
import { useState, useTransition } from "react"
import { cn } from "@/lib/utils"
import { TECHNICIAN_ROLES } from "@/lib/constants"
import { TECHNICIAN_PARAM } from "@/lib/technician/selected-technician"
import type { KioskOrderGroups } from "@/lib/technician/kiosk-home"
import type { TechnicianOrderRow } from "@/lib/technician/queries"
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select"
import { Button } from "@/components/ui/button"
import { Badge } from "@/components/ui/badge"
import { Progress } from "@/components/ui/progress"
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import {
  Item,
  ItemActions,
  ItemContent,
  ItemGroup,
  ItemHeader,
} from "@/components/ui/item"
import { StatusBadge } from "@/components/shared/status-badge"
import { TechnicianQuickActions } from "@/components/technician/technician-quick-actions"
// e-santral yazı ölçeği: /dashboard ile aynı başlık/bölüm sınıfları.
import { surface } from "@/components/dashboard/surface"
import { formatTrDayMonthTime, formatTrTime } from "@/lib/format-date"
import { Plate } from "@/components/shared/plate"

// Telefonda tek sütun, masaüstünde iki sütun.
const ORDER_GRID = "gap-3 lg:grid lg:grid-cols-2"

function CountBadge({ count }: { count: number }) {
  return (
    <Badge variant="secondary" className="tabular-nums">
      {count}
    </Badge>
  )
}

type TechnicianInfo = { id: string; fullName: string; role: string }

export function TechnicianKioskHome({
  technicians,
  focusTechnicianId,
  canSelectTechnician,
  greetingName,
  groups,
  completedToday,
}: {
  technicians: TechnicianInfo[]
  focusTechnicianId: string | null
  canSelectTechnician: boolean
  greetingName: string | null
  groups: KioskOrderGroups
  completedToday: TechnicianOrderRow[]
}) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [isPending, startTransition] = useTransition()

  // Seçim URL'de taşınır: sunucu İşlerim'i seçilen teknisyene göre yeniden
  // gruplar. Yerel state yalnız gezinme sürerken seçimi anında göstermek için;
  // sunucudan yeni seçim gelince (geri/ileri) ona hizalanır.
  const [optimisticId, setOptimisticId] = useState(focusTechnicianId)
  const [lastServerId, setLastServerId] = useState(focusTechnicianId)
  if (lastServerId !== focusTechnicianId) {
    setLastServerId(focusTechnicianId)
    setOptimisticId(focusTechnicianId)
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

  // Yönetici kendi adıyla karşılanmaz: başlık seçili teknisyeni gösterir.
  const focusName = technicians.find((t) => t.id === optimisticId)?.fullName
  const heading = canSelectTechnician
    ? (focusName ?? "Teknisyen")
    : greetingName
      ? `Merhaba ${greetingName}`
      : "Merhaba"

  return (
    <div className="space-y-5 sm:space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between lg:justify-end">
        {/* Telefonda sayfa başlığı selamdır; lg+'da başlık PageFrame'dedir (alt
            başlığı aynı selam), burada yalnız CSS ile gizlenir — erişilebilirlik
            ağacında her genişlikte tek h1 kalır. */}
        <h1 className={cn(surface.heroTitle, "lg:hidden")}>
          {heading}
          <span className={surface.panelMeta}>· {groups.mine.length} iş</span>
        </h1>
        {canSelectTechnician && (
          <Select value={optimisticId ?? undefined} onValueChange={handleTechnicianChange}>
            <SelectTrigger aria-label="Teknisyen seç" className="w-full sm:w-64">
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

      {/* Telefon/tablet: büyük kiosk tuşları. lg+'da aynı işlemler sayfa başlığındadır. */}
      <TechnicianQuickActions />

      <div
        aria-busy={isPending}
        className={cn("space-y-5 sm:space-y-6", isPending && "pointer-events-none")}
      >
        <section aria-labelledby="technician-mine-title" className="space-y-3">
          <h2 id="technician-mine-title" className={cn(surface.panelTitle, "flex items-center gap-2 px-3")}>
            İşlerim
            <CountBadge count={groups.mine.length} />
          </h2>
          {groups.mine.length === 0 ? (
            <Card>
              <CardContent className="space-y-1 py-8 text-center">
                <p className="text-base font-semibold text-foreground">Sana atanmış iş yok</p>
                <p className="text-sm text-muted-foreground">
                  {groups.others.length > 0 ? "Atölyedeki diğer işler aşağıda" : "Şu an açık iş yok"}
                </p>
              </CardContent>
            </Card>
          ) : (
            <ItemGroup className={ORDER_GRID}>
              {groups.mine.map((order) => (
                <OrderCard key={order.id} order={order} />
              ))}
            </ItemGroup>
          )}
        </section>

        <KioskGroup
          title="Atölyedeki diğer işler"
          orders={groups.others}
          showTechnician
          defaultOpen={groups.mine.length === 0}
        />
        <KioskGroup title="Taslak" orders={groups.drafts} showTechnician />
        <KioskGroup title="Bugün biten" orders={completedToday} showTechnician showCompletedTime />
      </div>
    </div>
  )
}

function KioskGroup({
  title,
  orders,
  showTechnician,
  showCompletedTime,
  defaultOpen,
}: {
  title: string
  orders: TechnicianOrderRow[]
  showTechnician?: boolean
  showCompletedTime?: boolean
  defaultOpen?: boolean
}) {
  if (orders.length === 0) return null
  return (
    <Collapsible defaultOpen={defaultOpen} className="space-y-3">
      <h2>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="row"
            className="w-full justify-between [&[data-state=open]>svg]:rotate-90"
          >
            <span className={cn(surface.panelTitle, "flex items-center gap-2")}>
              {title}
              <CountBadge count={orders.length} />
            </span>
            <ChevronRight aria-hidden="true" className="transition-transform" />
          </Button>
        </CollapsibleTrigger>
      </h2>
      <CollapsibleContent>
        <ItemGroup className={ORDER_GRID}>
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} showTechnician={showTechnician} showCompletedTime={showCompletedTime} />
          ))}
        </ItemGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}

function OrderCard({
  order,
  showTechnician,
  showCompletedTime,
}: {
  order: TechnicianOrderRow
  showTechnician?: boolean
  showCompletedTime?: boolean
}) {
  const { completed, total } = order.checklistProgress
  const percent = total > 0 ? Math.round((completed / total) * 100) : 0
  return (
    <Item asChild className="min-h-11 flex-nowrap items-stretch bg-card">
      <Link href={`/technician/orders/${order.id}`}>
        <ItemContent className="min-w-0 gap-2">
          <ItemHeader className="flex-wrap">
            <Plate plate={order.plate} size="lg" />
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              <StatusBadge status={order.status} size="md" />
              {order.hasActiveLabor && (
                <Badge variant="outline">İşçilik sürüyor</Badge>
              )}
            </span>
          </ItemHeader>
          {/* line-clamp, kendi display'ini (-webkit-box) ister: flex/ItemTitle ile
              birleşince satır kutusu 10px'e kırpılıyordu. Kırpma yalnız metin
              düğümünde; simge dışarıda, satırlar kutuya sığmayınca küçülmez. */}
          <p className="shrink-0 text-base leading-snug font-semibold text-foreground">
            <span className="line-clamp-1">
              {order.brand} {order.model}
            </span>
          </p>
          {order.customerComplaint && (
            <div className="flex shrink-0 items-start gap-1.5 text-sm leading-normal text-muted-foreground">
              <MessageSquareText className="mt-0.5 size-3.5 shrink-0" aria-hidden="true" />
              <p className="line-clamp-2 min-w-0">{order.customerComplaint}</p>
            </div>
          )}
          <div className="mt-1 flex flex-wrap items-center gap-x-4 gap-y-1.5 border-t border-border pt-2.5 text-sm text-muted-foreground">
            {showTechnician &&
              (order.technicianName ? (
                <span className="flex min-w-0 items-center gap-1.5">
                  <User className="size-4 shrink-0" aria-hidden="true" />
                  <span className="truncate">{order.technicianName}</span>
                </span>
              ) : (
                <span className="flex items-center gap-1.5 font-medium text-warning-strong">
                  <UserX className="size-4 shrink-0" aria-hidden="true" />
                  Usta atanmadı
                </span>
              ))}
            {total > 0 && (
              <span className="flex items-center gap-1.5 tabular-nums">
                <ListChecks className="size-4 shrink-0" aria-hidden="true" />
                {completed}/{total} kontrol
                <Progress value={percent} aria-hidden="true" className="w-12" />
              </span>
            )}
            <span className="ml-auto flex items-center gap-1.5 tabular-nums">
              <Clock className="size-4 shrink-0" aria-hidden="true" />
              {showCompletedTime && order.completedAt
                ? `Bitti ${formatTrTime(order.completedAt)}`
                : `Kabul ${formatTrDayMonthTime(order.createdAt)}`}
            </span>
          </div>
        </ItemContent>
        <ItemActions>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </ItemActions>
      </Link>
    </Item>
  )
}
