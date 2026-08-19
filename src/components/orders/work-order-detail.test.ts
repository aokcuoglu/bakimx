import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const SOURCE = readFileSync(join(import.meta.dir, "work-order-detail.tsx"), "utf8")
const PAGE = readFileSync(
  join(import.meta.dir, "..", "..", "app", "(app)", "orders", "[id]", "page.tsx"),
  "utf8",
)

/**
 * BAK-102 — "Aracı Getiren" / "Aracı Teslim Alacak" bloğu opsiyonel bir alanı
 * gösteriyor ve BOŞKEN DE görünmek zorunda: gizlendiği sürece servis kullanıcısı
 * alanın var olduğunu fark etmiyor (Kızıldağ Oto geri bildirimi). Koşulun geri
 * eklenmesi ne TypeScript'e ne lint'e takılır, bu yüzden sözleşme kaynak
 * üzerinden korunuyor.
 */

test("getiren/teslim alacak bloğu 'yalnız doluysa' koşuluna geri dönmez", () => {
  expect(SOURCE).not.toMatch(/order\.intake\.droppedOffByName\s*\|\|\s*order\.intake\.pickedUpByName/)
  expect(SOURCE).not.toMatch(/\{order\.intake\.droppedOffByName\s*&&/)
  expect(SOURCE).not.toMatch(/\{order\.intake\.pickedUpByName\s*&&/)
})

test("her iki blok da boş durum metniyle render edilir", () => {
  const rendered = [...SOURCE.matchAll(/<HandoverPerson[\s\S]*?\/>/g)].map((m) => m[0])
  expect(rendered).toHaveLength(2)
  expect(rendered[0]).toContain('label="Aracı Getiren"')
  expect(rendered[1]).toContain('label="Aracı Teslim Alacak"')
  for (const block of rendered) {
    expect(block).toMatch(/emptyText="Belirtilmedi[^"]+"/)
  }
})

test("telefon tıklanabilir kalır", () => {
  expect(SOURCE).toContain("href={`tel:${phone}`}")
})

/**
 * Düzenleme aksiyonu (başlıktaki "Düzenle" ve boş bloktaki "Bilgi ekle") yalnız
 * `order.edit` yetkisi olan ve kilitli olmayan emirde görünür. Sunucu kapısı
 * `updateIntakeDetailsAction` içinde; buradaki yalnız görünürlük.
 */
test("düzenleme aksiyonu order.edit yetkisine bağlıdır", () => {
  expect(SOURCE).toContain("const canOpenInfoEditor = canEditInfo && !orderLocked")
  // Başlıktaki "Düzenle" ve boş durumdaki "Bilgi ekle" aynı kapıdan geçer.
  expect(SOURCE).toContain("{!editingInfo && canOpenInfoEditor && (")
  expect(SOURCE).toContain("onAdd={canOpenInfoEditor ? startEditInfo : undefined}")
  // ?edit=1 ile gelmek yetkisiz kullanıcıda editörü açmaz.
  expect(SOURCE).toContain("editInitially && !orderLocked && canEditInfo")
  // Yetki sunucudan gelir; istemci varsayılanı kapalıdır.
  expect(SOURCE).toContain("canEditInfo = false")
  expect(PAGE).toContain('canEditInfo={roleCan(user.role, "order.edit")}')
})
