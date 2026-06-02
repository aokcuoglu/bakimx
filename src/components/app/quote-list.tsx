"use client"

import Link from "next/link"
import { Eye, ChevronRight } from "lucide-react"
import { QuoteStatusBadge } from "@/components/app/quote-status-badge"
import { PlateBadge } from "@/components/app/status-badge"
import { formatTRY } from "@/lib/format"
import { customerDisplayName } from "@/lib/format"
import { cn } from "@/lib/utils"

type QuoteRow = {
  id: string
  quoteNo: string
  status: string
  title: string | null
  customerRequest: string | null
  validUntil: string | null
  grandTotal: number | null
  createdAt: string
  customer: { id: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; type: string; phone: string }
  vehicle: { id: string; plate: string; brand: string; model: string } | null
  items: Array<{ id: string; type: string; quantity: number; unitPrice: number | null; totalPrice: number | null }>
  convertedServiceOrder: { id: string; workOrderNo: string | null } | null
}

type StatusCounts = Record<string, number>

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", { day: "2-digit", month: "2-digit", year: "numeric" })
}

export function QuoteList({ quotes, counts, activeStatus, search }: { quotes: QuoteRow[]; counts: StatusCounts; activeStatus: string; search: string }) {
  const statusConfig = [
    { key: "draft", label: "Taslak", color: "bg-slate-50 text-slate-600 border-slate-200" },
    { key: "sent", label: "Gönderildi", color: "bg-blue-50 text-blue-600 border-blue-200" },
    { key: "accepted", label: "Kabul Edildi", color: "bg-emerald-50 text-emerald-600 border-emerald-200" },
    { key: "rejected", label: "Reddedildi", color: "bg-rose-50 text-rose-600 border-rose-200" },
    { key: "expired", label: "Süresi Doldu", color: "bg-orange-50 text-orange-600 border-orange-200" },
    { key: "converted", label: "İş Emrine Çevrilen", color: "bg-indigo-50 text-indigo-600 border-indigo-200" },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statusConfig.map((cfg) => {
          const isActive = activeStatus === cfg.key
          const href = isActive
            ? `/app/quotes${search ? `?q=${search}` : ""}`
            : `/app/quotes?status=${cfg.key}${search ? `&q=${search}` : ""}`
          return (
            <Link
              key={cfg.key}
              href={href}
              className={cn(
                "rounded-xl border bg-white p-3 sm:p-4 transition-all hover:shadow-sm touch-manipulation",
                isActive ? "ring-2 ring-blue-500 border-blue-500" : "border-slate-200"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-slate-500 font-medium">{cfg.label}</span>
                <span className={cn("h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold", cfg.color)}>
                  {counts[cfg.key] || 0}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-slate-900">{counts[cfg.key] || 0}</p>
            </Link>
          )
        })}
      </div>

      <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Teklif No</th>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">Plaka / Araç</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
                <th className="px-4 py-3 text-right font-semibold">Tahmini Tutar</th>
                <th className="px-4 py-3 text-left font-semibold">Geçerlilik Tarihi</th>
                <th className="px-4 py-3 text-left font-semibold">Oluşturma Tarihi</th>
                <th className="px-4 py-3 text-right font-semibold">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3 font-mono text-xs font-semibold text-slate-700">
                    {quote.quoteNo}
                  </td>
                  <td className="px-4 py-3">
                    <div className="text-slate-900 font-medium">{customerDisplayName(quote.customer)}</div>
                    <div className="text-xs text-slate-500">{quote.customer.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {quote.vehicle ? (
                      <div className="flex flex-col gap-1.5">
                        <PlateBadge plate={quote.vehicle.plate} />
                        <span className="text-xs text-slate-500">{quote.vehicle.brand} {quote.vehicle.model}</span>
                      </div>
                    ) : (
                      <span className="text-slate-400 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <QuoteStatusBadge status={quote.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-slate-900">
                    {quote.grandTotal != null ? formatTRY(quote.grandTotal) : <span className="text-slate-400 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {quote.validUntil ? formatDate(quote.validUntil) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500">
                    {formatDate(quote.createdAt)}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center justify-end gap-1">
                      <Link
                        href={`/app/quotes/${quote.id}`}
                        className="inline-flex items-center gap-1 h-8 px-2.5 rounded-md text-xs font-medium text-blue-600 hover:bg-blue-50 transition-colors touch-manipulation"
                      >
                        <Eye className="size-3.5" />
                        Görüntüle
                      </Link>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      <div className="lg:hidden space-y-2.5">
        {quotes.map((quote) => (
          <Link
            key={quote.id}
            href={`/app/quotes/${quote.id}`}
            className="block rounded-xl border border-slate-200 bg-white p-3.5 active:bg-slate-50 touch-manipulation hover:border-slate-300 transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-semibold text-slate-500">{quote.quoteNo}</span>
                  {quote.vehicle && <PlateBadge plate={quote.vehicle.plate} />}
                </div>
                <p className="mt-1.5 text-sm font-semibold text-slate-900 truncate">
                  {customerDisplayName(quote.customer)}
                </p>
                {quote.vehicle && (
                  <p className="text-xs text-slate-500 truncate">
                    {quote.vehicle.brand} {quote.vehicle.model}
                  </p>
                )}
              </div>
              <ChevronRight className="size-4 text-slate-400 shrink-0 mt-1" />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <QuoteStatusBadge status={quote.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="text-slate-500">
                {quote.validUntil ? (
                  <>Geçerlilik: <span className="text-slate-700 font-medium">{formatDate(quote.validUntil)}</span></>
                ) : (
                  <span>{formatDate(quote.createdAt)}</span>
                )}
              </div>
              <div className="font-semibold text-slate-900">
                {quote.grandTotal != null ? formatTRY(quote.grandTotal) : <span className="text-slate-400 font-normal">—</span>}
              </div>
            </div>
          </Link>
        ))}
      </div>
    </div>
  )
}
