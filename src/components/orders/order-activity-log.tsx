"use client"

import { useState } from "react"
import {
  Clock,
  Wrench,
  Package,
  Wallet,
  Activity,
  Pencil,
  Camera,
  AlertTriangle,
  UserCog,
  ChevronDown,
  ChevronUp,
} from "lucide-react"
import { DetailPanel, DetailPill, DetailEmpty, DetailItem, detail, surface } from "./order-detail-surface"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Collapsible, CollapsibleContent, CollapsibleTrigger } from "@/components/ui/collapsible"
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from "@/components/ui/accordion"
import { formatTrTime } from "@/lib/format-date"
import type { ActivityDay } from "@/lib/orders/group-activity"
import { countActivityRows, groupActivity, limitActivityRows, restActivityRows, runTimeRange, summarizeRun } from "@/lib/orders/group-activity"
import type { OrderActivityEntry, ActivityCategory } from "@/lib/orders/activity"

const CATEGORY_ICONS: Record<ActivityCategory, React.ComponentType<{ className?: string }>> = {
  create: Wrench,
  part: Package,
  labor: Wrench,
  payment: Wallet,
  status: Activity,
  meta: Pencil,
  photo: Camera,
  damage: AlertTriangle,
  tech: UserCog,
}

// Tek sayfada Geçmiş son bölüm (#911): ilk 5 kayıt, gerisi "N kaydı daha göster" ile.
// Satır = tek kayıt ya da daraltılmış seri (≥3 ardışık aynı kişi + aynı olay).
const INITIAL_COUNT = 5

function EntryIcon({ category }: { category: ActivityCategory }) {
  const Icon = CATEGORY_ICONS[category] || Clock
  return (
    <span aria-hidden className={cn(surface.tile, surface["tone-neutral"])} data-shape="circle">
      <Icon />
    </span>
  )
}

function entryMeta(entry: OrderActivityEntry): string {
  return `${formatTrTime(entry.at)} · ${entry.actor}`
}

type DayView = ActivityDay<OrderActivityEntry> & { continued?: boolean }

function DayList({ days }: { days: DayView[] }) {
  return days.map((day) => (
    <section key={day.key} className={detail.group} aria-label={day.label}>
      {!day.continued && (
        <div className={detail.groupHead}>
          <h3 className="text-sm font-medium text-foreground">{day.label}</h3>
        </div>
      )}
      {day.rows.map((row) =>
        row.kind === "single" ? (
          <DetailItem
            key={row.entry.id}
            start={<EntryIcon category={row.entry.category} />}
            title={row.entry.label}
            sub={row.entry.detail}
            meta={entryMeta(row.entry)}
          />
        ) : (
          <div key={row.key} className="px-[18px]">
            <Accordion type="single" collapsible>
              <AccordionItem value={row.key}>
                <AccordionTrigger heading={false} className="items-center">
                  <span className="flex min-w-0 flex-1 items-start gap-3.5">
                    <span className={detail.itemStart}>
                      <EntryIcon category={row.entries[0].category} />
                    </span>
                    <span className={detail.itemMain}>
                      <span className={cn(detail.itemTitle, "block")}>{summarizeRun(row.entries)}</span>
                      <span className={cn(detail.itemMeta, "block")}>
                        {runTimeRange(row.entries)} · {row.entries[0].actor}
                      </span>
                    </span>
                  </span>
                </AccordionTrigger>
                <AccordionContent>
                  <div className="ml-4 border-l border-border">
                    {row.entries.map((entry) => (
                      <DetailItem
                        key={entry.id}
                        start={<EntryIcon category={entry.category} />}
                        title={entry.label}
                        sub={entry.detail}
                        meta={entryMeta(entry)}
                      />
                    ))}
                  </div>
                </AccordionContent>
              </AccordionItem>
            </Accordion>
          </div>
        ),
      )}
    </section>
  ))
}

export function OrderActivityLog({ entries }: { entries: OrderActivityEntry[] }) {
  const [expanded, setExpanded] = useState(false)
  const days = groupActivity(entries)
  const totalRows = countActivityRows(days)
  const collapsible = totalRows > INITIAL_COUNT
  const hiddenCount = totalRows - INITIAL_COUNT

  return (
    <DetailPanel
      title="İşlem Geçmişi"
      aside={entries.length > 0 && <DetailPill tone="neutral">{entries.length} kayıt</DetailPill>}
    >
      {entries.length === 0 ? (
        <DetailEmpty>Henüz işlem kaydı yok</DetailEmpty>
      ) : (
        <Collapsible open={expanded} onOpenChange={setExpanded}>
          <DayList days={limitActivityRows(days, INITIAL_COUNT)} />
          {collapsible && (
            <CollapsibleContent>
              <DayList days={restActivityRows(days, INITIAL_COUNT)} />
            </CollapsibleContent>
          )}
          {collapsible && (
            <div className={surface.cardFoot}>
              <CollapsibleTrigger asChild>
                <Button type="button" variant="ghost" className="w-full text-muted-foreground">
                  {expanded ? (
                    <>
                      <ChevronUp className="size-4" /> Daha az göster
                    </>
                  ) : (
                    <>
                      <ChevronDown className="size-4" /> {hiddenCount} kaydı daha göster
                    </>
                  )}
                </Button>
              </CollapsibleTrigger>
            </div>
          )}
        </Collapsible>
      )}
    </DetailPanel>
  )
}
