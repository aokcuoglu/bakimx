import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { SuppliersList } from "@/components/suppliers/suppliers-list"
import { prisma } from "@/lib/db"
import { getSupplierKPIs } from "@/lib/suppliers/queries"
import { matchingSupplierCategories } from "@/lib/supplier-categories"

export default async function SuppliersPage(props: {
  searchParams?: Promise<{ q?: string; status?: string }>
}) {
  const paywall = await getFeaturePaywall("procurement")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const searchParams = await props.searchParams
  const q = searchParams?.q
  const status = searchParams?.status

  const where: Record<string, unknown> = { workshopId: user.workshopId }

  if (q) {
    where.OR = [
      { name: { contains: q, mode: "insensitive" } },
      { contactPerson: { contains: q, mode: "insensitive" } },
      { phone: { contains: q } },
      { email: { contains: q, mode: "insensitive" } },
      { city: { contains: q, mode: "insensitive" } },
      { district: { contains: q, mode: "insensitive" } },
      // Kategoriler dizi kolon: contains desteklemez → eşleşen kanonik kategorileri hasSome ile ara.
      { categories: { hasSome: matchingSupplierCategories(q) } },
    ]
  }

  const suppliers = await prisma.supplier.findMany({
    where: where as any, // eslint-disable-line @typescript-eslint/no-explicit-any
    orderBy: { name: "asc" },
    include: {
      _count: { select: { parts: true } },
    },
  })

  let filteredSuppliers = suppliers
  if (status && status !== "all") {
    if (status === "active") filteredSuppliers = suppliers.filter((s) => s.isActive)
    else if (status === "passive") filteredSuppliers = suppliers.filter((s) => !s.isActive)
  }

  const kpis = await getSupplierKPIs(user.workshopId)

  const serialized = filteredSuppliers.map((s) => ({
    id: s.id,
    name: s.name,
    contactPerson: s.contactPerson,
    phone: s.phone,
    phone2: s.phone2,
    email: s.email,
    city: s.city,
    district: s.district,
    categories: s.categories,
    isActive: s.isActive,
    partCount: s._count.parts,
    createdAt: s.createdAt.toISOString(),
    updatedAt: s.updatedAt.toISOString(),
  }))

  return (
    <AppShell workshopName={workshop?.name} pageTitle="Tedarikçiler">
      <SuppliersList
        suppliers={serialized}
        kpis={kpis}
        currentFilters={{ q: q || "", status: status || "all" }}
      />
    </AppShell>
  )
}
