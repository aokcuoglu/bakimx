import { getAppData } from "@/app/(app)/data"
import { AppShell } from "@/components/app/app-shell"
import { SuppliersList } from "@/components/app/suppliers-list"
import { prisma } from "@/lib/db"
import { getSupplierKPIs } from "@/lib/suppliers/queries"

export default async function SuppliersPage(props: {
  searchParams?: Promise<{ q?: string; status?: string }>
}) {
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
      { category: { contains: q, mode: "insensitive" } },
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
    category: s.category,
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