import Link from "next/link"
import { requireAdminCapability } from "@/lib/admin"
import { getCatalogBrandOptions } from "@/app/admin/catalog/data"
import { CatalogProductForm } from "@/app/admin/catalog/product-form"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function NewCatalogProductPage() {
  await requireAdminCapability("manageCatalog")
  const brands = await getCatalogBrandOptions()

  // Ürün markasız açılamaz (brandId zorunlu FK) — boş durumda kullanıcıyı
  // hataya değil marka ekranına yönlendiriyoruz.
  if (brands.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Yeni Ürün</h1>
        <p className="text-sm text-muted-foreground">
          Ürün eklemeden önce en az bir marka tanımlamalısınız.
        </p>
        <Button nativeButton={false} render={<Link href="/admin/catalog/brands" />}>
          Marka ekle
        </Button>
      </div>
    )
  }

  return <CatalogProductForm brands={brands} />
}
