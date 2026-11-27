"use client"

import Link from "next/link"
import { ChevronRight, Car } from "lucide-react"
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
import { Card, CardContent } from "@/components/ui/card"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
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
// e-santral yazı ölçeği: /dashboard ile aynı başlık/bölüm sınıfları.
import { surface } from "@/components/dashboard/surface"
import { Plate } from "@/components/shared/plate"

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
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <h2 className={surface.heroTitle}>
          {heading}
          <span className={surface.panelMeta}>· {groups.mine.length} iş</span>
        </h2>
        {canSelectTechnician && (
          <Select value={optimisticId ?? undefined} onValueChange={handleTechnicianChange}>
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
        className={cn("space-y-5 sm:space-y-6", isPending && "pointer-events-none")}
      >
        <section aria-labelledby="technician-mine-title" className="space-y-3">
          <h3 id="technician-mine-title" className={surface.panelTitle}>
            İşlerim
            <span className={surface.panelMeta}>({groups.mine.length})</span>
          </h3>
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
            <ItemGroup className="gap-3">
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
        <KioskGroup title="Bugün biten" orders={completedToday} showTechnician />
      </div>
    </div>
  )
}

function KioskGroup({
  title,
  orders,
  showTechnician,
  defaultOpen,
}: {
  title: string
  orders: TechnicianOrderRow[]
  showTechnician?: boolean
  defaultOpen?: boolean
}) {
  if (orders.length === 0) return null
  return (
    <Collapsible defaultOpen={defaultOpen} className="space-y-3">
      <h3>
        <CollapsibleTrigger asChild>
          <Button
            variant="ghost"
            size="row"
            className="w-full justify-between [&[data-state=open]>svg]:rotate-90"
          >
            <span className="flex items-center gap-2">
              {title}
              <Badge variant="secondary" className="tabular-nums">
                {orders.length}
              </Badge>
            </span>
            <ChevronRight aria-hidden="true" className="transition-transform" />
          </Button>
        </CollapsibleTrigger>
      </h3>
      <CollapsibleContent>
        <ItemGroup className="gap-3">
          {orders.map((order) => (
            <OrderCard key={order.id} order={order} showTechnician={showTechnician} />
          ))}
        </ItemGroup>
      </CollapsibleContent>
    </Collapsible>
  )
}

function OrderCard({ order, showTechnician }: { order: TechnicianOrderRow; showTechnician?: boolean }) {
  const { completed, total } = order.checklistProgress
  return (
    <Item asChild className="min-h-11 bg-card">
      <Link href={`/technician/orders/${order.id}`}>
        <ItemContent>
          <ItemHeader className="flex-wrap">
            <Plate plate={order.plate} size="lg" />
            <span className="flex flex-wrap items-center justify-end gap-1.5">
              <StatusBadge status={order.status} size="md" />
              {order.hasActiveLabor && (
                <Badge variant="outline">İşçilik sürüyor</Badge>
              )}
            </span>
          </ItemHeader>
          <ItemTitle className="flex items-center gap-2 text-base font-semibold">
            <Car className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span className="line-clamp-1">
              {order.brand} {order.model}
            </span>
          </ItemTitle>
          {order.customerComplaint && (
            <ItemDescription className="line-clamp-2">{order.customerComplaint}</ItemDescription>
          )}
          {(total > 0 || showTechnician) && (
            <ItemDescription className="flex flex-wrap items-center gap-x-3">
              {total > 0 && (
                <span className="tabular-nums">
                  {completed}/{total} kontrol
                </span>
              )}
              {showTechnician && <span>{order.technicianName ?? "Atanmamış"}</span>}
            </ItemDescription>
          )}
        </ItemContent>
        <ItemActions>
          <ChevronRight className="size-4 text-muted-foreground" aria-hidden="true" />
        </ItemActions>
      </Link>
    </Item>
  )
}
