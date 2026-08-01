/**
 * Hazır işçilik önerileri — BakımX.
 *
 * Bu liste ARTIK RUNTIME KATALOĞU DEĞİLDİR. Yalnız Stok / İşçilikler ekranındaki
 * "Hazır listeden ekle" modalını besler: atölye bu kalemleri kendi kataloğuna
 * kopyalar, sonra fiyatlarını kendine göre düzenler. İş emri ve teklif önerileri
 * her zaman atölyenin KENDİ LaborCatalogItem kayıtlarından gelir.
 *
 * Fiyatlar KURUŞ (money.ts kontratı) ve yalnızca başlangıç önerisidir.
 */

import { foldTr } from "@/lib/labor/search"

export type LaborPreset = {
  name: string
  category: string
  defaultPriceKurus: number
}

// TL cinsinden yazılıp kuruşa çevrilen sabit liste (okunurluk için).
const L = (lira: number) => lira * 100

export const LABOR_PRESETS: readonly LaborPreset[] = [
  // Bakım
  { name: "Motor yağı ve filtre değişimi", category: "Bakım", defaultPriceKurus: L(350) },
  { name: "Periyodik bakım işçiliği", category: "Bakım", defaultPriceKurus: L(750) },
  { name: "Hava filtresi değişimi", category: "Bakım", defaultPriceKurus: L(150) },
  { name: "Polen filtresi değişimi", category: "Bakım", defaultPriceKurus: L(200) },
  { name: "Yakıt filtresi değişimi", category: "Bakım", defaultPriceKurus: L(300) },
  // Fren
  { name: "Ön fren balatası değişimi", category: "Fren", defaultPriceKurus: L(400) },
  { name: "Arka fren balatası değişimi", category: "Fren", defaultPriceKurus: L(450) },
  { name: "Fren diski değişimi", category: "Fren", defaultPriceKurus: L(500) },
  { name: "Fren hidroliği değişimi ve hava alma", category: "Fren", defaultPriceKurus: L(350) },
  // Motor
  { name: "Triger seti değişimi", category: "Motor", defaultPriceKurus: L(2500) },
  { name: "Devirdaim (su pompası) değişimi", category: "Motor", defaultPriceKurus: L(900) },
  { name: "Buji değişimi", category: "Motor", defaultPriceKurus: L(350) },
  { name: "Enjektör temizliği", category: "Motor", defaultPriceKurus: L(600) },
  { name: "V kayışı / gergi rulmanı değişimi", category: "Motor", defaultPriceKurus: L(450) },
  // Elektrik
  { name: "Akü değişimi ve kontrolü", category: "Elektrik", defaultPriceKurus: L(150) },
  { name: "Alternatör / marş sökme takma", category: "Elektrik", defaultPriceKurus: L(700) },
  { name: "Far ayarı ve ampul değişimi", category: "Elektrik", defaultPriceKurus: L(200) },
  // Teşhis
  { name: "Motor arıza tespiti (diagnostik)", category: "Teşhis", defaultPriceKurus: L(400) },
  { name: "Yol testi ve genel kontrol", category: "Teşhis", defaultPriceKurus: L(250) },
  // Lastik / Balans
  { name: "Lastik sökme takma (4 adet)", category: "Lastik / Balans", defaultPriceKurus: L(300) },
  { name: "Rot balans ayarı", category: "Lastik / Balans", defaultPriceKurus: L(350) },
  { name: "Ön düzen (rot) ayarı", category: "Lastik / Balans", defaultPriceKurus: L(400) },
  // Kaporta / Boya
  { name: "Panel boyama işçiliği", category: "Kaporta / Boya", defaultPriceKurus: L(1500) },
  { name: "Göçük düzeltme (boyasız)", category: "Kaporta / Boya", defaultPriceKurus: L(800) },
]

/**
 * Atölyede zaten bulunan adları eleyip eklenecek presetleri döndürür.
 * Karşılaştırma aksansız + boşluk/harf duyarsızdır: iki kez içe aktarmak
 * listeyi ikiye katlamaz.
 */
export function pickNewPresets(
  presets: readonly LaborPreset[],
  existingNames: readonly string[]
): LaborPreset[] {
  const existing = new Set(existingNames.map((n) => foldTr(n.trim())))
  return presets.filter((p) => !existing.has(foldTr(p.name.trim())))
}
