import { getAppData } from "@/app/app/data"
import { AppShell } from "@/components/app/app-shell"
import { PartsList } from "@/components/app/parts-list"
import { prisma } from "@/lib/db"
import { getPartKPIs } from "@/lib/parts/queries"
import { getUniqueBrandsAction, getUniqueCategoriesAction } from "./actions"

export default async function PartsPage(props: {
  searchParams?: Promise<{ q?: string; status?: string; category?: string; brand?: string }>
}) {
  const { user, workshop } = await getAppData()
  const searchParams = await props.searchParams
  const q = searchParams?.q
  const status = searchParams?.status
  const category = searchParams?.category
  const brand = searchParams?.brand

  const where: Record<string, unknown> = { workshopId: user.workshopId }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { sku: { contains: q, mode: "insensitive" } },
      { oemNo: { contains: q, mode: "insensitive" } },
      { brand: { contains: q, mode: "insensitive" } },
      { category: { contains: q, mode: "insensitive" } },
      { supplierName: { contains: q, mode: "insensitive" } },
      { supplier: { name: { contains: q, mode: "insensitive" } } },
    ]
  }

  let parts = await prisma.partStockItem.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    orderBy: { name: "asc" },
    include: {
      supplier: {
        select: { id: true, name: true },
      },
    },
  })

  if (status && status !== "all") {
    parts = parts.filter((p) => {
      if (status === "in_stock") return p.isActive && p.stockQty > p.criticalStockQty
      if (status === "critical") return p.isActive && p.stockQty > 0 && p.stockQty <= p.criticalStockQty
      if (status === "out_of_stock") return p.isActive && p.stockQty <= 0
      if (status === "inactive") return !p.isActive
      return true
    })
  }

  if (category) {
    parts = parts.filter((p) => p.category === category)
  }

  if (brand) {
    parts = parts.filter((p) => p.brand === brand)
  }

  const [kpis, brands, categories] = await Promise.all([
    getPartKPIs(user.workshopId),
    getUniqueBrandsAction(),
    getUniqueCategoriesAction(),
  ])

  const serialized = parts.map((p) => ({
    ...p,
    supplier: p.supplier ? { id: p.supplier.id, name: p.supplier.name } : null,
    createdAt: p.createdAt.toISOString(),
    updatedAt: p.updatedAt.toISOString(),
  }))

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Stok / Parçalar">
      <PartsList
        parts={serialized}
        kpis={kpis}
        brands={brands}
        categories={categories}
        currentFilters={{ q: q || "", status: status || "all", category: category || "", brand: brand || "" }}
      />
    </AppShell>
  )
}
