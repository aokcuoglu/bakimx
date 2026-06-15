import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus, Wallet, FileSpreadsheet, Info } from "lucide-react"
import { CustomerListWithDelete } from "@/components/app/customer-list-with-delete"
import { type CustomerRow } from "@/components/app/customer-list"
import { summarizeCustomerOrders } from "@/lib/customer-totals"
import type { Prisma } from "@prisma/client"

type SP = { q?: string; type?: string; tag?: string; source?: string }

export default async function CustomersPage({ searchParams }: { searchParams: Promise<SP> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const q = (params.q || "").trim()
  const type = (params.type === "individual" || params.type === "corporate") ? params.type : ""
  const tag = (params.tag || "").trim()
  const source = (params.source || "").trim()

  const where: Prisma.CustomerWhereInput = { workshopId: user.workshopId }
  if (q) {
    where.OR = [
      { firstName: { contains: q, mode: "insensitive" } },
      { lastName: { contains: q, mode: "insensitive" } },
      { fullName: { contains: q, mode: "insensitive" } },
      { companyName: { contains: q, mode: "insensitive" } },
      { contactName: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { phone2: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { vehicles: { some: { plate: { contains: q, mode: "insensitive" } } } },
    ]
  }
  if (type) where.type = type as Prisma.EnumCustomerTypeFilter
  if (tag) where.tag = tag as Prisma.EnumCustomerTagNullableFilter
  if (source) where.source = source as Prisma.EnumCustomerSourceNullableFilter

  const customers = await prisma.customer.findMany({
    where,
    include: {
      _count: { select: { vehicles: true } },
      vehicles: { select: { id: true, plate: true } },
      intakes: {
        orderBy: { createdAt: "desc" },
        take: 50,
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
  })

  const rows: CustomerRow[] = customers.map((c) => {
    const orders = c.intakes
      .map((i) => i.order)
      .filter((o): o is NonNullable<typeof o> => o != null)
    const balance = summarizeCustomerOrders(orders, c.createdAt)
    return {
      id: c.id,
      type: c.type || "individual",
      firstName: c.firstName,
      lastName: c.lastName,
      fullName: c.fullName,
      companyName: c.companyName,
      phone: c.phone,
      email: c.email,
      tag: c.tag || null,
      source: c.source || null,
      createdAt: c.createdAt.toISOString(),
      vehiclesCount: c._count.vehicles,
      workOrdersCount: orders.length,
      grandTotal: balance.grandTotal,
      vehiclesPlates: c.vehicles.map((v) => v.plate),
    }
  })

  const now = new Date()
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1)
  const newThisMonth = customers.filter((c) => c.createdAt >= monthStart).length
  const returning = customers.filter((c) => {
    const orders = c.intakes
      .map((i) => i.order)
      .filter((o): o is NonNullable<typeof o> => o != null)
    return orders.length > 1
  }).length

  const customerKpis = {
    total: customers.length,
    newThisMonth,
    returning,
  }

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Müşteriler">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Müşteriler</span>
        </div>
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Müşteriler</h2>
            <p className="text-sm text-slate-500 mt-0.5">
              {rows.length} müşteri{rows.length === 1 ? "" : ""} kayıtlı
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <Link
              href="/app/customers/balances"
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-slate-200 bg-white text-slate-700 hover:bg-slate-50 text-sm font-medium transition-colors touch-manipulation"
            >
              <Wallet className="size-4" />
              Bakiye Özeti
            </Link>
            <button
              type="button"
              disabled
              className="inline-flex items-center gap-1.5 h-10 px-3.5 rounded-lg border border-dashed border-slate-200 bg-white text-slate-400 text-sm font-medium cursor-not-allowed touch-manipulation"
              title="Excel içe aktarma yakında"
            >
              <FileSpreadsheet className="size-4" />
              Excel İçe Aktar
            </button>
            <Link
              href="/app/customers/new"
              className="inline-flex items-center gap-1.5 h-10 px-4 rounded-lg bg-blue-600 hover:bg-blue-700 text-white text-sm font-semibold transition-colors touch-manipulation"
            >
              <Plus className="size-4" />
              Yeni Müşteri
            </Link>
          </div>
        </div>

        <div className="rounded-lg border border-slate-200 bg-slate-50/60 px-3 py-2 text-xs text-slate-500 flex items-start gap-2">
          <Info className="size-3.5 mt-0.5 shrink-0" />
          <span>Excel içe aktarma yakında. Bakiye Özeti sayfası henüz temel düzeydedir ve ödeme/tahsilat modülü aktifleştiğinde gerçek değerlere geçecektir.</span>
        </div>

        <CustomerListWithDelete
          customers={rows}
          initialFilters={{ q, type: type as "" | "individual" | "corporate", tag, source }}
          kpis={customerKpis}
        />
      </div>
    </AppShell>
  )
}
