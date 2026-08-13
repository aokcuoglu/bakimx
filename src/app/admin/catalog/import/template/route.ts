import { requireAdminCapability } from "@/lib/admin"
import { UTF8_BOM } from "@/lib/catalog/csv-parse"
import { buildImportTemplateCsv, IMPORT_TEMPLATE_FILE_NAME } from "@/lib/catalog/product-import"

/**
 * İndirilebilir şablon `.csv`. BOM olmadan Excel Türkçe harfleri bozar; `sep=;`
 * yönergesi de şablonun içindedir (bkz. buildImportTemplateCsv), böylece dosya
 * TR Excel'de çift tıklamayla doğru kolonlara açılır ve doldurulup aynı ekrandan
 * geri yüklenebilir.
 */
export async function GET() {
  await requireAdminCapability("manageCatalog")

  return new Response(UTF8_BOM + buildImportTemplateCsv(), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${IMPORT_TEMPLATE_FILE_NAME}"`,
      "Cache-Control": "no-store",
    },
  })
}
