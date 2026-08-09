import { expect, test, describe } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * #278 — Ayarlar sekme şeridi kaba SIĞMALI.
 *
 * Sekiz sekmelik şerit `constrained` (max-w-3xl, 768px) kapta 1125px istiyordu;
 * yani her masaüstünde kaydırma gerekiyordu. İki değişiklikle çözüldü: sayfa
 * `wide` (max-w-5xl, 1024px) kaba alındı ve sayfanın kendisi zaten "Ayarlar"
 * olduğu için tekrar eden "… Ayarları / … Kuralları / … Şablonları" ekleri
 * etiketlerden çıkarıldı. Ölçülen sonuç: 891px şerit, 1024px kap.
 *
 * Bu iki koşuldan biri sessizce geri alınırsa şerit yeniden taşar. Testler
 * kaynağı okur; bileşeni import etmez (client bileşeni + ağır bağımlılıklar).
 */

const SETTINGS_DIR = import.meta.dir
const pageSource = readFileSync(join(SETTINGS_DIR, "page.tsx"), "utf8")
const tabsSource = readFileSync(join(SETTINGS_DIR, "settings-tabs.tsx"), "utf8")

/**
 * Etiket karakter bütçesi. Ölçüm: 66 karakterlik mevcut etiket seti 891px şerit
 * üretiyor (~13.5px/karakter, ikon + `px-3` dolgu + `gap-2` dahil), kap 1024px.
 * 72 karakter ≈ 970px — 1024px'in altında güvenli pay bırakır.
 *
 * Bu sınır bilinçli olarak aşılacaksa önce şeridin gerçekten sığdığı tarayıcıda
 * ölçülmeli; sayıyı büyütmek tek başına sorunu çözmez.
 */
const LABEL_BUDGET = 72

function tabLabels(): string[] {
  // `const TABS: {...}[] = [ ... ]` — tip açıklaması da `[]` içerdiği için dizi
  // gövdesi `= [` ile satır başındaki `]` arasından alınır.
  const afterDecl = tabsSource.split("const TABS")[1] ?? ""
  const block = afterDecl.split("= [")[1]?.split("\n]")[0] ?? ""
  return [...block.matchAll(/label:\s*"([^"]+)"/g)].map((m) => m[1])
}

describe("Ayarlar sayfası düzeni", () => {
  test("sayfa `wide` kapta — `constrained` şeridi taşırıyordu", () => {
    expect(pageSource).toMatch(/<AppShell\s+wide\b/)
    expect(pageSource).not.toMatch(/<AppShell\s+constrained\b/)
  })

  test("sekme etiketleri karakter bütçesini aşmıyor", () => {
    const labels = tabLabels()
    expect(labels.length).toBe(8)

    const used = labels.join("").length
    expect(used).toBeLessThanOrEqual(LABEL_BUDGET)
  })

  test("etiketlerde sayfanın kendisini tekrar eden ek yok", () => {
    for (const label of tabLabels()) {
      expect(label).not.toMatch(/\sAyarları$/)
    }
  })
})

describe("Ayarlar sekme şeridi", () => {
  test("aktif sekmenin etiketi dar ekranda da görünür", () => {
    // Etiket `hidden sm:inline` ile koşulsuz gizlenirse mobilde yalnız ikon kalır
    // ve hangi sekmede olunduğu anlaşılmaz.
    expect(tabsSource).toContain('isActive ? "inline" : "hidden sm:inline"')
  })

  test("taşma varken kenar solması gösteriliyor", () => {
    expect(tabsSource).toContain("edges.start")
    expect(tabsSource).toContain("edges.end")
  })
})
