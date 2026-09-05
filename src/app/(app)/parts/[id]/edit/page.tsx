import { getAppData } from "@/app/(app)/data"
import { getFeaturePaywall } from "@/lib/feature-page-access"
import { AppShell } from "@/components/layout/app-shell"
import { PartForm } from "@/components/parts/part-form"
import { prisma } from "@/lib/db"
import { getActiveSuppliersForSelect } from "@/lib/suppliers/queries"
import { getWorkshopBrands, getWorkshopCategories } from "@/lib/parts/queries"
import { kurusToLira } from "@/lib/money"
import { notFound } from "next/navigation"

export default async function EditPartPage(props: { params: Promise<{ id: string }> }) {
  const paywall = await getFeaturePaywall("partsInventory")
  if (paywall) return paywall
  const { user, workshop } = await getAppData()
  const { id } = await props.params

  const part = await prisma.partStockItem.findFirst({
    where: { id, workshopId: user.workshopId },
    include: {
      supplierPrices: {
        orderBy: [{ isPreferred: "desc" }, { purchasePrice: "asc" }],
      },
    },
  })

  if (!part) notFound()

  const [suppliers, workshopBrands, workshopCategories] = await Promise.all([
    getActiveSuppliersForSelect(user.workshopId),
    getWorkshopBrands(user.workshopId),
    getWorkshopCategories(user.workshopId),
  ])

  const supplierPrices = part.supplierPrices.map((p) => ({
    supplierId: p.supplierId,
    purchasePrice: kurusToLira(p.purchasePrice),
    supplierSku: p.supplierSku ?? "",
    isPreferred: p.isPreferred,
  }))

  // Satırda geçen ama aktif tedarikçi listesinde olmayan (pasifleştirilmiş) tedarikçileri
  // select'e ekle, aksi halde satır boş görünür.
  const missingIds = supplierPrices.map((p) => p.supplierId).filter((sid) => !suppliers.some((s) => s.id === sid))
  const extraSuppliers = missingIds.length
    ? await prisma.supplier.findMany({
        where: { workshopId: user.workshopId, id: { in: missingIds } },
        select: { id: true, name: true, phone: true },
      })
    : []
  const supplierOptions = [...suppliers, ...extraSuppliers].sort((a, b) => a.name.localeCompare(b.name, "tr"))

  const { supplierPrices: _rawPrices, ...partFields } = part
  const serialized = {
    ...partFields,
    createdAt: part.createdAt.toISOString(),
    updatedAt: part.updatedAt.toISOString(),
  }

  return (
    <AppShell constrained workshopName={workshop?.name} pageTitle={`Düzenle: ${part.name}`}>
      {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
      <PartForm part={serialized as any} suppliers={supplierOptions} workshopBrands={workshopBrands} workshopCategories={workshopCategories} supplierPrices={supplierPrices} />
    </AppShell>
  )
}
