import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (f: string) => readFileSync(join(import.meta.dir, f), "utf8")
const DETAIL = read("work-order-detail.tsx")
const TECH = read("technician-progress-panel.tsx")
const ACTIVITY = read("order-activity-log.tsx")
const MANAGEMENT = read("order-management-panel.tsx")
const SURFACE = read("order-detail-surface.tsx")
const NAV = read("order-section-nav.tsx")
const SUMMARY = read("order-status-summary.tsx")
const CSS = read("order-detail.module.css")

/** Bir CSS kuralının gövdesi (seçiciden ilk `}`e). */
const rule = (css: string, selector: string) => {
  const start = css.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  return css.slice(start, css.indexOf("}", start))
}

test("Ödeme, Kanıt, Teknisyen ve Geçmiş bölümleri Card kabuğu kullanmaz", () => {
  for (const src of [DETAIL, TECH, ACTIVITY, NAV, SUMMARY]) {
    expect(src).not.toContain("@/components/ui/card")
  }
  const history = MANAGEMENT.slice(MANAGEMENT.indexOf("export function PaymentHistoryCard"))
  expect(history).toContain('<DetailPanel\n        title="Tahsilat Geçmişi"')
  expect(history).not.toContain("<Card")
})

test("BÜYÜK HARF etiket ve 10px metin bölümlere dönmez", () => {
  for (const src of [DETAIL, TECH, ACTIVITY, MANAGEMENT, SURFACE, NAV, SUMMARY]) {
    expect(src).not.toContain("uppercase tracking-wider")
    expect(src).not.toContain("text-[10px]")
  }
})

test("birim testinden erişilen modüller surface.tsx'i içeri almaz (next/font çöker)", () => {
  for (const src of [SURFACE, TECH, ACTIVITY, MANAGEMENT, NAV, SUMMARY]) {
    expect(src).not.toContain('@/components/dashboard/surface"')
  }
})

/**
 * #911 — sekmeler kalktı; Fotoğraflar Kanıt bölümünün içinde ve bölüme
 * kaydırma üst barın + çip şeridinin altında durur (eski #838 hedefinin yerine).
 */
test("Kanıt bölümü Fotoğraflar'ı taşır, kaydırma hedefi yapışkan barların altında durur", () => {
  const start = DETAIL.indexOf('id="kanit" data-section="kanit"')
  expect(start).toBeGreaterThan(0)
  const kanit = DETAIL.slice(start, DETAIL.indexOf("data-section=", start + 40))
  expect(kanit).toContain('title="Fotoğraflar"')
  expect(kanit).toContain('title="Hasar"')
  expect(CSS).toMatch(/\.section \{[^}]*scroll-margin-top:calc\(var\(--app-sticky-top/)
})

test("bölüm çipleri sekme değil sayfa içi bağlantı; etkin çip şeridi yatay kaydırır (sayfayı kaydırmaz)", () => {
  expect(NAV).toContain('aria-label="Bölümler"')
  expect(NAV).toContain("aria-current")
  expect(NAV).toContain('[aria-current="location"]')
  expect(NAV).toContain("list.scrollTo({ left")
  expect(NAV).toContain("href={`#${section.id}`}")
  expect(NAV).not.toContain(".scrollIntoView(")
  expect(NAV).not.toContain('role="tab"')
  expect(NAV).not.toContain("TabsList")
  // Telefonda 44px dokunma (ölçek --control-h'den).
  expect(rule(CSS, ".chip")).toContain("height:var(--control-h)")
})

test(".tap katmanı position yazmaz (Tailwind absolute'ı ezerdi)", () => {
  const block = CSS.slice(CSS.indexOf(".tap::before"), CSS.indexOf("@media", CSS.indexOf(".tap::before")))
  expect(block).toContain("position:absolute")
  expect(CSS).not.toMatch(/\.tap\s*\{[^}]*position/)
})

test("#897 → #911: sayfa düzeyinde sekme kalmadı; iç faz sekmeleri etkilenmez", () => {
  expect(DETAIL).not.toContain("@/components/ui/tabs")
  expect(DETAIL).not.toContain("<TabsContent")
  expect(CSS).not.toContain(".pageTabs")
  expect(CSS).not.toContain(".tabList")
  // İç içe Tabs (PhotoPhaseMatrix) etkilenmesin: yalın torun seçici yok.
  expect(CSS).not.toMatch(/\.\w+ \[role="tabpanel"\]/)
})

test("#897: Teknisyen Panelinde Aç bağlantısı bağlam kartının içinde, yalın sağa yaslı satırda değil", () => {
  const start = DETAIL.indexOf('<section aria-label="Teknisyen"')
  expect(start).toBeGreaterThan(0)
  const card = DETAIL.slice(start, DETAIL.indexOf("</section>", start))
  expect(card).toContain("detail.context")
  expect(card).toContain("canOpenTechnicianView(order.assignedTechnicianId)")
  expect(card).toContain("technicianOrderPath(order.id)")
  expect(card).toContain("Henüz usta atanmadı")
  const rail = DETAIL.slice(DETAIL.indexOf("className={detail.rail}"))
  expect(rail).toContain('<section aria-label="Teknisyen"')
  expect(rail).not.toContain("flex justify-end")
  expect(TECH).not.toContain("Bu bölüm salt okunurdur")
})

test("#911: iki kolon içerik genişliğine bağlı, ray yapışkan ve kendi içinde kaymaz", () => {
  expect(rule(CSS, ".page")).toContain("container-name:detail")
  expect(CSS).toContain("@container detail (min-width:780px)")
  expect(CSS).toContain("@container detail (min-width:1040px)")
  const twoColumn = CSS.slice(CSS.indexOf("@container detail (min-width:780px)"))
  expect(twoColumn).toMatch(/\.rail \{ position:sticky; top:/)
  expect(twoColumn).toContain("grid-template-columns:minmax(0,1fr) 300px")
  // Ray görünür alandan uzunsa sayfayla kayar; iç kaydırma çubuğu yok.
  for (const block of CSS.match(/\.rail \{[^}]*\}/g) ?? []) {
    expect(block).not.toContain("max-height")
    expect(block).not.toContain("overflow-y")
  }
  // Tek kolonda çipler ve özet kartı, iki kolonda Durum kartı.
  expect(twoColumn).toContain(".chips, .summary { display:none; }")
  expect(twoColumn).toContain(".rail .statusCard { display:flex; }")
})

test("#911: ağır hasar haritası görünür alana yaklaşınca bağlanır", () => {
  expect(DETAIL).toContain("<DeferUntilVisible")
  const deferred = DETAIL.slice(DETAIL.indexOf("<DeferUntilVisible"), DETAIL.indexOf("</DeferUntilVisible>"))
  expect(deferred).toContain("<DamageCapture ")
})

test("#911: kilitli bölümler başlıklı yükseltme kutusu gösterir", () => {
  expect(DETAIL).toContain('<DetailPanel title="Ödemeler" bare>\n                <InlineFeatureUpsell feature="cashbox"')
  expect(DETAIL).toContain('<DetailPanel title="Teknisyen" bare>\n                <InlineFeatureUpsell feature="team"')
})
