"use server"

import { prisma } from "@/lib/db"
import { requireWritableWorkshop } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { laborItemSchema } from "@/lib/validations/labor"
import { getValidationError } from "@/lib/validations/shared"
import { AuditLogAction } from "@/lib/audit"
import { LABOR_PRESETS, pickNewPresets } from "@/lib/labor/presets"

const CODE_TAKEN = "Bu işçilik kodu zaten kullanılıyor"
const NAME_TAKEN = "Bu isimde bir işçilik zaten var"

/**
 * Prisma tekil kısıt ihlali (P2002) → kullanıcıya anlaşılır mesaj.
 * `meta.target` hangi kısıtın (code mı, name mi) tetiklendiğini taşır;
 * driver'a göre string[] veya string olabilir, ikisi de karşılanır.
 * P2002 DEĞİLSE (başka bir hata) null döner ve çağıran fırlatmaya devam eder.
 * P2002 İSE ama target ne "name" ne "code" içeriyorsa (beklenmedik kısıt),
 * güvenli varsayılan olarak yine CODE_TAKEN döner — bu yol null dönmez.
 */
function uniqueViolationMessage(e: unknown): string | null {
  if (typeof e !== "object" || e === null || !("code" in e) || (e as { code?: string }).code !== "P2002") {
    return null
  }
  const meta = (e as { meta?: { target?: string[] | string } }).meta
  const target = meta?.target
  const targetStr = Array.isArray(target) ? target.join(",") : (target ?? "")
  if (targetStr.includes("name")) return NAME_TAKEN
  if (targetStr.includes("code")) return CODE_TAKEN
  return CODE_TAKEN
}

export async function createLaborItemAction(input: unknown) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const parsed = laborItemSchema.safeParse(input)
  if (!parsed.success) return { error: getValidationError(parsed) }
  const d = parsed.data

  try {
    const item = await prisma.laborCatalogItem.create({
      data: {
        workshopId,
        code: d.code || null,
        name: d.name,
        category: d.category || null,
        defaultPriceKurus: d.defaultPriceKurus ?? null,
        description: d.description || null,
        isActive: d.isActive,
      },
    })
    await AuditLogAction(workshopId, user.id, "LaborCatalogItem", item.id, "labor_item_created")
    revalidatePath("/parts")
    return { success: true as const, id: item.id }
  } catch (e) {
    const message = uniqueViolationMessage(e)
    if (message) return { error: message }
    throw e
  }
}

export async function updateLaborItemAction(id: string, input: unknown) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const existing = await prisma.laborCatalogItem.findFirst({ where: { id, workshopId } })
  if (!existing) return { error: "İşçilik tanımı bulunamadı" }

  const parsed = laborItemSchema.safeParse(input)
  if (!parsed.success) return { error: getValidationError(parsed) }
  const d = parsed.data

  try {
    await prisma.laborCatalogItem.updateMany({
      where: { id, workshopId },
      data: {
        code: d.code || null,
        name: d.name,
        category: d.category || null,
        defaultPriceKurus: d.defaultPriceKurus ?? null,
        description: d.description || null,
        isActive: d.isActive,
      },
    })
    await AuditLogAction(workshopId, user.id, "LaborCatalogItem", id, "labor_item_updated")
    revalidatePath("/parts")
    return { success: true as const }
  } catch (e) {
    const message = uniqueViolationMessage(e)
    if (message) return { error: message }
    throw e
  }
}

export async function deactivateLaborItemAction(id: string) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const existing = await prisma.laborCatalogItem.findFirst({ where: { id, workshopId } })
  if (!existing) return { error: "İşçilik tanımı bulunamadı" }

  await prisma.laborCatalogItem.updateMany({ where: { id, workshopId }, data: { isActive: false } })
  await AuditLogAction(workshopId, user.id, "LaborCatalogItem", id, "labor_item_deactivated")
  revalidatePath("/parts")
  return { success: true as const }
}

export async function deleteLaborItemAction(id: string) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const existing = await prisma.laborCatalogItem.findFirst({ where: { id, workshopId } })
  if (!existing) return { error: "İşçilik tanımı bulunamadı" }

  // Geçmiş iş emri kalemleri ad+fiyat kopyası taşır, FK yoktur → silme güvenli.
  await prisma.laborCatalogItem.deleteMany({ where: { id, workshopId } })
  await AuditLogAction(workshopId, user.id, "LaborCatalogItem", id, "labor_item_deleted")
  revalidatePath("/parts")
  return { success: true as const }
}

/**
 * Seçilen hazır presetleri atölye kataloğuna kopyalar.
 * Atlanan (zaten var olan) kalem sayısı geri döner — sessiz atlama yoktur.
 */
export async function importLaborPresetsAction(names: string[]) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  if (!Array.isArray(names) || names.length === 0) return { error: "Hiç kalem seçilmedi" }

  const selected = LABOR_PRESETS.filter((p) => names.includes(p.name))
  if (selected.length === 0) return { error: "Hiç kalem seçilmedi" }

  const existing = await prisma.laborCatalogItem.findMany({
    where: { workshopId },
    select: { name: true },
  })
  const toAdd = pickNewPresets(selected, existing.map((e) => e.name))

  // `added`, DB'nin gerçekten yazdığı satır sayısıdır (createMany sonucu) — uygulama
  // içi `existing` okuması ile bu yazma arasında başka bir sekme aynı presetleri
  // eş zamanlı eklerse, `skipDuplicates` + [workshopId, name] tekillik kısıtı sayesinde
  // çift kayıt oluşmaz ve `added` bunu doğru yansıtır.
  let added = 0
  if (toAdd.length > 0) {
    const result = await prisma.laborCatalogItem.createMany({
      data: toAdd.map((p) => ({
        workshopId,
        name: p.name,
        category: p.category,
        defaultPriceKurus: p.defaultPriceKurus,
      })),
      skipDuplicates: true,
    })
    added = result.count
    if (added > 0) {
      await AuditLogAction(
        workshopId,
        user.id,
        "LaborCatalogItem",
        workshopId,
        "labor_presets_imported",
        JSON.stringify({ added })
      )
    }
  }

  revalidatePath("/parts")
  return { success: true as const, added, skipped: selected.length - added }
}
