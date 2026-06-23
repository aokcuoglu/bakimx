import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Button } from "@/components/ui/button"
import { Wallet, ChevronRight, Info, AlertTriangle, Search, Building2, Filter } from "lucide-react"
import { Input } from "@/components/ui/input"
import { CustomerTypeBadge, CustomerTagBadge } from "@/components/app/customer-badges"
import { formatTRY } from "@/lib/format"
import { calculateOrderTotalsFromMinimal } from "@/lib/totals"
import { cn } from "@/lib/utils"
import { FilterSelect } from "@/components/app/filter-select"

type SP = { q?: string; type?: string }

export default async function CustomerBalancesPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const type = params.type === "corporate" ? "corporate" : params.type === "individual" ? "individual" : ""

  const where: import("@prisma/client").Prisma.CustomerWhereInput = { workshopId: user.workshopId }
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
        where: { order: { status: { notIn: ["cancelled"] } } },
        include: {
          order: {
            select: {
              id: true,
              status: true,
              paymentStatus: true,
              discountAmount: true,
              taxRate: true,
              items: { select: { totalPrice: true, unitPrice: true, quantity: true, type: true } },
            },
          },
        },
      },
      collections: {
        where: { status: "completed" },
        select: { amount: true, paymentDate: true },
        orderBy: { paymentDate: "desc" },
      },
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  })

  type BalanceRow = {
    id: string
    type: string
    firstName: string | null
    lastName: string | null
    fullName: string | null
    companyName: string | null
    phone: string
    tag: string | null
    vehicleCount: number
    ordersCount: number
    grandTotal: number
    paidAmount: number
    remainingAmount: number
    lastPaymentDate: string | null
    lastActivityDate: string | null
  }

  const rows: BalanceRow[] = customers.map((c) => {
    const orders = c.intakes
      .map((i) => i.order)
      .filter((o): o is NonNullable<typeof o> => o != null)

    let grandTotal = 0
    for (const order of orders) {
      const totals = calculateOrderTotalsFromMinimal(order.items, {
        discountAmount: order.discountAmount,
        taxRate: order.taxRate,
      })
      if (totals.hasAnyPrice) grandTotal += totals.grandTotal
    }

    const paidAmount = c.collections.reduce((sum, col) => sum + col.amount, 0)
    const remainingAmount = Math.max(0, grandTotal - paidAmount)
    const lastPaymentDate = c.collections[0]?.paymentDate?.toISOString() || null
    const lastActivityDate = c.intakes[0]?.createdAt?.toISOString() || null

    return {
      id: c.id,
      type: c.type || "individual",
      firstName: c.firstName,
      lastName: c.lastName,
      fullName: c.fullName,
      companyName: c.companyName,
      phone: c.phone,
      tag: c.tag,
      vehicleCount: c._count.vehicles,
      ordersCount: orders.length,
      grandTotal,
      paidAmount,
      remainingAmount,
      lastPaymentDate,
      lastActivityDate,
    }
  })

  const totals = rows.reduce(
    (acc, r) => {
      acc.customers += 1
      acc.grandTotal += r.grandTotal
      acc.paidAmount += r.paidAmount
      acc.remainingAmount += r.remainingAmount
      if (r.remainingAmount > 0) acc.withBalance += 1
      if (r.remainingAmount === 0 && r.grandTotal > 0) acc.settled += 1
      return acc
    },
    { customers: 0, grandTotal: 0, paidAmount: 0, remainingAmount: 0, withBalance: 0, settled: 0 }
  )

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Müşteri Bakiye Özeti">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-muted-foreground">
          <Link href="/dashboard" className="hover:text-foreground">Ana Panel</Link>
          <span className="mx-2">/</span>
          <Link href="/customers" className="hover:text-foreground">Müşteriler</Link>
          <span className="mx-2">/</span>
          <span className="text-foreground font-medium">Bakiye Özeti</span>
        </div>

        <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-foreground">Bakiye Özeti</h2>
            <p className="text-sm text-muted-foreground mt-0.5">
              Tahsilat kayıtlarına dayalı müşteri bakiye görünümü
            </p>
          </div>
          <div className="flex gap-2">
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/cashbox" />}
            >
              <Wallet className="size-4" />
              Kasa
            </Button>
            <Button
              nativeButton={false}
              variant="outline"
              render={<Link href="/customers" />}
            >
              Müşteri Listesi
            </Button>
          </div>
        </div>

        <div className="rounded-lg border border-border bg-muted/60 px-3 py-2 text-xs text-muted-foreground flex items-start gap-2">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>
            Bu ekran operasyonel tahsilat takibi içindir. Resmi muhasebe veya e-fatura/e-arşiv yerine geçmez.
          </span>
        </div>

        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
          <KpiCard label="Müşteri Sayısı" value={totals.customers.toString()} accent="bg-muted text-foreground" />
          <KpiCard label="Toplam İşlem" value={formatTRY(totals.grandTotal)} accent="bg-primary/10 text-primary" />
          <KpiCard label="Tahsil Edilen" value={formatTRY(totals.paidAmount)} accent="bg-success/10 text-success" />
          <KpiCard label="Kalan Bakiye" value={formatTRY(totals.remainingAmount)} accent="bg-destructive/10 text-destructive" />
          <KpiCard label="Açık Bakiye" value={totals.withBalance.toString()} accent="bg-warning/10 text-warning" />
          <KpiCard label="Ödenmiş" value={totals.settled.toString()} accent="bg-success/10 text-success" />
        </div>

        <form action="/customers/balances" method="get" className="flex flex-col sm:flex-row sm:items-center gap-2">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 size-4 text-muted-foreground/70" />
            <Input
              name="q"
              defaultValue={q}
              placeholder="Müşteri adı, telefon veya plaka ara…"
              className="pl-10"
            />
          </div>
          <div className="flex gap-2">
            <FilterSelect
              name="type"
              defaultValue={type}
              placeholder="Tüm Tipler"
              options={[
                { value: "", label: "Tüm Tipler" },
                { value: "individual", label: "Bireysel" },
                { value: "corporate", label: "Kurumsal" },
              ]}
            />
            <Button variant="outline" size="default" type="submit">
              <Filter className="size-4" />
              <span className="hidden sm:inline">Filtrele</span>
            </Button>
          </div>
        </form>

        {rows.length === 0 ? (
          <div className="text-center py-16 text-muted-foreground bg-card border border-dashed border-border rounded-lg">
            <Wallet className="size-12 mx-auto mb-3 text-muted-foreground/50" />
            <p className="text-sm font-medium text-foreground">Sonuç bulunamadı</p>
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
    <div className={cn("rounded-lg border border-border bg-card p-3.5", accent.split(" ")[0])}>
      <p className="text-[11px] font-medium text-muted-foreground uppercase tracking-wider truncate">{label}</p>
      <p className={cn("text-base sm:text-lg font-bold mt-1 truncate", accent.split(" ")[1])}>{value}</p>
    </div>
  )
}

function nameFor(c: { type: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null }) {
  if (c.type === "corporate") return c.companyName || "—"
  return c.fullName || [c.firstName, c.lastName].filter(Boolean).join(" ") || "—"
}

function BalanceStatusBadge({ remaining, grandTotal }: { remaining: number; grandTotal: number }) {
  if (grandTotal <= 0) return <span className="inline-flex items-center h-5 px-2 rounded-full border text-[11px] font-medium bg-muted text-muted-foreground border-border">Pasif</span>
  if (remaining > 0) return <span className="inline-flex items-center gap-1 h-5 px-2 rounded-full border text-[11px] font-medium bg-destructive/10 text-destructive border-destructive/20"><AlertTriangle className="size-3" /> Alacak</span>
  return <span className="inline-flex items-center h-5 px-2 rounded-full border text-[11px] font-medium bg-success/10 text-success border-success/20">Ödendi</span>
}

function DesktopBalanceTable({ rows }: { rows: Array<{ id: string; type: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; phone: string; tag: string | null; vehicleCount: number; ordersCount: number; grandTotal: number; paidAmount: number; remainingAmount: number; lastPaymentDate: string | null; lastActivityDate: string | null }> }) {
  return (
    <div className="hidden lg:block rounded-lg border border-border bg-card overflow-hidden">
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-muted border-b border-border text-muted-foreground text-xs uppercase tracking-wider">
            <tr>
              <th className="px-4 py-3 text-left font-semibold">Müşteri</th>
              <th className="px-4 py-3 text-left font-semibold">Telefon</th>
              <th className="px-4 py-3 text-right font-semibold">İş Emri</th>
              <th className="px-4 py-3 text-right font-semibold">Toplam</th>
              <th className="px-4 py-3 text-right font-semibold">Tahsil Edilen</th>
              <th className="px-4 py-3 text-right font-semibold">Kalan Bakiye</th>
              <th className="px-4 py-3 text-left font-semibold">Son Tahsilat</th>
              <th className="px-4 py-3 text-left font-semibold">Durum</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {rows.map((row) => (
              <tr key={row.id} className="hover:bg-muted/60 transition-colors">
                <td className="px-4 py-3">
                  <Link href={`/customers/${row.id}`} className="flex items-center gap-2.5 min-w-0 hover:text-primary">
                    <div className="size-8 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-xs font-semibold shrink-0">
                      {row.type === "corporate" ? <Building2 className="size-4" /> : nameFor(row).slice(0, 2).toUpperCase()}
                    </div>
                    <div className="min-w-0">
                      <p className="text-sm font-semibold text-foreground truncate">{nameFor(row)}</p>
                      <div className="flex items-center gap-1.5 mt-0.5">
                        <CustomerTypeBadge type={row.type || "individual"} />
                        {row.tag ? <CustomerTagBadge tag={row.tag} /> : null}
                      </div>
                    </div>
                  </Link>
                </td>
                <td className="px-4 py-3 text-foreground whitespace-nowrap">
                  <a href={`tel:${row.phone}`} className="hover:text-primary">{row.phone}</a>
                </td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">{row.ordersCount}</td>
                <td className="px-4 py-3 text-right text-foreground tabular-nums">
                  {row.grandTotal > 0 ? formatTRY(row.grandTotal) : <span className="text-muted-foreground/70">—</span>}
                </td>
                <td className="px-4 py-3 text-right text-success tabular-nums">
                  {row.paidAmount > 0 ? formatTRY(row.paidAmount) : <span className="text-muted-foreground/70">—</span>}
                </td>
                <td className={cn("px-4 py-3 text-right font-semibold tabular-nums", row.remainingAmount > 0 ? "text-destructive" : "text-muted-foreground")}>
                  {row.remainingAmount > 0 ? formatTRY(row.remainingAmount) : formatTRY(0)}
                </td>
                <td className="px-4 py-3 text-xs text-muted-foreground whitespace-nowrap">
                  {row.lastPaymentDate ? new Date(row.lastPaymentDate).toLocaleDateString("tr-TR") : "—"}
                </td>
                <td className="px-4 py-3">
                  <BalanceStatusBadge remaining={row.remainingAmount} grandTotal={row.grandTotal} />
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}

function MobileBalanceCards({ rows }: { rows: Array<{ id: string; type: string; firstName: string | null; lastName: string | null; fullName: string | null; companyName: string | null; phone: string; tag: string | null; vehicleCount: number; ordersCount: number; grandTotal: number; paidAmount: number; remainingAmount: number; lastPaymentDate: string | null }> }) {
  return (
    <div className="lg:hidden space-y-2.5">
      {rows.map((row) => (
        <Link
          key={row.id}
          href={`/customers/${row.id}`}
          className="block rounded-lg border border-border bg-card p-3.5 active:bg-muted touch-manipulation"
        >
          <div className="flex items-start gap-3">
            <div className="size-10 rounded-lg bg-muted text-muted-foreground flex items-center justify-center text-sm font-semibold shrink-0">
              {row.type === "corporate" ? <Building2 className="size-4" /> : nameFor(row).slice(0, 2).toUpperCase()}
            </div>
            <div className="min-w-0 flex-1">
              <div className="flex items-center gap-2 flex-wrap">
                <p className="text-sm font-semibold text-foreground truncate">{nameFor(row)}</p>
                <CustomerTypeBadge type={row.type || "individual"} />
              </div>
              <p className="text-xs text-muted-foreground mt-0.5">{row.phone}</p>
            </div>
            <ChevronRight className="size-4 text-muted-foreground/70 shrink-0 mt-1" />
          </div>
          <div className="mt-3 grid grid-cols-2 gap-2 text-[11px]">
            <MiniStat label="İş Emri" value={row.ordersCount.toString()} />
            <MiniStat label="Toplam" value={row.grandTotal > 0 ? formatTRY(row.grandTotal) : "—"} />
            <MiniStat label="Tahsilat" value={row.paidAmount > 0 ? formatTRY(row.paidAmount) : "—"} tone="emerald" />
            <MiniStat
              label="Kalan"
              value={row.remainingAmount > 0 ? formatTRY(row.remainingAmount) : formatTRY(0)}
              tone={row.remainingAmount > 0 ? "rose" : "slate"}
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
      ? "text-success"
      : tone === "rose"
      ? "text-destructive"
      : "text-foreground"
  return (
    <div className="rounded-lg bg-muted px-2 py-1.5">
      <p className="text-muted-foreground">{label}</p>
      <p className={cn("text-sm font-semibold tabular-nums truncate", color)}>{value}</p>
    </div>
  )
}