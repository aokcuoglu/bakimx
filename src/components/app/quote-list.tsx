"use client"

import Link from "next/link"
import { QuoteStatusBadge } from "@/components/app/quote-status-badge"
import { PlateBadge } from "@/components/app/status-badge"
import { ActionsMenu, MobileActionsMenu } from "@/components/app/actions-menu"
import { formatTRY, customerDisplayName } from "@/lib/format"
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
    { key: "draft", label: "Taslak", color: "bg-muted text-muted-foreground border-border" },
    { key: "sent", label: "Gönderildi", color: "bg-primary/10 text-primary border-primary/20" },
    { key: "accepted", label: "Kabul Edildi", color: "bg-success/10 text-success border-success/20" },
    { key: "rejected", label: "Reddedildi", color: "bg-destructive/10 text-destructive border-destructive/20" },
    { key: "expired", label: "Süresi Doldu", color: "bg-warning/10 text-warning border-warning/20" },
    { key: "converted", label: "İş Emrine Çevrilen", color: "bg-primary/10 text-primary border-primary/20" },
  ]

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
        {statusConfig.map((cfg) => {
          const isActive = activeStatus === cfg.key
          const href = isActive
            ? `/quotes${search ? `?q=${search}` : ""}`
            : `/quotes?status=${cfg.key}${search ? `&q=${search}` : ""}`
          return (
            <Link
              key={cfg.key}
              href={href}
              className={cn(
                "rounded-lg border bg-card p-3 sm:p-4 transition-all hover:shadow-sm touch-manipulation",
                isActive ? "ring-2 ring-primary border-primary" : "border-border"
              )}
            >
              <div className="flex items-center justify-between">
                <span className="text-xs text-muted-foreground font-medium">{cfg.label}</span>
                <span className={cn("h-6 px-2 inline-flex items-center justify-center rounded-md border text-xs font-semibold", cfg.color)}>
                  {counts[cfg.key] || 0}
                </span>
              </div>
              <p className="mt-1 text-2xl font-bold text-foreground">{counts[cfg.key] || 0}</p>
            </Link>
          )
        })}
      </div>

      <div className="hidden lg:block rounded-lg border border-border bg-card overflow-hidden">
        <div className="overflow-x-auto max-h-[70vh]">
          <table className="w-full text-sm">
            <thead className="bg-muted border-b border-border text-muted-foreground text-xs uppercase tracking-wider sticky top-0 z-10">
              <tr>
                <th className="px-4 py-3 text-left font-semibold">Teklif No</th>
                <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
                <th className="px-4 py-3 text-left font-semibold">Plaka / Araç</th>
                <th className="px-4 py-3 text-left font-semibold">Durum</th>
                <th className="px-4 py-3 text-right font-semibold">Tahmini Tutar</th>
                <th className="px-4 py-3 text-left font-semibold">Geçerlilik Tarihi</th>
                <th className="px-4 py-3 text-left font-semibold">Oluşturma Tarihi</th>
                <th className="px-4 py-3 text-right font-semibold sticky right-0 bg-muted">İşlem</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-border">
              {quotes.map((quote) => (
                <tr key={quote.id} className="hover:bg-muted/60 transition-colors group">
                  <td className="px-4 py-3">
                    <Link
                      href={`/quotes/${quote.id}`}
                      className="font-mono text-xs font-semibold text-foreground hover:text-primary transition-colors"
                    >
                      {quote.quoteNo}
                    </Link>
                  </td>
                  <td className="px-4 py-3">
                    <Link
                      href={`/customers/${quote.customer.id}`}
                      className="text-foreground font-medium hover:text-primary transition-colors"
                    >
                      {customerDisplayName(quote.customer)}
                    </Link>
                    <div className="text-xs text-muted-foreground">{quote.customer.phone}</div>
                  </td>
                  <td className="px-4 py-3">
                    {quote.vehicle ? (
                      <div className="flex flex-col gap-1.5">
                        <Link href={`/vehicles/${quote.vehicle.id}`}>
                          <PlateBadge plate={quote.vehicle.plate} />
                        </Link>
                        <span className="text-xs text-muted-foreground">{quote.vehicle.brand} {quote.vehicle.model}</span>
                      </div>
                    ) : (
                      <span className="text-muted-foreground/70 text-xs">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <QuoteStatusBadge status={quote.status} />
                  </td>
                  <td className="px-4 py-3 text-right font-semibold text-foreground">
                    {quote.grandTotal != null ? formatTRY(quote.grandTotal) : <span className="text-muted-foreground/70 font-normal">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {quote.validUntil ? formatDate(quote.validUntil) : <span className="text-muted-foreground/70">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-muted-foreground">
                    {formatDate(quote.createdAt)}
                  </td>
                  <td className="px-4 py-3 sticky right-0 bg-card group-hover:bg-muted/60">
                    <div className="flex items-center justify-end">
                      <ActionsMenu
                        viewHref={`/quotes/${quote.id}`}
                        editHref={`/quotes/${quote.id}?edit=1`}
                        workOrderHref={quote.vehicle
                          ? `/orders/new?vehicleId=${quote.vehicle.id}&customerId=${quote.customer.id}`
                          : `/orders/new?customerId=${quote.customer.id}`
                        }
                      />
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
          <div
            key={quote.id}
            className="rounded-lg border border-border bg-card p-3.5 hover:border-border transition-colors"
          >
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <Link
                    href={`/quotes/${quote.id}`}
                    className="font-mono text-xs font-semibold text-muted-foreground hover:text-primary transition-colors"
                  >
                    {quote.quoteNo}
                  </Link>
                  {quote.vehicle && (
                    <Link href={`/vehicles/${quote.vehicle.id}`}>
                      <PlateBadge plate={quote.vehicle.plate} />
                    </Link>
                  )}
                </div>
                <Link
                  href={`/customers/${quote.customer.id}`}
                  className="mt-1.5 text-sm font-semibold text-foreground truncate block hover:text-primary transition-colors"
                >
                  {customerDisplayName(quote.customer)}
                </Link>
                {quote.vehicle && (
                  <p className="text-xs text-muted-foreground truncate">
                    {quote.vehicle.brand} {quote.vehicle.model}
                  </p>
                )}
              </div>
              <MobileActionsMenu
                viewHref={`/quotes/${quote.id}`}
                editHref={`/quotes/${quote.id}?edit=1`}
                workOrderHref={quote.vehicle
                  ? `/orders/new?vehicleId=${quote.vehicle.id}&customerId=${quote.customer.id}`
                  : `/orders/new?customerId=${quote.customer.id}`
                }
              />
            </div>
            <div className="mt-3 flex flex-wrap items-center gap-1.5">
              <QuoteStatusBadge status={quote.status} />
            </div>
            <div className="mt-3 flex items-center justify-between text-xs">
              <div className="text-muted-foreground">
                {quote.validUntil ? (
                  <>Geçerlilik: <span className="text-foreground font-medium">{formatDate(quote.validUntil)}</span></>
                ) : (
                  <span>{formatDate(quote.createdAt)}</span>
                )}
              </div>
              <div className="font-semibold text-foreground">
                {quote.grandTotal != null ? formatTRY(quote.grandTotal) : <span className="text-muted-foreground/70 font-normal">—</span>}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  )
}