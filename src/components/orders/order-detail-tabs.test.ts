import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (f: string) => readFileSync(join(import.meta.dir, f), "utf8")
const DETAIL = read("work-order-detail.tsx")
const TECH = read("technician-progress-panel.tsx")
const ACTIVITY = read("order-activity-log.tsx")
const MANAGEMENT = read("order-management-panel.tsx")
const SURFACE = read("order-detail-surface.tsx")
const CSS = read("order-detail.module.css")

test("Tahsilat, Kanıt, Teknisyen ve Geçmiş sekmeleri Card kabuğu kullanmaz", () => {
  for (const src of [DETAIL, TECH, ACTIVITY]) {
    expect(src).not.toContain("@/components/ui/card")
  }
  const history = MANAGEMENT.slice(MANAGEMENT.indexOf("export function PaymentHistoryCard"))
  expect(history).toContain('<DetailPanel\n        title="Tahsilat Geçmişi"')
  expect(history).not.toContain("<Card")
})

test("BÜYÜK HARF etiket ve 10px metin sekme içlerine dönmez", () => {
  for (const src of [DETAIL, TECH, ACTIVITY, MANAGEMENT, SURFACE]) {
    expect(src).not.toContain("uppercase tracking-wider")
    expect(src).not.toContain("text-[10px]")
  }
})

test("birim testinden erişilen modüller surface.tsx'i içeri almaz (next/font çöker)", () => {
  for (const src of [SURFACE, TECH, ACTIVITY, MANAGEMENT]) {
    expect(src).not.toContain('@/components/dashboard/surface"')
  }
})

test("Özet'ten gelen kaydırma hedefi korunur", () => {
  expect(DETAIL).toMatch(/<div ref=\{(photosRef|attachPhotos)\} className="scroll-mt-4">/)
})

test("sekme şeridi etkin sekmeyi yatay kaydırarak görünür kılar (sayfayı kaydırmaz)", () => {
  expect(DETAIL).toContain("tabListRef")
  expect(DETAIL).toContain('[data-state="active"]')
  expect(DETAIL).toContain("list.scrollTo({ left")
})

test(".tap katmanı position yazmaz (Tailwind absolute'ı ezerdi)", () => {
  const block = CSS.slice(CSS.indexOf(".tap::before"), CSS.indexOf("@media", CSS.indexOf(".tap::before")))
  expect(block).toContain("position:absolute")
  expect(CSS).not.toMatch(/\.tap\s*\{[^}]*position/)
})

test("#897: sekme panelleri şeritten tutarlı 24/28px aşağıda başlar (paylaşılan tabs.tsx'e dokunmadan)", () => {
  expect(CSS).toMatch(/\.pageTabs > \[role="tabpanel"\] \{ margin-top:16px; \}/)
  expect(CSS).toMatch(/min-width:640px\) \{ \.pageTabs > \[role="tabpanel"\] \{ margin-top:20px; \}/)
  // İç içe Tabs (PhotoPhaseMatrix) etkilenmesin: yalın torun seçici yok.
  expect(CSS).not.toMatch(/\.\w+ \[role="tabpanel"\]/)
  expect(DETAIL).toContain("className={detail.pageTabs}")
})

test("#897: Teknisyen Panelinde Aç bağlantısı bağlam kartının içinde, yalın sağa yaslı satırda değil", () => {
  const tab = DETAIL.slice(DETAIL.indexOf('<TabsContent value="teknisyen"'))
  const card = tab.slice(tab.indexOf("<section"), tab.indexOf("</section>"))
  expect(card).toContain("detail.context")
  expect(card).toContain("canOpenTechnicianView(order.assignedTechnicianId)")
  expect(card).toContain("technicianOrderPath(order.id)")
  expect(card).toContain("Henüz usta atanmadı")
  expect(tab).not.toContain("flex justify-end")
  expect(TECH).not.toContain("Bu bölüm salt okunurdur")
})
