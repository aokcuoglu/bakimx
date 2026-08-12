import { notFound } from "next/navigation"
import { requireAdminCapability } from "@/lib/admin"
import { prisma } from "@/lib/db"
import { getCatalogBrandOptions, getProductAuditTrail } from "@/app/admin/catalog/data"
import { CatalogProductForm } from "@/app/admin/catalog/product-form"
import { formatCatalogAuditChanges } from "@/lib/catalog/bakimx-catalog"
import { Badge } from "@/components/ui/badge"

export const dynamic = "force-dynamic"

const AUDIT_ACTION_LABELS: Record<string, string> = {
  create: "Oluşturuldu",
  update: "Güncellendi",
  price_change: "Fiyat değişti",
  stock_change: "Stok değişti",
  import_apply: "İçe aktarım",
}

export default async function EditCatalogProductPage(props: { params: Promise<{ id: string }> }) {
  await requireAdminCapability("manageCatalog")
  const { id } = await props.params

  const [product, brands, audit] = await Promise.all([
    prisma.bakimxProduct.findUnique({
      where: { id },
      select: {
        id: true,
        sku: true,
        name: true,
        brandId: true,
        categoryKey: true,
        barcode: true,
        unit: true,
        description: true,
        imageUrl: true,
        oemNumbers: true,
        workshopPriceKurus: true,
        vatRateBps: true,
        costPriceKurus: true,
        stockQty: true,
        lowStockQty: true,
        backorderable: true,
        leadTimeDays: true,
        isActive: true,
      },
    }),
    getCatalogBrandOptions(),
    getProductAuditTrail(id),
  ])

  if (!product) notFound()

  return (
    <div className="space-y-6">
      <CatalogProductForm product={product} brands={brands} />

      <section className="space-y-3">
        <h2 className="text-sm font-semibold text-foreground">Denetim kaydı</h2>
        {audit.length === 0 ? (
          <p className="text-sm text-muted-foreground">Bu ürün için kayıt yok.</p>
        ) : (
          <ul className="space-y-2">
            {audit.map((entry) => (
              <li key={entry.id} className="rounded-lg border bg-card p-3">
                <div className="flex flex-wrap items-center gap-2">
                  <Badge variant="secondary">{AUDIT_ACTION_LABELS[entry.action] ?? entry.action}</Badge>
                  <span className="text-xs text-muted-foreground">
                    {new Date(entry.createdAt).toLocaleString("tr-TR")} · {entry.actorLabel}
                  </span>
                </div>
                <ul className="mt-1.5 space-y-0.5 text-sm text-muted-foreground">
                  {formatCatalogAuditChanges(entry.beforeJson, entry.afterJson).map((line) => (
                    <li key={line}>{line}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  )
}
