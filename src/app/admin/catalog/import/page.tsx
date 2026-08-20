import Link from "next/link"
import { requireAdminCapability } from "@/lib/admin"
import { getCatalogBrandOptions } from "@/app/admin/catalog/data"
import { getCatalogImportHistory } from "@/app/admin/catalog/import/data"
import { CatalogImportWizard } from "@/app/admin/catalog/import/import-wizard"
import { Button } from "@/components/ui/button"

export const dynamic = "force-dynamic"

export default async function CatalogImportPage() {
  // Layout guard'ı action'lara miras kalmıyor; sayfa da kendi yetkisini ayrıca ister.
  await requireAdminCapability("manageCatalog")

  const [brands, history] = await Promise.all([getCatalogBrandOptions(), getCatalogImportHistory()])

  // İçe aktarım marka bazlıdır (ürünün `brandId`'si zorunlu FK) — marka yoksa
  // kullanıcıyı hataya değil marka ekranına yönlendiriyoruz.
  if (brands.length === 0) {
    return (
      <div className="space-y-4">
        <h1 className="text-xl font-bold text-foreground">Ürün İçe Aktarma</h1>
        <p className="text-sm text-muted-foreground">
          İçe aktarma marka bazlıdır. Dosya yüklemeden önce en az bir marka tanımlamalısınız.
        </p>
        <Button asChild>
          <Link href="/admin/catalog/brands">
            Marka ekle
          </Link>
        </Button>
      </div>
    )
  }

  return <CatalogImportWizard brands={brands} history={history} />
}
