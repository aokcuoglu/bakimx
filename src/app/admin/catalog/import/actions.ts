"use server"

import { revalidatePath } from "next/cache"
import { requireAdminCapability } from "@/lib/admin"
import { cancelCatalogImport } from "@/lib/catalog/bakimx-import-service"

/**
 * İçe aktarma ekranının dosya TAŞIMAYAN mutasyonu. Yükleme/uygulama uçları
 * `/api/admin/catalog/import/*` route handler'larıdır (server action gövde
 * sınırı 1 MB; bkz. bakimx-import-service.ts); iptal küçük olduğu için
 * depodaki diğer mutasyonlarla aynı server action kalıbını izler.
 *
 * YETKİ: `/admin/layout.tsx` guard'ı action'lara miras kalmaz — bu çağrı tek
 * gerçek kapıdır (bkz. src/lib/admin.ts).
 */
export async function cancelBakimxCatalogImportAction(
  importId: string,
): Promise<{ ok: true } | { ok: false; error: string }> {
  await requireAdminCapability("manageCatalog")

  const result = await cancelCatalogImport(importId)
  if (result.ok) revalidatePath("/admin", "layout")
  return result
}
