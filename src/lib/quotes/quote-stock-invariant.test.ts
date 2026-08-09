import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

/**
 * #179 — HAYATİ İNVARYANT: teklif bir ÖNERİDİR, teklif kalemi hiçbir koşulda
 * stok hareketi yaratmaz.
 *
 * Teklif ekranı artık iş emrinin kalem düzenleyicisini (PartsLaborEditor) yeniden
 * kullanıyor. İş emri tarafında satır `partId` ile stok kartına bağlanınca sunucu
 * stoğu düşürür/rezerve eder; aynı bileşen düşüncesizce sunucuya bağlanırsa
 * teklif hazırlamak envanteri eksiltir. Tip sistemi bunu yakalamaz — teklif
 * kaleminin `partId`'si de meşrudur, yalnız stok yalnız ÇEVRİMDE düşer.
 *
 * Bu test kaynak taramasıdır (bkz. rbac-coverage.test.ts, aynı desen): stok
 * hareketi çağrılarının teklif tarafında SADECE dönüştürme fonksiyonunda
 * bulunmasını ve teklif kalem düzenleyicisinin hiçbir yazma isteği atmamasını
 * zorunlu kılar.
 */

const ROOT = join(import.meta.dir, "..", "..")

/** Stok hareketi yaratan/serbest bırakan çağrılar. */
const STOCK_CALLS = ["reserveStockInTx(", "returnStockInTx(", "stockQty:"]

/** Yorumları at — gerekçe metinlerinde yasaklı simgeler geçiyor. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "")
}

/** `export async function NAME(...)` gövdesini bir sonraki üst-düzey export'a kadar keser. */
function functionBody(source: string, name: string): string {
  const start = source.indexOf(`export async function ${name}(`)
  expect(start, `${name} bulunamadı`).toBeGreaterThan(-1)
  const rest = source.slice(start + 1)
  const next = rest.indexOf("\nexport ")
  return next === -1 ? rest : rest.slice(0, next)
}

test("teklif oluşturma stok hareketi yapmaz", () => {
  const source = stripComments(readFileSync(join(ROOT, "app", "(app)", "quotes", "actions.ts"), "utf8"))
  const body = functionBody(source, "createQuoteAction")
  for (const call of STOCK_CALLS) {
    expect(body, `createQuoteAction içinde stok çağrısı: ${call}`).not.toContain(call)
  }
})

test("stok yalnız teklif iş emrine çevrilirken düşer", () => {
  const source = stripComments(readFileSync(join(ROOT, "app", "(app)", "quotes", "actions.ts"), "utf8"))
  const convert = functionBody(source, "convertQuoteToWorkOrderAction")
  // Çevrim gerçekten düşürüyor olmalı — aksi hâlde bu test yanlış yerde yeşil kalır.
  expect(convert).toContain("reserveStockInTx(")

  // Dosyanın tamamındaki her stok çağrısı çevrim fonksiyonunun içinde olmalı.
  const occurrences = source.split("reserveStockInTx(").length - 1
  const inConvert = convert.split("reserveStockInTx(").length - 1
  // İçe aktarma satırı çağrı değil; `reserveStockInTx,` biçiminde geçer.
  expect(occurrences).toBe(inConvert)
})

test("teklif kalem düzenleyicisi sunucuya hiçbir yazma isteği atmaz", () => {
  const code = stripComments(
    readFileSync(join(ROOT, "components", "quotes", "quote-items-editor.tsx"), "utf8")
  )
  for (const forbidden of ["fetch(", '"POST"', '"PATCH"', '"DELETE"', "/api/orders/items"]) {
    expect(code, `QuoteItemsEditor içinde kalıcılık çağrısı: ${forbidden}`).not.toContain(forbidden)
  }
  // İş emri adaptörünü (anında yazan bileşen) kullanmamalı — sunum çekirdeğini kullanır.
  expect(code).toContain("PartsLaborEditor")
  expect(code).not.toContain("<PartsLaborGrid")
})

test("teklif oluşturma formu kalemleri sunucuya tek gönderimde yazar", () => {
  const code = stripComments(
    readFileSync(join(ROOT, "components", "quotes", "quote-create-form.tsx"), "utf8")
  )
  expect(code).not.toContain("/api/orders/items")
  expect(code).toContain("QuoteItemsEditor")
})

test("teklif oluşturma kalemleri tek yerde yazar ve serviceOrderItem'a dokunmaz", () => {
  const source = stripComments(readFileSync(join(ROOT, "app", "(app)", "quotes", "actions.ts"), "utf8"))
  const body = functionBody(source, "createQuoteAction")
  expect(body).toContain("prisma.quoteItem.create")
  expect(body).not.toContain("serviceOrderItem")
})
