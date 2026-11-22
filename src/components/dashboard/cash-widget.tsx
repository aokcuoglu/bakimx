import { formatTRY } from "@/lib/format"
import { DashPanel, DashRow, surface } from "@/components/dashboard/surface"

export type CashWidgetData = {
  todayCollected: number
  openReceivable: number
  partialPayments: number
}

/** Kasanın iki rakamı: bugün giren para ve dışarıda bekleyen alacak. */
export function CashWidget({ data }: { data: CashWidgetData }) {
  return (
    <DashPanel title="Kasa" action={{ href: "/cashbox", label: "Tümünü gör" }}>
      <DashRow
        href="/cashbox/payments"
        plain
        title="Bugünkü tahsilat"
        end={<span className={`${surface.rowValue} text-success-strong`}>{formatTRY(data.todayCollected)}</span>}
      />
      <DashRow
        href="/cashbox/aging"
        plain
        title="Açık alacak"
        sub={data.partialPayments > 0 ? `${data.partialPayments} kısmi ödeme dahil` : undefined}
        end={
          <span className={`${surface.rowValue} ${data.openReceivable > 0 ? "text-destructive-strong" : ""}`}>
            {formatTRY(data.openReceivable)}
          </span>
        }
      />
    </DashPanel>
  )
}
