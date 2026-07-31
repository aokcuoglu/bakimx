import { expect, test } from "bun:test"
import {
  normalizeSupplierPriceRows,
  derivePartPricing,
  shouldPreserveDerivedPricing,
  resolvePriceDraftCommit,
  type SupplierPriceRow,
} from "./supplier-prices"

function row(over: Partial<SupplierPriceRow> = {}): SupplierPriceRow {
  return { supplierId: "s1", purchasePrice: 1000, supplierSku: "", isPreferred: false, ...over }
}

test("boş liste boş döner", () => {
  expect(normalizeSupplierPriceRows([])).toEqual([])
})

test("tedarikçisi seçilmemiş satırlar atılır", () => {
  const rows = [row({ supplierId: "" }), row({ supplierId: "s2" })]
  const result = normalizeSupplierPriceRows(rows)
  expect(result).toHaveLength(1)
  expect(result[0].supplierId).toBe("s2")
})

test("hiç varsayılan yoksa ilk satır varsayılan olur", () => {
  const result = normalizeSupplierPriceRows([row({ supplierId: "s1" }), row({ supplierId: "s2" })])
  expect(result.map((r) => r.isPreferred)).toEqual([true, false])
})

test("birden fazla varsayılan varsa yalnız ilki kalır", () => {
  const result = normalizeSupplierPriceRows([
    row({ supplierId: "s1", isPreferred: true }),
    row({ supplierId: "s2", isPreferred: true }),
  ])
  expect(result.map((r) => r.isPreferred)).toEqual([true, false])
})

test("varsayılan satır atılırsa kalan ilk satır varsayılan olur", () => {
  const result = normalizeSupplierPriceRows([
    row({ supplierId: "", isPreferred: true }),
    row({ supplierId: "s2" }),
    row({ supplierId: "s3" }),
  ])
  expect(result.map((r) => [r.supplierId, r.isPreferred])).toEqual([
    ["s2", true],
    ["s3", false],
  ])
})

test("satır yoksa parça fiyatı ve tedarikçisi null olur", () => {
  expect(derivePartPricing([])).toEqual({ purchasePrice: null, supplierId: null })
})

test("varsayılan satırın fiyatı ve tedarikçisi parçaya taşınır", () => {
  const rows = normalizeSupplierPriceRows([
    row({ supplierId: "s1", purchasePrice: 5000 }),
    row({ supplierId: "s2", purchasePrice: 4000, isPreferred: true }),
  ])
  expect(derivePartPricing(rows)).toEqual({ purchasePrice: 4000, supplierId: "s2" })
})

// ── Türetilmiş alan koruması (eski, satırsız parçalar) ──────────────────────

test("alan hiç gönderilmediyse türetilmiş alanlara dokunulmaz", () => {
  expect(shouldPreserveDerivedPricing({ touched: false, incomingRowCount: 0, existingRowCount: 0 })).toBe(true)
  expect(shouldPreserveDerivedPricing({ touched: false, incomingRowCount: 0, existingRowCount: 3 })).toBe(true)
})

test("satırı hiç olmayan eski parçanın fiyatı/tedarikçisi boş listede korunur", () => {
  // Backfill'in ulaşamadığı parça (ör. fiyatı var, carisi yok) düzenlenirken
  // form boş liste gönderir — bu silme sayılmamalı.
  expect(shouldPreserveDerivedPricing({ touched: true, incomingRowCount: 0, existingRowCount: 0 })).toBe(true)
})

test("kullanıcı mevcut satırların hepsini silerse türetilmiş alanlar temizlenir", () => {
  expect(shouldPreserveDerivedPricing({ touched: true, incomingRowCount: 0, existingRowCount: 2 })).toBe(false)
})

test("satır gönderildiyse türetilmiş alanlar her durumda yazılır", () => {
  expect(shouldPreserveDerivedPricing({ touched: true, incomingRowCount: 1, existingRowCount: 0 })).toBe(false)
  expect(shouldPreserveDerivedPricing({ touched: true, incomingRowCount: 2, existingRowCount: 2 })).toBe(false)
})

// ── Fiyat alanı ara girdi koruması ──────────────────────────────────────────

/**
 * PriceInput'un döngüsünü birebir taklit eder: her tuş bir `onChange` (final
 * false), en sonda istenirse bir `onBlur` (final true). `raw` = tarayıcının o
 * anda `input.value` olarak döndürdüğü ham string — `type="number"` yarım bir
 * sayı için ("1250.", "1e") `""` döndürür, `badInput` ise yalnız gerçekten
 * sayıya çevrilemeyen metinde true olur.
 */
function typeIntoPriceField(
  startValue: number,
  keystrokes: { raw: string; badInput?: boolean }[],
  options: { blur?: boolean } = {}
): number {
  let state = startValue
  for (const k of keystrokes) {
    const r = resolvePriceDraftCommit(k.raw, { final: false, badInput: k.badInput })
    if (r.commit) state = r.value
  }
  if (options.blur) {
    const last = keystrokes[keystrokes.length - 1] ?? { raw: "" }
    const r = resolvePriceDraftCommit(last.raw, { final: true, badInput: last.badInput })
    if (r.commit) state = r.value
  }
  return state
}

test("senaryo 1: 1·2·5·0·.·5 sırasıyla yazılınca 1250.5 olur", () => {
  // "." tuşunda tarayıcı "1250." için "" döndürür → commit edilmez, state 1250 kalır.
  const state = typeIntoPriceField(0, [
    { raw: "1" },
    { raw: "12" },
    { raw: "125" },
    { raw: "1250" },
    { raw: "" }, // "1250." — yarım ondalık
    { raw: "1250.5" },
  ])
  expect(state).toBe(1250.5)
})

test("senaryo 2: '1250.' yazıp blur etmeden submit edilirse 1250 kaydedilir (0 değil)", () => {
  const state = typeIntoPriceField(0, [
    { raw: "1" },
    { raw: "12" },
    { raw: "125" },
    { raw: "1250" },
    { raw: "" }, // "1250." — ekranda görünür, state 1250 kalmalı
  ])
  expect(state).toBe(1250)
})

test("senaryo 3: alan tamamen silinip blur edilirse 0 olur", () => {
  const state = typeIntoPriceField(1250, [{ raw: "" }], { blur: true })
  expect(state).toBe(0)
})

test("ayrıştırılamayan metin ('1e') blur'da bile 0'a düşürmez", () => {
  const state = typeIntoPriceField(1250, [{ raw: "", badInput: true }], { blur: true })
  expect(state).toBe(1250)
})

test("negatif değer commit edilmez", () => {
  expect(resolvePriceDraftCommit("-5", { final: false })).toEqual({ commit: false })
  expect(resolvePriceDraftCommit("-5", { final: true })).toEqual({ commit: false })
})

test("geçerli sayı hem yazarken hem blur'da commit edilir", () => {
  expect(resolvePriceDraftCommit("1250.5", { final: false })).toEqual({ commit: true, value: 1250.5 })
  expect(resolvePriceDraftCommit("0", { final: true })).toEqual({ commit: true, value: 0 })
})
