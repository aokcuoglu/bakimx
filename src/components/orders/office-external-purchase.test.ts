import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * #1070 — Ofis iş emri sayfasında "Parça ekle" Dış Alım yolunu da sunar.
 * Yol yalnız sunucunun hesapladığı `canPurchase` (procurement eklentisi +
 * `parts.purchase` yetkisi) doğruysa görünür; kaydı teknisyen ekranıyla aynı
 * `PurchaseFormSheet` / `addPurchaseItemAction` yapar.
 */

const read = (rel: string) => readFileSync(join(import.meta.dir, rel), "utf8")
const grid = read("parts-labor-grid.tsx")
const panel = read("order-management-panel.tsx")
const detail = read("work-order-detail.tsx")
const page = readFileSync(join(process.cwd(), "src/app/(app)/orders/[id]/page.tsx"), "utf8")

describe("ofis Dış Alım parça (#1070)", () => {
  test("sayfa canPurchase'ı eklenti + yetkiden hesaplar, tedarikçileri yalnız o zaman yükler", () => {
    expect(page).toContain('enabledFeatures.includes("procurement") && actorCan(user, "parts.purchase")')
    expect(page).toMatch(/canPurchase\s*\?\s*await prisma\.supplier\.findMany/)
    expect(page).toContain("workshopId")
    expect(page).toContain("canPurchase={canPurchase}")
  })

  test("detay, yetki yoksa satın alma bağlamını null geçer", () => {
    expect(detail).toMatch(/purchaseContext: PurchaseAddContext \| null = canPurchase\s*\?/)
    expect(detail).toContain("purchase={purchaseContext}")
  })

  test("Parça ekle diyaloğunda Stok / Dış Alım geçişi yalnız satın alma bağlamı varken çizilir", () => {
    expect(grid).toContain("const canAddPurchase = purchase != null && orderId != null && vehicle != null && !locked")
    expect(grid).toContain("canAddPurchase && (")
    expect(grid).toContain("options={PART_MODE_OPTIONS}")
    expect(grid).toContain('setAddingType("dis_alim")')
  })

  test("Dış Alım formu teknisyenle ortak PurchaseFormSheet'tir ve odağı açana döndürür", () => {
    const sheet = grid.slice(grid.indexOf('addingType === "dis_alim" && ('))
    expect(sheet).toContain("<PurchaseFormSheet")
    expect(sheet).toContain("onCloseAutoFocus={onAddDialogCloseAutoFocus}")
    // Geçişte kapanan ekleme diyaloğu tek kullanımlık açıcıyı tüketmez.
    expect(grid).toMatch(/if \(addingType === "dis_alim"\) \{ event\.preventDefault\(\); return \}/)
  })

  test("+ menüsünde 'Dış alım parça' öğesi satın alma bağlamına kapılıdır", () => {
    expect(panel).toContain("const canAddPurchase = purchase != null && vehicle != null")
    const item = panel.slice(panel.indexOf("canAddPurchase && ("), panel.lastIndexOf("Dış alım parça") + 20)
    expect(item).toContain('onAddingTypeChange("dis_alim")')
  })
})
