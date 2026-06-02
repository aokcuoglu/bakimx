import Link from "next/link"
import { StatusBadge, PlateBadge } from "@/components/app/status-badge"
import { formatTRY } from "@/lib/format"
import type { ActiveWorkOrderRow } from "@/lib/dashboard/queries"
import { Eye, MessageCircle, ChevronRight, Camera, XCircle } from "lucide-react"

function formatDate(iso: string | null): string {
  if (!iso) return "—"
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

function formatTime(iso: string | null): string {
  if (!iso) return ""
  return new Date(iso).toLocaleTimeString("tr-TR", { hour: "2-digit", minute: "2-digit" })
}

function approvalBadge(status: string | null) {
  if (!status) return null
  if (status === "waiting_approval") {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-amber-600 font-medium">
        <MessageCircle className="size-3" />
        Bekliyor
      </span>
    )
  }
  return null
}

function photoBadge(completion: { present: number; required: number }) {
  if (completion.present >= completion.required) {
    return (
      <span className="inline-flex items-center gap-1 text-xs text-emerald-600 font-medium">
        <Camera className="size-3" />
        {completion.present}/{completion.required}
      </span>
    )
  }
  return (
    <span className="inline-flex items-center gap-1 text-xs text-rose-600 font-medium">
      <XCircle className="size-3" />
      {completion.present}/{completion.required}
    </span>
  )
}

export function ActiveOrdersDesktop({ orders }: { orders: ActiveWorkOrderRow[] }) {
  return (
    <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100 bg-slate-50/80">
            <th className="text-left font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">İş No</th>
            <th className="text-left font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">Plaka / Araç</th>
            <th className="text-left font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">Müşteri</th>
            <th className="text-left font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">Durum</th>
            <th className="text-center font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">Onay</th>
            <th className="text-center font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">Fotoğraf</th>
            <th className="text-right font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">Toplam</th>
            <th className="text-left font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">Tahmini Teslim</th>
            <th className="text-right font-semibold text-slate-600 py-3 px-4 text-xs uppercase tracking-wider">İşlem</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {orders.length === 0 ? (
            <tr>
              <td colSpan={9} className="py-12 text-center text-sm text-slate-500">
                Aktif iş emri bulunmuyor.
              </td>
            </tr>
          ) : (
            orders.map((o) => (
              <tr key={o.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-3 px-4">
                  <span className="font-mono text-xs font-semibold text-slate-700">{o.workOrderNo}</span>
                </td>
                <td className="py-3 px-4">
                  <div className="flex items-center gap-2">
                    <PlateBadge plate={o.plate} />
                    <span className="text-xs text-slate-500 hidden xl:inline">
                      {o.brand} {o.model}
                    </span>
                  </div>
                </td>
                <td className="py-3 px-4">
                  <span className="text-sm text-slate-700 truncate block max-w-[140px]">{o.customerName}</span>
                </td>
                <td className="py-3 px-4">
                  <StatusBadge status={o.status} />
                </td>
                <td className="py-3 px-4 text-center">
                  {approvalBadge(o.approvalStatus)}
                </td>
                <td className="py-3 px-4 text-center">
                  {photoBadge(o.photoCompletion)}
                </td>
                <td className="py-3 px-4 text-right">
                  {o.hasPrice ? (
                    <span className="text-sm font-semibold text-slate-800">{formatTRY(o.total)}</span>
                  ) : (
                    <span className="text-xs text-slate-400">—</span>
                  )}
                </td>
                <td className="py-3 px-4">
                  <div className="text-sm text-slate-700">
                    {o.estimatedDeliveryAt ? (
                      <>
                        <span>{formatDate(o.estimatedDeliveryAt)}</span>
                        <br />
                        <span className="text-[11px] text-slate-400">{formatTime(o.estimatedDeliveryAt)}</span>
                      </>
                    ) : (
                      <span className="text-xs text-slate-400">Belirtilmemiş</span>
                    )}
                  </div>
                </td>
                <td className="py-3 px-4 text-right">
                  <div className="flex items-center justify-end gap-1">
                    <Link
                      href={`/app/orders/${o.id}`}
                      className="inline-flex items-center gap-1 h-7 px-2.5 rounded-md bg-slate-100 hover:bg-slate-200 text-xs font-medium text-slate-700 transition-colors touch-manipulation"
                    >
                      <Eye className="size-3" />
                      Görüntüle
                    </Link>
                  </div>
                </td>
              </tr>
            ))
          )}
        </tbody>
      </table>
    </div>
  )
}

export function ActiveOrdersMobile({ orders }: { orders: ActiveWorkOrderRow[] }) {
  return (
    <div className="space-y-2 sm:hidden">
      {orders.length === 0 ? (
        <div className="text-center py-10 bg-white border border-dashed border-slate-200 rounded-xl">
          <p className="text-sm font-medium text-slate-500">Aktif iş emri bulunmuyor.</p>
        </div>
      ) : (
        orders.map((o) => (
          <Link
            key={o.id}
            href={`/app/orders/${o.id}`}
            className="block bg-white border border-slate-200 rounded-xl p-4 hover:border-slate-300 transition-all"
          >
            <div className="flex items-start justify-between mb-2">
              <div>
                <span className="font-mono text-xs font-semibold text-slate-500">{o.workOrderNo}</span>
                <div className="flex items-center gap-2 mt-1">
                  <PlateBadge plate={o.plate} />
                </div>
              </div>
              <ChevronRight className="size-4 text-slate-300 mt-1 shrink-0" />
            </div>
            <p className="text-sm text-slate-700 mb-2">{o.customerName}</p>
            <div className="flex items-center flex-wrap gap-1.5 mb-2">
              <StatusBadge status={o.status} />
              {o.approvalStatus === "waiting_approval" && (
                <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium bg-amber-50 px-2 py-0.5 rounded-full">
                  <MessageCircle className="size-3" />
                  Onay Bekliyor
                </span>
              )}
            </div>
            <div className="flex items-center justify-between text-xs text-slate-500">
              <div className="flex items-center gap-2">
                <span>{photoBadge(o.photoCompletion)}</span>
                {o.estimatedDeliveryAt && (
                  <span>Teslim: {formatDate(o.estimatedDeliveryAt)}</span>
                )}
              </div>
              {o.hasPrice && (
                <span className="font-semibold text-slate-800">{formatTRY(o.total)}</span>
              )}
            </div>
          </Link>
        ))
      )}
    </div>
  )
}

export function ActiveOrdersSection({ orders }: { orders: ActiveWorkOrderRow[] }) {
  return (
    <div>
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-base font-semibold text-slate-900">Aktif İş Emirleri</h3>
        <Link
          href="/app/orders"
          className="text-sm text-blue-600 hover:text-blue-700 font-medium transition-colors"
        >
          Tümünü Gör →
        </Link>
      </div>
      <div className="hidden sm:block">
        <ActiveOrdersDesktop orders={orders} />
      </div>
      <ActiveOrdersMobile orders={orders} />
    </div>
  )
}
