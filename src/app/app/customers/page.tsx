import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { prisma } from "@/lib/db"
import Link from "next/link"
import { Plus } from "lucide-react"
import { Button } from "@/components/ui/button"
import { CustomerList } from "@/components/app/customer-list"

export default async function CustomersPage({ searchParams }: { searchParams: Promise<{ q?: string }> }) {
  const { user, workshop } = await getAppData()
  const params = await searchParams
  const query = params.q || ""

  const customers = await prisma.customer.findMany({
    where: {
      workshopId: user.workshopId,
      ...(query
        ? {
            OR: [
              { firstName: { contains: query, mode: "insensitive" } },
              { lastName: { contains: query, mode: "insensitive" } },
              { phone: { contains: query } },
            ],
          }
        : {}),
    },
    include: { _count: { select: { vehicles: true } } },
    orderBy: { createdAt: "desc" },
  })

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Müşteriler">
      <div className="space-y-5 sm:space-y-6">
        <div className="flex items-center text-sm text-slate-500">
          <Link href="/app" className="hover:text-slate-700">Ana Panel</Link>
          <span className="mx-2">/</span>
          <span className="text-slate-700 font-medium">Müşteriler</span>
        </div>
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-xl sm:text-2xl font-bold text-slate-900">Müşteriler</h2>
            <p className="text-sm text-slate-500 mt-0.5">{customers.length} müşteri kayıtlı</p>
          </div>
          <Link href="/app/customers/new">
            <Button size="lg" className="gap-2">
              <Plus className="size-4" />
              Yeni Müşteri
            </Button>
          </Link>
        </div>

        <CustomerList customers={customers} />
      </div>
    </AppShell>
  )
}