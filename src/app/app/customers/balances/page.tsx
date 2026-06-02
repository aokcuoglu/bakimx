import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Wallet, ChevronRight, Info, AlertTriangle, Search, Building2 } from "lucide-react"
import { Input } from "@/components/ui/input"
import { CustomerTypeBadge, CustomerTagBadge } from "@/components/app/customer-badges"
import { formatTRY } from "@/lib/format"
import { formatDate } from "@/lib/utils-client"
import { summarizeCustomerOrders } from "@/lib/customer-totals"
import { cn } from "@/lib/utils"
import type { Prisma } from "@prisma/client"

type SP = { q?: string; type?: string }

type BalanceRow = {
  customer: import("@prisma/client").Customer & {
    _count: { vehicles: number }
    vehicles: { id: string; plate: string }[]
    intakes: Array<{
      createdAt: Date
      order: {
        status: import("@prisma/client").OrderStatus
        paymentStatus: import("@prisma/client").PaymentStatus
        items: { totalPrice: number | null; unitPrice: number | null; quantity: number }[]
      } | null
    }>
  }
  balance: ReturnType<typeof summarizeCustomerOrders>
  ordersCount: number
}

export default async function CustomerBalancesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const type = params.type === "corporate" ? "corporate" : params.type === "individual" ? "individual" : ""

  const where: Prisma.CustomerWhereInput = { workshopId: user.workshopId }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { vehicles: { some: { plate: { contains: q, mode: "insensitive" } } } },
    ]
  }
  if (type) where.type = type

  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: { select: { vehicles: true } },
      vehicles: { select: { id: true, plate: true } },
      intakes: {
        orderBy: { createdAt: "desc" },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              items: { select: { totalPrice: true, unitPrice: true, quantity: true } },
            },
          },
        },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  const rows: BalanceRow[] = customers.map((c) => {
    const orders = c.intakes
      .map((i) => i.order)
      .filter((o): o is NonNullable<typeof o> => o != null)
    const orderLike = orders.map((o) => ({
      status: o.status,
      paymentStatus: o.paymentStatus,
      items: o.items,
    }))
    const last = c.intakes[0]?.createdAt || c.createdAt
    const balance = summarizeCustomerOrders(orderLike, last)
    return {
      customer: c,
      balance,
      ordersCount: orders.length,
    }
  })

  const totals = rows.reduce(
    (acc, r) => {
      acc.customers += 1
      acc.workDone += r.balance.workDone
      acc.grandTotal += r.balance.grandTotal
      acc.paid += r.balance.paid
      acc.partial += r.balance.partial
      acc.unpaid += r.balance.unpaid
      acc.remaining += r.balance.remaining
      acc.credit += r.balance.customerCredit
      if (r.balance.hasOverdue) acc.overdue += 1
      return acc
    },
    {
      customers: 0,
      workDone: 0,
      grandTotal: 0,
      paid: 0,
      partial: 0,
      unpaid: 0,
      remaining: 0,
      credit: 0,
      overdue: 0,
    }
  )

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Müşteri Bakiye Özeti">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/app/customers" className="hover:text-slate-700">Müşteriler</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Bakiye Özeti</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Bakiye Özeti</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              İş emri toplamlarına göre temel bakiye görünümü
            </p>
          </div>
          <Link
            href="/app/customers"
            className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
          >
            Müşteri Listesine Dön
          </Link>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500 flex items-start gap-2">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Tahsilat modülü henüz aktif değildir. Bu sayfa iş emri toplamlarına göre ön hazırlık amaçlıdır; gerçek muhasebe verisi göstermez.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <KpiCard label="Müşteri Sayısı" value={totals.customers.toString()} accent="bg-slate-50 text-slate-700" />
          <KpiCard label="Yapılan İş" value={totals.workDone.toString()} accent="bg-blue-50 text-blue-700" />
          <KpiCard label="Bizim Alacağımız" value={formatTRY(totals.remaining)} accent="bg-rose-50 text-rose-700" />
          <KpiCard label="Toplam Tahsilat" value={formatTRY(totals.paid)} accent="bg-emerald-50 text-emerald-700" />
          <KpiCard label="Müşteri Alacağı" value={formatTRY(totals.credit)} accent="bg-amber-50 text-amber-700" />
          <KpiCard label="Geciken Tahsilat" value={totals.overdue.toString()} accent="bg-orange-50 text-orange-700" />
        </div>

        <form action="/app/customers/balances" method="get" className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-slate-400" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Müşteri adı, telefon veya plaka ara…"
              className="pl-10 h-11"
            />
          </div>
          <div className="flex gap-2">
            <select
              name="type"
              defaultValue={type}
              className="h-11 px-3 rounded-lg border border-slate-200 bg-white text-sm text-slate-700 focus:outline-none focus:ring-2 focus:ring-blue-500/30 focus:border-blue-500"
            >
              <option value="">Tüm Tipler</option>
              <option value="individual">Bireysel</option>
              <option value="corporate">Kurumsal</option>
            </select>
            <button
              type="submit"
              className="inline-flex items-center gap-1.5 h-11 px-4 rounded-lg bg-slate-900 hover:bg-slate-800 text-white text-sm font-medium transition-colors touch-manipulation"
            >
              Filtrele
            </button>
          </div>
        </form>

        {rows.length === 0 ? (
          <div className="text-center py-16 text-slate-500 bg-white border border-dashed border-slate-200 rounded-xl">
            <Wallet className="size-12 mx-auto mb-3 text-slate-300" />
            <p className="text-sm font-medium text-slate-700">Sonuç bulunamadı</p>
            <p className="text-xs mt-1">Farklı bir arama veya filtre deneyin</p>
          </div>
        ) : (
          <>
            <DesktopBalanceTable rows={rows} />
            <MobileBalanceCards rows={rows} />
          </>
        )}
      </div>
    </AppShell>
  )
}

function KpiCard({ label, value, accent }: { label: string; value: string; accent: string }) {
  return (
    <div className={cn("rounded-xl border border-slate-200 bg-white p-3.5", accent.split(" ")[0])}>
      <p className="text-[11px] font-medium text-slate-600 uppercase tracking-wider truncate">{label}</p>
      <p className={cn("text-base sm:text-lg font-bold mt-1 truncate", accent.split(" ")[1])}>{value}</p>
    </div>
  )
}

function nameFor(c: { type: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null }) {
  if (c.type === "corporate") return c.companyName || "—"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"
}

function DesktopBalanceTable({
  rows,
}: {
  rows: BalanceRow[]
}) {
  return (
    <div className="hidden lg:block rounded-xl border border-slate-200 bg-white overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 border-b border-slate-200 text-slate-500 text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
              <th className="px-4 py-3 text-left font-semibold">Telefon</th>
              <th className="px-4 py-3 text-left font-semibold">Araç</th>
              <th className="px-4 py-3 text-right font-semibold">İş Emri</th>
              <th className="px-4 py-3 text-right font-semibold">Borç</th>
              <th className="px-4 py-3 text-right font-semibold">Tahsilat</th>
              <th className="px-4 py-3 text-right font-semibold">Bizim Alacak</th>
              <th className="px-4 py-3 text-right font-semibold">Müşteri Alacağı</th>
              <th className="px-4 py-3 text-left font-semibold">Son İşlem</th>
              <th className="px-4 py-3 text-left font-semibold">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map(({ customer, balance }) => {
              const isOverdue = balance.hasOverdue
              const hasActivity = balance.ordersCount > 0
              const status = !hasActivity
                ? { label: "Pasif", color: "bg-slate-50 text-slate-500 border-slate-200" }
                : balance.remaining > 0
                ? { label: "Borçlu", color: "bg-rose-50 text-rose-700 border-rose-200" }
                : balance.grandTotal > 0
                ? { label: "Ödendi", color: "bg-emerald-50 text-emerald-700 border-emerald-200" }
                : { label: "Aktif", color: "bg-blue-50 text-blue-700 border-blue-200" }
              return (
                <tr key={customer.id} className="hover:bg-slate-50/60 transition-colors">
                  <td className="px-4 py-3">
                    <Link
                      href={`/app/customers/${customer.id}`}
                      className="flex items-center gap-2.5 min-w-0 hover:text-blue-600"
                    >
                      <div className="size-8 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-xs font-semibold shrink-0">
                        {customer.type === "corporate" ? <Building2 className="size-4" /> : nameFor(customer).slice(0, 2).toUpperCase()}
                      </div>
                      <div className="min-w-0">
                        <p className="text-sm font-semibold text-slate-900 truncate">{nameFor(customer)}</p>
                        <div className="flex items-center gap-1.5 mt-0.5">
                          <CustomerTypeBadge type={customer.type || "individual"} />
                          {customer.tag ? <CustomerTagBadge tag={customer.tag} /> : null}
                        </div>
                      </div>
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-slate-700 whitespace-nowrap">
                    <a href={`tel:${customer.phone}`} className="hover:text-blue-600">{customer.phone}</a>
                  </td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{customer._count.vehicles}</td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">{balance.ordersCount}</td>
                  <td className="px-4 py-3 text-right text-slate-700 tabular-nums">
                    {balance.grandTotal > 0 ? formatTRY(balance.grandTotal) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-right text-emerald-700 tabular-nums">
                    {balance.paid > 0 ? formatTRY(balance.paid) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", balance.remaining > 0 ? "text-rose-700" : "text-slate-500")}>
                    {balance.remaining > 0 ? formatTRY(balance.remaining) : formatTRY(0)}
                  </td>
                  <td className="px-4 py-3 text-right text-amber-700 tabular-nums">
                    {balance.customerCredit > 0 ? formatTRY(balance.customerCredit) : <span className="text-slate-400">—</span>}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-500 whitespace-nowrap">
                    {balance.lastActivityAt ? formatDate(balance.lastActivityAt) : "—"}
                  </td>
                  <td className="px-4 py-3">
                    <span className={cn("inline-flex items-center h-5 px-2 rounded-full border text-[11px] font-medium", status.color)}>
                      {isOverdue ? <AlertTriangle className="size-3 mr-1" /> : null}
                      {status.label}
                    </span>
                  </td>
                </tr>
              )
            })}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MobileBalanceCards({ rows }: { rows: BalanceRow[] }) {
  return (
    <div className="lg:hidden space-y-2.5">
      {rows.map(({ customer, balance }) => (
        <Link
          key={customer.id}
          href={`/app/customers/${customer.id}`}
          className="block rounded-xl border border-slate-200 bg-white p-3.5 active:bg-slate-50 touch-manipulation"
        >
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-slate-100 text-slate-600 flex items-center justify-center text-sm font-semibold shrink-0">
              {customer.type === "corporate" ? <Building2 className="size-4" /> : nameFor(customer).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-slate-900 truncate">{nameFor(customer)}</p>
                <CustomerTypeBadge type={customer.type || "individual"} />
              </div>
              <p className="text-xs text-slate-500 mt-0.5">{customer.phone}</p>
            </div>
            <ChevronRight className="size-4 text-slate-400 shrink-0 mt-1" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <MiniStat label="İş Emri" value={balance.ordersCount.toString()} />
            <MiniStat label="Toplam" value={balance.grandTotal > 0 ? formatTRY(balance.grandTotal) : "—"} />
            <MiniStat label="Tahsilat" value={balance.paid > 0 ? formatTRY(balance.paid) : "—"} tone="emerald" />
            <MiniStat
              label="Bizim Alacak"
              value={balance.remaining > 0 ? formatTRY(balance.remaining) : formatTRY(0)}
              tone={balance.remaining > 0 ? "rose" : "slate"}
            />
          </div>
        </Link>
      ))}
    </div>
  )
}

function MiniStat({ label, value, tone = "slate" }: { label: string; value: string; tone?: "slate" | "emerald" | "rose" }) {
  const color =
    tone === "emerald"
      ? "text-emerald-700"
      : tone === "rose"
      ? "text-rose-700"
      : "text-slate-700"
  return (
    <div className="rounded-lg bg-slate-50 px-2 py-1.5">
      <p className="text-slate-500">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums truncate", color)}>{value}</p>
    </div>
  )
}
