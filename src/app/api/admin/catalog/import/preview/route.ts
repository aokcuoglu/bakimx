import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdminCapability } from "@/lib/admin"
import { previewCatalogImport } from "@/lib/catalog/bakimx-import-service"

/**
 * Katalog içe aktarımının ÖN İZLEME ucu (BAK-34). Hiçbir ürüne dokunmaz; yalnız
 * partiyi açar, dosyayı storage'a kopyalar ve "ne olacak" raporunu döner.
 *
 * Route handler (server action değil): server action gövdesi varsayılan 1 MB
 * ile sınırlı, bir fiyat listesi bunun kat kat üstünde olabilir. Yetki kapısı
 * `requireAdminCapability` — reddedilirse `notFound()` fırlatır ve konsolun
 * varlığı ele verilmez.
 */
export async function POST(request: Request) {
  const ctx = await requireAdminCapability("manageCatalog")

  const formData = await request.formData()
  const result = await previewCatalogImport(formData, ctx.user.id)

  // Parti kaydı her durumda yazıldı; geçmiş listesi tazelenmeli.
  revalidatePath("/admin", "layout")

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
