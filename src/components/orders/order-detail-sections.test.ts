import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { ORDER_SECTIONS } from "@/lib/orders/detail-sections"

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
  expect(history).toContain('<DetailPanel title="Tahsilat Geçmişi">')
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

test("#911: her bölümün ilk bloğu adlı bölge; odak halkası yalnız klavyede", () => {
  for (const { id, label } of ORDER_SECTIONS) {
    expect(DETAIL).toContain(`<div id="${id}" data-section="${id}" role="region" aria-label="${label}" tabIndex={-1}`)
  }
  expect(rule(CSS, ".section")).toContain("outline:none")
  expect(CSS).toMatch(/\.section:focus-visible \{ outline:2px solid var\(--ring\)/)
})

test("#911: hasar yer tutucusu yüklenmiş blok boyunda (derin bağlantı kaymasın)", () => {
  expect(DETAIL).toContain('placeholderClassName="min-h-[760px] sm:min-h-[640px]"')
})

test("#911: çip şeridi iki kolonda ölçülmez, dokunulan çip tutulur, hareket azaltmaya uyar", () => {
  const SPY = readFileSync(join(import.meta.dir, "..", "..", "hooks", "use-section-spy.ts"), "utf8")
  expect(SPY).toContain("if (nav && nav.getClientRects().length === 0) return")
  expect(SPY).toContain("return { active: held ?? spied, hold: setHeld }")
  expect(NAV).toContain("hold(section.id)")
  expect(NAV).toContain("const behavior = sectionScrollBehavior()")
  expect(NAV).not.toContain('behavior: "smooth"')
})

test("#911: boş şikâyet boş paragraf değil, açıklama gösterir", () => {
  expect(SUMMARY).toContain("Şikayet girilmedi")
})

/**
 * #912 — telefon özet kartı "Tahsilat al"ı üçüncü kez tekrar etmez (hızlı işlem
 * ve Ödeme kartında var); para satırı Ödeme bölümüne bağlantıdır.
 */
test("#912: özet kartında tahsilat düğmesi yok, para satırı Ödeme bölümüne gider", () => {
  expect(SUMMARY).not.toContain("Tahsilat al")
  expect(SUMMARY).not.toContain("onCollect")
  expect(SUMMARY).not.toContain("@/components/ui/button")
  const money = SUMMARY.slice(SUMMARY.indexOf("{money && ("))
  expect(money).toContain('href="#odeme"')
  expect(money).toContain('onNavigate("odeme")')
})

/**
 * #912 — tekrarlar: Durum kartında hap panel başlığında; teslim kodu yalnız
 * başlıktaki birincil "Teslim Et (OTP)" ile istenir (Müşteri Çıktısı'ndaki ikinci
 * düğme fiyatsız kalem / karar bekleyen talep kapısını da atlıyordu).
 */
test("#912: Durum hapı panel başlığında, teslim kodu düğmesi tek yerde", () => {
  const card = SUMMARY.slice(SUMMARY.indexOf("export function OrderStatusCard"))
  expect(card).toContain('<DetailPanel title="Durum" aside={<OrderStatusPill status={status} />}')
  expect(card.match(/<OrderStatusPill/g)).toHaveLength(1)
  expect(DETAIL).not.toContain("SMS Teslim Kodu Gönder")
  expect(DETAIL.match(/onClick=\{handleRequestDeliveryOtp\}/g)).toHaveLength(1)
  expect(DETAIL).toContain('label: a.key === "delivered" ? "Teslim Et (OTP)" : a.label')
  expect(DETAIL).toContain('(a.key === "delivered" && deliveryBlocked)')
})

/**
 * #913 — engeller Durum kartında. Başlığın altındaki iki uyarı şeridi kalktı;
 * aynı metin, ad önizlemesi ve Kalemler'e çıkış yolu Durum kartında ve telefon
 * özet kartında (`orderNextStep`, next-step.test.ts). Bağlantı sayfa içi `<a>`
 * ("devamı" ile aynı kalıp), düğme değil.
 */
test("#913: uyarı şeritleri yok; engeller Durum kartında Kalemler bağlantısıyla", () => {
  expect(DETAIL).not.toContain("kalemin fiyatı girilmemiş.")
  expect(DETAIL).not.toContain("parça talebi karar bekliyor.")
  expect(DETAIL).not.toContain('scrollToOrderSection("kalemler")} className="mt-1"')
  const issue = SUMMARY.slice(SUMMARY.indexOf("function StepIssue"), SUMMARY.indexOf("function NextStepLine"))
  expect(issue).toContain('href="#kalemler"')
  expect(issue).toContain('onNavigate("kalemler")')
  expect(issue).toContain("{issue.linkLabel}")
  // Durum kartı ve telefon özeti aynı satırı, aynı gezinmeyle çizer.
  expect(SUMMARY.match(/<NextStepLine step=\{nextStep\} onNavigate=\{onNavigate\} \/>/g)).toHaveLength(2)
  expect(DETAIL).toContain("<OrderStatusCard status={order.status} nextStep={nextStep} onNavigate={scrollToOrderSection}")
  // Telefonda engel varsa kartın başında okunur.
  expect(SUMMARY).toContain("{blocked && stepBlock}")
  expect(SUMMARY).toContain("{!blocked && stepBlock}")
})
