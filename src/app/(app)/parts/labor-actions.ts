"use server"

import { prisma } from "@/lib/db"
import { requireWritableFeatureWorkshop } from "@/lib/auth"
import type { Permission } from "@/lib/roles"
import { revalidatePath } from "next/cache"
import { laborItemSchema } from "@/lib/validations/labor"
import { getValidationError } from "@/lib/validations/shared"
import { AuditLogAction } from "@/lib/audit"
import { LABOR_PRESETS, pickNewPresets } from "@/lib/labor/presets"

function requireWritableWorkshop(permission: Permission) {
  return requireWritableFeatureWorkshop(permission, "partsInventory")
}

const CODE_TAKEN = "Bu işçilik kodu zaten kullanılıyor"
const NAME_TAKEN = "Bu isimde bir işçilik zaten var"

/**
 * P2002 sonrası hangi tekil kısıtın ihlal edildiğini SAF biçimde belirler.
 * `codeProvided`: kullanıcı code alanına bir şey yazdı mı (boşsa code kısıtı
 * zaten ihlal edilemez — PostgreSQL'de birden çok NULL serbesttir).
 * `codeConflict` / `nameConflict`: DB'de aynı workshop'ta aynı code/name'e
 * sahip BAŞKA bir kayıt bulundu mu (çağıran belirler, bkz. uniqueViolationMessage).
 * `async` olması yalnızca bu dosyanın "use server" kısıtı yüzündendir
 * (tüm export'lar async olmalı) — fonksiyonun kendisi yan etkisizdir.
 */
export async function resolveLaborUniqueMessage(params: {
  codeProvided: boolean
  codeConflict: boolean
  nameConflict: boolean
}): Promise<string> {
  const { codeProvided, codeConflict, nameConflict } = params
  if (codeProvided && codeConflict) return CODE_TAKEN
  if (nameConflict) return NAME_TAKEN
  // P2002 fırladı ama code boş/uyuşmuyor ve name de eşleşmedi (yarış durumu —
  // ihlal eden satır sorgu ile aynı anda silinmiş/değişmiş olabilir). code boşken
  // code kısıtı hiç ihlal edilemeyeceğinden, güvenli varsayılan yine ad çakışmasıdır.
  return NAME_TAKEN
}

/**
 * Prisma tekil kısıt ihlali (P2002) → kullanıcıya anlaşılır mesaj.
 * ÖNCE `meta.target`'a bakar (driver'a göre string[] veya string olabilir);
 * yalnızca "code" ya da yalnızca "name" içeren NET bir sinyal varsa hızlı yoldan
 * döner. Ancak bu kurulumda (Prisma + kullanılan sürücü) `meta.target` genelde
 * boş/undefined gelir — bu durumda hangi kısıtın gerçekten ihlal edildiğini
 * DB'ye sorup deterministik biçimde belirler (workshopId ile kapılı, güncellemede
 * kaydın kendisi `excludeId` ile hariç tutulur). Sabit bir "güvenli varsayılan"
 * YOKTUR: eskiden target belirsizken hep CODE_TAKEN dönülüyordu, bu code alanı
 * boş bırakılıp yalnızca ad çakıştığında YANLIŞ mesaj veriyordu.
 * P2002 DEĞİLSE (başka bir hata) null döner ve çağıran fırlatmaya devam eder.
 */
async function uniqueViolationMessage(
  e: unknown,
  ctx: { workshopId: string; code: string | null; name: string; excludeId?: string }
): Promise<string | null> {
  if (typeof e !== "object" || e === null || !("code" in e) || (e as { code?: string }).code !== "P2002") {
    return null
  }
  const meta = (e as { meta?: { target?: string[] | string } }).meta
  const target = meta?.target
  const targetStr = Array.isArray(target) ? target.join(",") : (target ?? "")
  const targetHasCode = targetStr.includes("code")
  const targetHasName = targetStr.includes("name")
  if (targetHasCode && !targetHasName) return CODE_TAKEN
  if (targetHasName && !targetHasCode) return NAME_TAKEN

  const excludeClause = ctx.excludeId ? { id: { not: ctx.excludeId } } : {}
  const [codeConflict, nameConflict] = await Promise.all([
    ctx.code
      ? prisma.laborCatalogItem.findFirst({
          where: { workshopId: ctx.workshopId, code: ctx.code, ...excludeClause },
          select: { id: true },
        })
      : Promise.resolve(null),
    prisma.laborCatalogItem.findFirst({
      where: { workshopId: ctx.workshopId, name: ctx.name, ...excludeClause },
      select: { id: true },
    }),
  ])

  return resolveLaborUniqueMessage({
    codeProvided: !!ctx.code,
    codeConflict: !!codeConflict,
    nameConflict: !!nameConflict,
  })
}

export async function createLaborItemAction(input: unknown) {
  const { user } = await requireWritableWorkshop("catalog.manage")
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
    const message = await uniqueViolationMessage(e, { workshopId, code: d.code || null, name: d.name })
    if (message) return { error: message }
    throw e
  }
}

export async function updateLaborItemAction(id: string, input: unknown) {
  const { user } = await requireWritableWorkshop("catalog.manage")
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
    const message = await uniqueViolationMessage(e, { workshopId, code: d.code || null, name: d.name, excludeId: id })
    if (message) return { error: message }
    throw e
  }
}

export async function deactivateLaborItemAction(id: string) {
  const { user } = await requireWritableWorkshop("catalog.manage")
  const workshopId = user.workshopId

  const existing = await prisma.laborCatalogItem.findFirst({ where: { id, workshopId } })
  if (!existing) return { error: "İşçilik tanımı bulunamadı" }

  await prisma.laborCatalogItem.updateMany({ where: { id, workshopId }, data: { isActive: false } })
  await AuditLogAction(workshopId, user.id, "LaborCatalogItem", id, "labor_item_deactivated")
  revalidatePath("/parts")
  return { success: true as const }
}

export async function deleteLaborItemAction(id: string) {
  const { user } = await requireWritableWorkshop("catalog.manage")
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
  const { user } = await requireWritableWorkshop("catalog.manage")
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
