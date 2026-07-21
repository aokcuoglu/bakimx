/**
 * Mock ön-tanımlı işçilik kataloğu — BakımX.
 *
 * ŞU AN MOCK: iş emri composer'ında "Katalogdan İşçilik" akışını beslemek için
 * üretilmiş ÖRNEK/demo veridir. Gerçek işçilik tablosu (DB) geldiğinde yalnız
 * `getMockLaborCatalog` gövdesi (veya çağıran katman) değişir; tüketiciler
 * (`PartsLaborGrid` katalog composer'ı) aynı tipe bağlı kalır.
 *
 * Determinizm: statik liste — `Math.random`/`Date.now` KULLANMAZ. Aynı çağrı her
 * zaman aynı sonucu verir (demo tutarlılığı + workflow/script determinizmi).
 *
 * Para birimi: `defaultPriceKurus` her zaman KURUŞ (money.ts kontratı).
 * 1 TL = 100 kuruş. Fiyatlar yalnızca ÖNERİ'dir; kullanıcı satırda değiştirir.
 */

export type LaborCatalogEntry = {
  id: string
  name: string
  /** Bulunabilirlik için gruplama etiketi (yalnız arama/görsel; satıra persist edilmez). */
  category: string
  /** Önerilen birim işçilik ücreti (kuruş). */
  defaultPriceKurus: number
}

// TL cinsinden yazılıp kuruşa çevrilen sabit liste (okunurluk için).
const L = (lira: number) => lira * 100

const CATALOG: readonly LaborCatalogEntry[] = [
  // Bakım
  { id: "lbr-yag-degisim", name: "Motor yağı ve filtre değişimi", category: "Bakım", defaultPriceKurus: L(350) },
  { id: "lbr-periyodik-bakim", name: "Periyodik bakım işçiliği", category: "Bakım", defaultPriceKurus: L(750) },
  { id: "lbr-hava-filtre", name: "Hava filtresi değişimi", category: "Bakım", defaultPriceKurus: L(150) },
  { id: "lbr-polen-filtre", name: "Polen filtresi değişimi", category: "Bakım", defaultPriceKurus: L(200) },
  { id: "lbr-yakit-filtre", name: "Yakıt filtresi değişimi", category: "Bakım", defaultPriceKurus: L(300) },
  // Fren
  { id: "lbr-balata-on", name: "Ön fren balatası değişimi", category: "Fren", defaultPriceKurus: L(400) },
  { id: "lbr-balata-arka", name: "Arka fren balatası değişimi", category: "Fren", defaultPriceKurus: L(450) },
  { id: "lbr-disk-degisim", name: "Fren diski değişimi", category: "Fren", defaultPriceKurus: L(500) },
  { id: "lbr-fren-hava", name: "Fren hidroliği değişimi ve hava alma", category: "Fren", defaultPriceKurus: L(350) },
  // Motor
  { id: "lbr-triger-seti", name: "Triger seti değişimi", category: "Motor", defaultPriceKurus: L(2500) },
  { id: "lbr-devirdaim", name: "Devirdaim (su pompası) değişimi", category: "Motor", defaultPriceKurus: L(900) },
  { id: "lbr-buji-degisim", name: "Buji değişimi", category: "Motor", defaultPriceKurus: L(350) },
  { id: "lbr-enjektor-temizlik", name: "Enjektör temizliği", category: "Motor", defaultPriceKurus: L(600) },
  { id: "lbr-kayis-degisim", name: "V kayışı / gergi rulmanı değişimi", category: "Motor", defaultPriceKurus: L(450) },
  // Elektrik
  { id: "lbr-aku-degisim", name: "Akü değişimi ve kontrolü", category: "Elektrik", defaultPriceKurus: L(150) },
  { id: "lbr-alternator", name: "Alternatör / marş sökme takma", category: "Elektrik", defaultPriceKurus: L(700) },
  { id: "lbr-far-ayar", name: "Far ayarı ve ampul değişimi", category: "Elektrik", defaultPriceKurus: L(200) },
  // Teşhis
  { id: "lbr-ariza-tespit", name: "Motor arıza tespiti (diagnostik)", category: "Teşhis", defaultPriceKurus: L(400) },
  { id: "lbr-yol-testi", name: "Yol testi ve genel kontrol", category: "Teşhis", defaultPriceKurus: L(250) },
  // Lastik / Balans
  { id: "lbr-lastik-degisim", name: "Lastik sökme takma (4 adet)", category: "Lastik / Balans", defaultPriceKurus: L(300) },
  { id: "lbr-balans", name: "Rot balans ayarı", category: "Lastik / Balans", defaultPriceKurus: L(350) },
  { id: "lbr-rot-ayar", name: "Ön düzen (rot) ayarı", category: "Lastik / Balans", defaultPriceKurus: L(400) },
  // Kaporta / Boya
  { id: "lbr-boya-panel", name: "Panel boyama işçiliği", category: "Kaporta / Boya", defaultPriceKurus: L(1500) },
  { id: "lbr-gocuk-duzeltme", name: "Göçük düzeltme (boyasız)", category: "Kaporta / Boya", defaultPriceKurus: L(800) },
]

/** Ön-tanımlı işçilik kataloğunun tamamını döndürür (statik). */
export function getMockLaborCatalog(): LaborCatalogEntry[] {
  return CATALOG.map((e) => ({ ...e }))
}

/**
 * Türkçe-duyarlı aksansız normalize: küçült + yaygın TR diakritiklerini sadeleştir.
 * Arama eşleşmesini "değişim"↔"degisim", "İşçilik"↔"iscilik" gibi girdilerde toleranslı kılar.
 */
function fold(s: string): string {
  return s
    .toLocaleLowerCase("tr")
    .replaceAll("ı", "i")
    .replaceAll("İ", "i")
    .replaceAll("ş", "s")
    .replaceAll("ğ", "g")
    .replaceAll("ü", "u")
    .replaceAll("ö", "o")
    .replaceAll("ç", "c")
}

/**
 * Ada/kategoriye göre basit alt-dize filtresi (aksansız, case-insensitive).
 * Boş/whitespace sorgu → tüm katalog.
 */
export function searchLaborCatalog(query: string): LaborCatalogEntry[] {
  const q = fold(query.trim())
  const all = getMockLaborCatalog()
  if (!q) return all
  return all.filter((e) => fold(`${e.name} ${e.category}`).includes(q))
}
