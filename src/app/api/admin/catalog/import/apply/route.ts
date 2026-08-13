import { NextResponse } from "next/server"
import { revalidatePath } from "next/cache"
import { requireAdminCapability } from "@/lib/admin"
import { applyCatalogImport } from "@/lib/catalog/bakimx-import-service"

/**
 * Onaylanan içe aktarma partisini YAZAN uç (BAK-34). Ön izlemeyle aynı dosya
 * ikinci kez gönderilir; servis SHA-256 ile eşleşmeyi doğrular, aksi hâlde
 * kullanıcı görmediği bir değişikliği uygulamış olurdu.
 */
export async function POST(request: Request) {
  const ctx = await requireAdminCapability("manageCatalog")

  const formData = await request.formData()
  const importId = String(formData.get("importId") ?? "")
  const result = await applyCatalogImport(importId, formData, ctx.user.id)

  if (result.ok) revalidatePath("/admin", "layout")

  return NextResponse.json(result, { status: result.ok ? 200 : 400 })
}
