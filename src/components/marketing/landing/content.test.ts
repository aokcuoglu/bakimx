import { expect, test } from "bun:test"
import { existsSync } from "node:fs"
import { join } from "node:path"
import { DAY_CARDS, FEATURE_TILES, HERO, LANDING_FAQ, MOVE, NAV, PRICE } from "./content"

const PUBLIC = join(import.meta.dir, "..", "..", "..", "..", "public")

test("fiyat metni tek paket ve ek ücret vaadi yok (spec §6.1)", () => {
  expect(PRICE.amount).toBe("₺1.499")
  expect(PRICE.unit).toBe("/ ay, KDV dahil")
  expect(PRICE.monthlyPriceTry).toBe(1499)
  expect(PRICE.subtitle).toBe("Servisinizin günlük işi için gereken her şey dahil. Kademeli paket, gizli ücret yok.")
  expect(PRICE.items[1]).toBe("Ruhsat okuma ile hızlı araç kabul")
  const all = JSON.stringify({ PRICE, LANDING_FAQ })
  expect(all).not.toContain("Ek modül")
  expect(all).not.toContain("bütün özellikler")
})

test("SSS kaynaktaki beş soru, ilk cevap revize", () => {
  expect(LANDING_FAQ.map((item) => item.question)).toEqual([
    "Fiyata neler dahil?",
    "Müşteriye WhatsApp'tan ne gönderiliyor?",
    "Ekibim de kullanabilir mi?",
    "e-Fatura kesebilir miyim?",
    "Hangi cihazlarda çalışır?",
  ])
  expect(LANDING_FAQ[0].answer).toContain("uygulama içinden ayrıca alabilirsiniz")
})

test("kaynak metinler birebir", () => {
  expect(HERO.title).toEqual(["Oto servisinizi", "telefonunuzdan yönetin."])
  expect(HERO.subtitle).toBe("Araç kabul, parça takibi, stok, kasa ve randevu. Hepsi cebinizde.")
  expect(MOVE.steps).toHaveLength(3)
  expect(FEATURE_TILES.map((tile) => tile.title)).toEqual([
    "Araç geçmişi", "Açık hesaplar", "Randevu takvimi", "Bakım hatırlatma", "Stok ve tedarikçiler", "Ekip ve yetkiler",
  ])
  expect(NAV.map((item) => item.id)).toEqual(["nasil", "ozellikler", "fiyat", "sorular"])
})

test("görseller public/landing/esantral altında mevcut", () => {
  for (const card of DAY_CARDS) expect(existsSync(join(PUBLIC, card.img))).toBe(true)
  expect(existsSync(join(PUBLIC, HERO.image.src))).toBe(true)
})
