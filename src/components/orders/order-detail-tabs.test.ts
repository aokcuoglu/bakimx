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
  expect(DETAIL).toContain('<div ref={photosRef} className="scroll-mt-4">')
})

test(".tap katmanı position yazmaz (Tailwind absolute'ı ezerdi)", () => {
  const block = CSS.slice(CSS.indexOf(".tap::before"), CSS.indexOf("@media", CSS.indexOf(".tap::before")))
  expect(block).toContain("position:absolute")
  expect(CSS).not.toMatch(/\.tap\s*\{[^}]*position/)
})
