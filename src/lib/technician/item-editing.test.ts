import { test, expect } from "bun:test"
import { readFileSync } from "node:fs"
import {
  ORDER_ITEM_PERMISSION,
  canEditOrderItems,
  technicianItemEditorMode,
} from "./item-editing"
import { ROLE_PERMISSIONS } from "@/lib/roles"

test("kalem düzenleyicinin izni iş emri düzenleme iznidir", () => {
  // Yeni bir izin adı UYDURULMADI (BAK-141): sunucu kapısı zaten
  // `requireWritableWorkshop("order.edit")`. İkisi ayrışırsa UI, sunucunun
  // reddedeceği bir kutu gösterir.
  expect(ORDER_ITEM_PERMISSION).toBe("order.edit")
})

test("saha rollerinden yalnız usta/staff kalem yazabilir, çırak yazamaz", () => {
  expect(canEditOrderItems("usta")).toBe(true)
  expect(canEditOrderItems("staff")).toBe(true)
  expect(canEditOrderItems("manager")).toBe(true)
  expect(canEditOrderItems("owner")).toBe(true)
  // #183: çırak bilinçli olarak yalnız `parts.purchase` taşır — talep açar,
  // kalem yazmaz. BAK-141 bu kararı GEVŞETMEZ.
  expect(canEditOrderItems("cirak")).toBe(false)
  expect(ROLE_PERMISSIONS.cirak).not.toContain("order.edit")
})

test("izin yoksa mod talep-yalnız, varsa düzenleyici", () => {
  expect(technicianItemEditorMode(false)).toBe("request-only")
  expect(technicianItemEditorMode(true)).toBe("editor")
})

test("teknisyen bölümü ofis düzenleyicisini paylaşır, kopyasını yazmaz", () => {
  // BAK-141 kabul kriteri: "kod tekrarı değil, paylaşılan/ortak komponent".
  // Kaynak taraması, ileride birinin bölümü sessizce kendi tablosuyla
  // değiştirmesini `bun test` seviyesinde yakalar.
  const source = readFileSync(
    "src/components/technician/technician-parts-labor-section.tsx",
    "utf8"
  )
  expect(source).toContain('from "@/components/orders/parts-labor-grid"')
  expect(source).toContain("<PartsLaborGrid")
})

test("iş ekranı ekleme yüzeyini ve araç çubuğunu seçer; ofis varsayılanı değişmez", () => {
  const section = readFileSync("src/components/technician/technician-parts-labor-section.tsx", "utf8")
  expect(section).toContain("hideAddToolbar")
  expect(section).toContain('addSurface={isMobile ? "sheet" : "dialog"}')

  const grid = readFileSync("src/components/orders/parts-labor-grid.tsx", "utf8")
  // Ofis çağrı yerleri hiçbir şey vermez: varsayılan merkez pencere kalır.
  expect(grid).toContain('addSurface = "dialog"')
  expect(grid).toContain("hideAddToolbar = false")
})

test("dış parça / dış işçilik iş ekranında telefonda alt sayfa, lg'de diyalog (#1061)", () => {
  // Parça/işçilik eklemeyle aynı sözleşme: yüzeyi çağıran seçer, formlar varsayılan
  // olarak diyalogdur (ofis `purchase-detail-dialog` bir diyaloğun içinden açar).
  const sheets = readFileSync("src/components/technician/work-screen/work-sheets.tsx", "utf8")
  expect(sheets).toContain('const surface = isMobile ? "sheet" : "dialog"')
  expect(sheets.match(/surface=\{surface\}/g)?.length).toBe(2)

  for (const path of [
    "src/components/technician/purchase-form-sheet.tsx",
    "src/components/technician/external-labor-sheet.tsx",
  ]) {
    const form = readFileSync(path, "utf8")
    expect(form).toContain('surface = "dialog"')
    expect(form).toContain("<FormSurface")
    expect(form).not.toContain('from "@/components/ui/dialog"')
  }
})
