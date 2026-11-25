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
test("sekme geçişi sunucu navigasyonu tetiklemez", () => {
  expect(SOURCE).toContain("window.history.replaceState")
  expect(SOURCE).not.toContain("router.replace(`/orders/${order.id}?tab=")
  expect(SOURCE).toContain("parseOrderTab")
})

/**
 * #860 — sayfa tek sütundur: sekmeler başlığın altında tam genişlikte, müşteri
 * ve araç kaydı her genişlikte Özet'in ilk paneli. Sol kayıt sütunu ve yalnız
 * dar ekranda görünen tutar şeridi geri gelmez.
 */
test("sol kayıt sütunu yok; kayıt Özet'te, tutar şeridi her genişlikte", () => {
  expect(SOURCE).not.toContain("lg:grid-cols-[320px_minmax(0,1fr)]")
  expect(SOURCE).not.toMatch(/<OrderRecordRail[^>]*className=/)
  expect(SOURCE.match(/<OrderRecordRail\b/g)).toHaveLength(1)
  const ozet = SOURCE.slice(SOURCE.indexOf('<TabsContent value="ozet"'), SOURCE.indexOf('<TabsContent value="parca"'))
  expect(ozet).toContain("<OrderRecordRail order={order} customerName={customerName} />")
  expect(SOURCE).not.toMatch(/px-4 py-2\.5 text-sm lg:hidden/)
})

test("Müşteri & Araç paneli Araç Kabul Bilgileri'ni tekrar etmez", () => {
  const RAIL = readFileSync(join(import.meta.dir, "order-record-rail.tsx"), "utf8")
  expect(RAIL).toContain('title="Müşteri & Araç"')
  expect(RAIL).toContain("detail.kvCols")
  for (const label of ["Araç kabulü", "Kabul", "Usta", "Geliş", "Toplam", "Kalan"]) {
    expect(RAIL).not.toContain(`label="${label}"`)
  }
})

test("düzenleme aksiyonu order.edit yetkisine bağlıdır", () => {
  expect(SOURCE).toContain("const canOpenInfoEditor = canEditInfo && !orderLocked")
  // Başlıktaki "Düzenle" ve boş durumdaki "Bilgi ekle" aynı kapıdan geçer.
  expect(SOURCE).toContain("{!editingInfo && canOpenInfoEditor && (")
  expect(SOURCE).toContain("onAdd={canOpenInfoEditor ? startEditInfo : undefined}")
  // ?edit=1 ile gelmek yetkisiz kullanıcıda editörü açmaz.
  expect(SOURCE).toContain("editInitially && !orderLocked && canEditInfo")
  // Yetki sunucudan gelir; istemci varsayılanı kapalıdır.
  expect(SOURCE).toContain("canEditInfo = false")
  expect(PAGE).toContain('canEditInfo={actorCan(user, "order.edit")}')
})

/**
 * #881 — hızlı butonlar başlığın hemen altında durur ve asıl düğmelerle aynı
 * kapıdan geçer: tahsilat kilidi hızlı buton ile "Tahsilat Ekle" arasında tek
 * değişkendir, pencereler kendi bileşenlerinde kalır (yalnız dışarıdan açılır).
 */
test("hızlı butonlar başlığın altında, asıl pencereleri açar", () => {
  const afterHeader = SOURCE.slice(SOURCE.indexOf("actions={headerActions}"))
  expect(afterHeader.indexOf("<OrderQuickActions")).toBeLessThan(afterHeader.indexOf("{error && ("))
  expect(SOURCE).toContain("orderQuickActions({ orderLocked, canCashbox, collectionsLocked })")
  expect(SOURCE).toContain("collectionsLocked={collectionsLocked}")
  expect(SOURCE).toContain("addingType={partsAddType} onAddingTypeChange={setPartsAddType}")
  expect(SOURCE).toContain("onCollectionModalOpenChange={setCollectionModalOpen}")
})
