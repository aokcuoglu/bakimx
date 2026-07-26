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
    <div className="rounded-lg border border-border bg-card overflow-hidden">
      <div className="px-4 py-3 border-b border-border flex items-center justify-between">
        <h3 className="text-sm font-semibold text-foreground flex items-center gap-2">
          <Wallet className="size-4 text-primary" />
          Kasa Özeti
        </h3>
        <Link href="/cashbox" className="text-xs text-primary hover:text-primary/80 font-medium flex items-center gap-1">
          Tümünü Gör <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Bugünkü Tahsilat</span>
          <span className="text-sm font-bold text-success">{formatTRY(data.todayCollected)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-muted-foreground">Açık Alacak</span>
          <span className="text-sm font-bold text-destructive">{formatTRY(data.openReceivable)}</span>
        </div>
        {data.partialPayments > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-muted-foreground flex items-center gap-1.5">
              Kısmi Ödeme
              <AlertTriangle className="size-3.5 text-warning" />
            </span>
            <span className="text-sm font-bold text-warning">{data.partialPayments}</span>
          </div>
        )}
      </div>
      <div className="px-4 py-2.5 bg-muted border-t border-border">
        <Link
          href="/cashbox/payments/new"
          className="text-xs font-medium text-primary hover:text-primary/80 flex items-center justify-center gap-1"
        >
          + Yeni Tahsilat
        </Link>
      </div>
    </div>
  )
}