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
    <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="px-4 py-3 border-b border-slate-100 flex items-center justify-between">
        <h3 className="text-sm font-semibold text-slate-900 flex items-center gap-2">
          <Wallet className="size-4 text-blue-600" />
          Kasa Özeti
        </h3>
        <Link href="/app/cashbox" className="text-xs text-blue-600 hover:text-blue-700 font-medium flex items-center gap-1">
          Tümünü Gör <ArrowRight className="size-3" />
        </Link>
      </div>
      <div className="p-4 space-y-3">
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Bugünkü Tahsilat</span>
          <span className="text-sm font-bold text-emerald-700">{formatTRY(data.todayCollected)}</span>
        </div>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-600">Açık Alacak</span>
          <span className="text-sm font-bold text-rose-700">{formatTRY(data.openReceivable)}</span>
        </div>
        {data.partialPayments > 0 && (
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600 flex items-center gap-1.5">
              Kısmi Ödeme
              <AlertTriangle className="size-3.5 text-amber-500" />
            </span>
            <span className="text-sm font-bold text-amber-700">{data.partialPayments}</span>
          </div>
        )}
      </div>
      <div className="px-4 py-2.5 bg-slate-50 border-t border-slate-100">
        <Link
          href="/app/cashbox/payments/new"
          className="text-xs font-medium text-blue-600 hover:text-blue-700 flex items-center justify-center gap-1"
        >
          + Yeni Tahsilat
        </Link>
      </div>
    </div>
  )
}