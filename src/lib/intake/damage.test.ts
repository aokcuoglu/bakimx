import { describe, expect, test } from "bun:test"
import type { Prisma } from "@prisma/client"
import { damageDto, validateDamagePhotos } from "./damage"
import { damageMarkSchema, damageInspectionSchema } from "../validations/intake"

describe("damage association validation", () => {
  test("deduplicates IDs and restricts tenant/intake/private/deleted photos", async () => {
    let query: unknown
    const tx = { vehiclePhoto: { count: async (input: unknown) => { query = input; return 1 } } } as unknown as Prisma.TransactionClient
    expect(await validateDamagePhotos(tx, ["p", "p"], "i", "w")).toEqual(["p"])
    expect(query).toEqual({ where: { id: { in: ["p"] }, intakeFormId: "i", workshopId: "w", deletedAt: null, serviceOrderItemId: null } })
  })
  test("rejects even one inaccessible photo before mutating links", async () => {
    const tx = { vehiclePhoto: { count: async () => 1 } } as unknown as Prisma.TransactionClient
    await expect(validateDamagePhotos(tx, ["owned", "foreign"], "i", "w")).rejects.toThrow("Fotoğraf bu kabul kaydına ait değil")
  })
  test("photo-less damage valid and DTO retains persistent number", () => {
    const mark = { id: "d", number: 9, zone: "hood", damageType: "dent", severity: "light", note: null, photos: [] }
    expect(damageMarkSchema.safeParse({ ...mark, note: "", intakeFormId: "i" }).success).toBe(true)
    expect(damageDto(mark).number).toBe(9)
    expect(damageDto(mark).photoIds).toEqual([])
  })
  test("inspection is explicit, validates bodies and never accepts inferred damage-free state", () => {
    expect(damageInspectionSchema.safeParse({ intakeFormId: "i", inspectionStatus: "no_visible_damage", bodyType: "van" }).success).toBe(true)
    expect(damageInspectionSchema.safeParse({ intakeFormId: "i", inspectionStatus: "damage_free" }).success).toBe(false)
    expect(damageInspectionSchema.safeParse({ intakeFormId: "i", bodyType: "motorcycle" }).success).toBe(false)
  })
})
