import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Plus } from "lucide-react"
import { formatTRY } from "@/lib/format"
import { DashPanel, DashRow, surface } from "@/components/dashboard/surface"

export type CashWidgetData = {
  todayCollected: number
  openReceivable: number
  partialPayments: number
}

export function CashWidget({ data }: { data: CashWidgetData }) {
  return (
    <DashPanel title="Kasa" action={{ href: "/cashbox", label: "Tümünü gör" }}>
      <DashRow
        title="Bugünkü tahsilat"
        plain
        end={<span className={`${surface.rowValue} text-success-strong`}>{formatTRY(data.todayCollected)}</span>}
      />
      <DashRow
        title="Açık alacak"
        plain
        end={<span className={`${surface.rowValue} text-destructive-strong`}>{formatTRY(data.openReceivable)}</span>}
      />
      {data.partialPayments > 0 && (
        <DashRow
          title="Kısmi ödeme"
        plain
          end={<span className={`${surface.rowValue} text-warning-strong`}>{data.partialPayments}</span>}
        />
      )}
      <div className={surface.cardFoot}>
        <span />
        <Button variant="default" size="sm" className="rounded-full" asChild>
          <Link href="/cashbox/payments/new"><Plus className="size-4" />Yeni tahsilat</Link>
        </Button>
      </div>
    </DashPanel>
  )
}
