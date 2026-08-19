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
