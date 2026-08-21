import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")
const dialog = readFileSync(join(root, "src/components/parts/supplier-price-dialog.tsx"), "utf8")
const route = readFileSync(join(root, "src/app/api/orders/external-procurements/route.ts"), "utf8")
const page = readFileSync(join(root, "src/app/(app)/orders/[id]/page.tsx"), "utf8")
const grid = readFileSync(join(root, "src/components/orders/parts-labor-grid.tsx"), "utf8")
const service = readFileSync(join(root, "src/lib/external-procurement/service.ts"), "utf8")

describe("GetirBakım explicit purchase UX", () => {
  test("requires one selected offer and an explicit binding-price confirmation", () => {
    expect(dialog).toContain("selectedOfferId")
    expect(dialog).toContain("Bağlayıcı toplam")
    expect(dialog).toContain("Bu fiyatla satın almayı onayla")
  })

  test("all PR #86 quote conflicts discard the prior approval and require reconfirmation", () => {
    expect(dialog).toContain('["PRICE_CHANGED", "QUOTE_CHANGED", "QUOTE_EXPIRED"]')
    expect(dialog).toContain("Önceki onayınız kullanılmadı")
    expect(service).toContain("requiresProcurementReconfirmation(error.code)")
  })

  test("server identity, feature gate, tenant scope and no-stock invariant remain authoritative", () => {
    expect(route).toContain('requireWritableWorkshop("parts.purchase")')
    expect(route).toContain('"getirbakimCatalog"')
    expect(route).toContain("serviceOrder: { workshopId: workshop.id }")
    expect(service).toContain("item.partId !== null")
    expect(service).not.toMatch(/partStockItem\.(update|create)|stockMovement\.(update|create)/)
  })

  test("projects pending status immediately and offers cancellation after confirmation", () => {
    expect(page).toContain("externalProcurementItem")
    expect(grid).toContain("Tedarik bekleniyor")
    expect(grid).toContain('procurement.status === "CONFIRMED"')
    expect(grid).toContain("İptal talep et")
  })
})
