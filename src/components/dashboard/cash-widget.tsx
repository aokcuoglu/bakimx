import { Button } from "@/components/ui/button"
import Link from "next/link"
import { Wallet, ArrowRight, AlertTriangle } from "lucide-react"
import { formatTRY } from "@/lib/format"

export type CashWidgetData = {
  todayCollected: number
  openReceivable: number
  partialPayments: number
}

export function CashWidget({ data }: { data: CashWidgetData }) {
  return (
    <div className="rounded-xl border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between gap-3">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wallet className="size-4 text-primary" />
          Kasa Özeti
        </h3>
        <Link href="/cashbox" className="text-xs text-primary hover:underline font-medium flex items-center gap-1">
          Tümünü Gör <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Bugünkü Tahsilat</span>
          <span className="text-sm font-semibold tabular-nums text-success-strong">{formatTRY(data.todayCollected)}</span>
        </div>
        <div className="flex items-center justify-between gap-3">
          <span className="text-sm text-muted-foreground">Açık Alacak</span>
          <span className="text-sm font-semibold tabular-nums text-destructive-strong">{formatTRY(data.openReceivable)}</span>
        </div>
        {data.partialPayments > 0 && (
          <div className="flex items-center justify-between gap-3">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              Kısmi Ödeme
              <AlertTriangle className="size-3.5 text-warning-strong" />
            </span>
            <span className="text-sm font-semibold tabular-nums text-warning-strong">{data.partialPayments}</span>
          </div>
        )}
      </div>
      <div className="flex justify-end border-t border-border px-4 py-2">
        <Button variant="secondary" size="sm" asChild>
          <Link href="/cashbox/payments/new">+ Yeni Tahsilat</Link>
        </Button>
      </div>
    </div>
  )
}