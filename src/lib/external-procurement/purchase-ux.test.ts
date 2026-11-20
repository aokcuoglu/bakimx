import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")
const dialog = readFileSync(join(root, "src/components/parts/supplier-price-dialog.tsx"), "utf8")
const route = readFileSync(join(root, "src/app/api/orders/external-procurements/route.ts"), "utf8")
const page = readFileSync(join(root, "src/app/(app)/orders/[id]/page.tsx"), "utf8")
const grid = readFileSync(join(root, "src/components/orders/parts-labor-grid.tsx"), "utf8")
const service = readFileSync(join(root, "src/lib/external-procurement/service.ts"), "utf8")
const presentation = readFileSync(join(root, "src/lib/external-procurement/presentation.ts"), "utf8")

describe("GetirBakım explicit purchase UX", () => {
  test("requires one selected offer and an explicit binding-price confirmation", () => {
    expect(dialog).toContain("selectedOfferId")
    expect(dialog).toContain("Bağlayıcı toplam")
    expect(dialog).toContain("Bu fiyatla satın almayı onayla")
  })

  test("shows the v2.0 shipping fee inside the binding total and binds the quoted unit net price", () => {
    expect(dialog).toContain("quote.totals.shippingKurus")
    expect(dialog).toContain("quote.totals.grossKurus")
    expect(dialog).toContain("expectedUnitNetKurus: quote.lines[0].unitNetKurus")
    expect(dialog).not.toContain("policyVersion")
  })

  test("the delivery address comes from the workshop profile, never the request body", () => {
    expect(route).toContain("requireWorkshopShippingAddress(workshop)")
    expect(route).not.toMatch(/shippingAddress: z\./)
  })

  test("all quote conflicts discard the prior approval and require reconfirmation", () => {
    expect(dialog).toContain('["PRICE_CHANGED", "QUOTE_CHANGED", "QUOTE_EXPIRED"]')
    expect(dialog).toContain("Önceki onayınız kullanılmadı")
    expect(dialog).toContain('"OFFER_UNAVAILABLE"')
    expect(dialog).not.toContain("OFFER_EXPIRED")
    expect(service).toContain("requiresProcurementReconfirmation(error.code)")
  })

  test("server identity, feature gate, tenant scope and no-stock invariant remain authoritative", () => {
    expect(route).toContain('requireWritableWorkshop("parts.purchase")')
    expect(route).toContain('assertFeature(workshop, "procurement")')
    expect(route).toContain("serviceOrder: { workshopId: workshop.id }")
    expect(service).toContain("item.partId !== null")
    expect(service).not.toMatch(/partStockItem\.(update|create)|stockMovement\.(update|create)/)
  })

  test("projects status, total with shipping and the contract's cancel options", () => {
    expect(page).toContain("externalProcurementItem")
    expect(page).toContain("procurementShippingKurus(")
    expect(presentation).toContain("Tedarik bekleniyor")
    expect(grid).toContain("procurementStatusLabel(procurement)")
    expect(grid).toContain("İptal talep et")
    expect(grid).toContain("Siparişi iptal et")
    expect(grid).toContain("Durumu güncelle")
  })

  test("no contract 1.0 reservation handling remains", () => {
    for (const source of [dialog, route, grid, service, presentation]) expect(source).not.toContain("RESERVATION_EXPIRED")
  })
})
