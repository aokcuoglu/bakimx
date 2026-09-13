import { requireAdminCapability } from "@/lib/admin"
import { getCatalogBrandRows } from "@/app/admin/catalog/data"
import { BrandsList } from "@/app/admin/catalog/brands/brands-list"

export const metadata = { title: "Katalog Markaları · Yönetim" }

export const dynamic = "force-dynamic"

export default async function AdminCatalogBrandsPage() {
  await requireAdminCapability("manageCatalog")
  const brands = await getCatalogBrandRows()

  return <BrandsList brands={brands} />
}
