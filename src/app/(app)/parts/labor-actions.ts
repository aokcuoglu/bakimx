"use server"

import { prisma } from "@/lib/db"
import { requireWritableWorkshop } from "@/lib/auth"
import { revalidatePath } from "next/cache"
import { laborItemSchema } from "@/lib/validations/labor"
import { getValidationError } from "@/lib/validations/shared"
import { AuditLogAction } from "@/lib/audit"
import { LABOR_PRESETS, pickNewPresets } from "@/lib/labor/presets"

/** Prisma tekil-kod ihlali (P2002) → kullanıcıya anlaşılır mesaj. */
function isUniqueCodeViolation(e: unknown): boolean {
  return typeof e === "object" && e !== null && "code" in e && (e as { code?: string }).code === "P2002"
}

const CODE_TAKEN = "Bu işçilik kodu zaten kullanılıyor"

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
    if (isUniqueCodeViolation(e)) return { error: CODE_TAKEN }
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
    await prisma.laborCatalogItem.update({
      where: { id },
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
    if (isUniqueCodeViolation(e)) return { error: CODE_TAKEN }
    throw e
  }
}

export async function deactivateLaborItemAction(id: string) {
  const { user } = await requireWritableWorkshop()
  const workshopId = user.workshopId

  const existing = await prisma.laborCatalogItem.findFirst({ where: { id, workshopId } })
  if (!existing) return { error: "İşçilik tanımı bulunamadı" }

  await prisma.laborCatalogItem.update({ where: { id }, data: { isActive: false } })
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
  await prisma.laborCatalogItem.delete({ where: { id } })
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

  if (toAdd.length > 0) {
    await prisma.laborCatalogItem.createMany({
      data: toAdd.map((p) => ({
        workshopId,
        name: p.name,
        category: p.category,
        defaultPriceKurus: p.defaultPriceKurus,
      })),
    })
    await AuditLogAction(
      workshopId,
      user.id,
      "LaborCatalogItem",
      workshopId,
      "labor_presets_imported",
      JSON.stringify({ added: toAdd.length })
    )
  }

  revalidatePath("/parts")
  return { success: true as const, added: toAdd.length, skipped: selected.length - toAdd.length }
}
