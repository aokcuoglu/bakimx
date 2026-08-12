import { requireAdminCapability } from "@/lib/admin"
import { CatalogList } from "@/app/admin/catalog/catalog-list"
import { getCatalogBrandOptions, getCatalogProducts, parseCatalogStatus } from "@/app/admin/catalog/data"

export const dynamic = "force-dynamic"

export default async function AdminCatalogPage(props: {
  searchParams?: Promise<{ q?: string; brand?: string; category?: string; status?: string }>
}) {
  // Layout guard'ı action'lara miras kalmıyor; sayfa da kendi yetkisini ayrıca ister.
  await requireAdminCapability("manageCatalog")

  const searchParams = await props.searchParams
  const filters = {
    q: searchParams?.q ?? "",
    brandId: searchParams?.brand ?? "",
    categoryKey: searchParams?.category ?? "",
    status: parseCatalogStatus(searchParams?.status),
  }

  const [{ rows, total, truncated }, brands] = await Promise.all([
    getCatalogProducts(filters),
    getCatalogBrandOptions(),
  ])

  return <CatalogList rows={rows} total={total} truncated={truncated} brands={brands} filters={filters} />
}
