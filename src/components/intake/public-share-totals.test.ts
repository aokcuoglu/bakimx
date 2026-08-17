import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * Kaynak tarayan kapı (BAK-75 takibi) — bkz. docs/agent-workflows/repo-guardrails.md §5.
 *
 * "Araç Kabul ve İşlem Özeti" (`/s/<token>`) toplamları `formatOrderSummary` ile
 * hesaplar. Fonksiyonun İKİNCİ parametresi (indirim + KDV oranı) verilmezse
 * çıktı yine derlenir, tipler yine geçer — belge sessizce ham net toplamı
 * "Genel Toplam" diye basar. İş emrinde KDV %20 / ₺80 seçiliyken müşteri
 * belgesinde KDV satırının hiç görünmemesinin sebebi tam olarak buydu.
 *
 * Aynı sessizlik Prisma tarafında da var: `taxRate` / `discountAmount` select'ten
 * düşerse alanlar `undefined` gelir ve hesap yine KDV'siz çıkar.
 */

const SRC = join(import.meta.dir, "..", "..")
const PAGE = readFileSync(join(import.meta.dir, "public-share-page.tsx"), "utf8")
const ROUTE = readFileSync(join(SRC, "app", "s", "[token]", "page.tsx"), "utf8")
const PDF_ROUTE = readFileSync(join(SRC, "app", "s", "[token]", "pdf", "route.ts"), "utf8")

test("müşteri özeti toplamları iş emrinin indirim + KDV oranıyla hesaplar", () => {
  expect(PAGE).toContain("formatOrderSummary(orderItems, orderTotalsOptions)")
  expect(PAGE).toContain("discountAmount: intakeForm.order?.discountAmount ?? null")
  expect(PAGE).toContain("taxRate: intakeForm.order?.taxRate ?? null")
})

test("KDV ve indirim satırları belgede yer alır", () => {
  expect(PAGE).toContain("summary.hasTax")
  expect(PAGE).toContain("summary.hasDiscount")
  expect(PAGE).toContain("formatTaxRate(summary.taxRate)")
})

test("WhatsApp mesajındaki tutar sayfadaki Genel Toplam'la aynı kaynaktan gelir", () => {
  // Elle satır toplayan eski hesap indirimi ve KDV'yi atlıyordu: mesajdaki
  // rakam müşterinin ekranda gördüğünden farklı çıkıyordu.
  expect(PAGE).toContain("totalAmount: shareLink.showOrderItems && intakeForm.order ? grandTotalKurus : null")
})

test("her iki sorgu da indirim, KDV oranı ve satır KDV bayrağını seçer", () => {
  for (const [name, source] of [["sayfa", ROUTE], ["pdf", PDF_ROUTE]] as const) {
    expect(source, name).toContain("discountAmount: true")
    expect(source, name).toContain("taxRate: true")
    // `includeVat` elle değil sabit üzerinden gelir (BAK-53).
    expect(source, name).toContain("...ORDER_TOTALS_ITEM_SELECT")
  }
})
