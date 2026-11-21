import { describe, expect, test } from "bun:test"
import { classifyExactProducts, clampGetirbakimLimit, normalizePartNo, parseGetirbakimExactProduct, parseGetirbakimProduct, parseGetirbakimVehicleTypeId, GETIRBAKIM_MAX_LIMIT, GETIRBAKIM_DEFAULT_LIMIT, type GetirbakimExactProduct } from "./types"

test("vehicleTypeId yalnız pozitif Int32 ondalık kimlik kabul eder", () => {
  expect(parseGetirbakimVehicleTypeId(null)).toBeNull()
  expect(parseGetirbakimVehicleTypeId("2147483647")).toBe(2147483647)
  for (const value of ["", "0", "-1", "1.5", "1e3", " 1", "2147483648"]) {
    expect(parseGetirbakimVehicleTypeId(value)).toBeUndefined()
  }
})

describe("exact offer contract", () => {
  test("parça numarasını GetirBakım anahtarıyla aynı biçimde normalize eder", () => {
    expect(normalizePartNo(" 10-38.03 ")).toBe("103803")
    expect(normalizePartNo("CU 29 007")).toBe(normalizePartNo("CU29007"))
  })

  test("yalnız sunum alanlarını parse eder ve güvenilmeyen offer satırını atar", () => {
    const product = parseGetirbakimExactProduct({
      sourceProductId: "168993",
      brandName: "TRW",
      manufacturerPartNumber: { value: "103803", normalized: "103803" },
      offers: [
        {
          selectedOfferId: "offer_1",
          supplierDisplayName: "Dinamik Otomotiv",
          informationalPriceKurus: 99530,
          currency: "TRY",
          vatRateBps: 2000,
          availability: "IN_STOCK",
          stockQty: 4,
          lastSyncedAt: "2026-07-25T17:30:33.914Z",
          costTry: 1,
          supplierId: "secret",
        },
        { informationalPriceKurus: 100 },
      ],
    })
    expect(product?.offers).toEqual([{
      selectedOfferId: "offer_1",
      supplierDisplayName: "Dinamik Otomotiv",
      informationalPriceKurus: 99530,
      currency: "TRY",
      vatRateBps: 2000,
      availability: "IN_STOCK",
      stockQty: 4,
      lastSyncedAt: "2026-07-25T17:30:33.914Z",
    }])
    expect(product).not.toHaveProperty("offers.0.costTry")
    expect(product).not.toHaveProperty("offers.0.supplierId")
    expect(product?.brandName).toBe("TRW")
    expect(product?.discountBps).toBe(0)
  })

  test("ürün düzeyindeki partner iskontosunu GetirBakım'ın verdiği gibi taşır (#760)", () => {
    const base = { sourceProductId: "1", brandName: "TRW", manufacturerPartNumber: { value: "X1", normalized: "X1" }, offers: [] }
    expect(parseGetirbakimExactProduct({ ...base, discountBps: 1000 })?.discountBps).toBe(1000)
    expect(parseGetirbakimExactProduct({ ...base, discountBps: -5 })?.discountBps).toBe(0)
    expect(parseGetirbakimExactProduct({ ...base, discountBps: "1000" })?.discountBps).toBe(0)
  })

  test("0..N ürünün route durumunu tüm offerlar üzerinden sınıflandırır", () => {
    const product = (offers: GetirbakimExactProduct["offers"]): GetirbakimExactProduct => ({
      sourceProductId: "1", brandName: "TRW",
      manufacturerPartNumber: { value: "103803", normalized: "103803" }, discountBps: 0, offers,
    })
    expect(classifyExactProducts([])).toBe("no_match")
    expect(classifyExactProducts([product([]), { ...product([]), sourceProductId: "2" }])).toBe("no_offers")
    expect(classifyExactProducts([product([]), product([{
      supplierDisplayName: "Dinamik", informationalPriceKurus: 1, currency: "TRY",
      vatRateBps: 2000, availability: "UNKNOWN", stockQty: null, lastSyncedAt: null,
    }])])).toBe("matched")
  })
})

describe("clampGetirbakimLimit", () => {
  test("geçersiz/eksik değer varsayılana düşer", () => {
    expect(clampGetirbakimLimit(null)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
    expect(clampGetirbakimLimit(undefined)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
    expect(clampGetirbakimLimit(0)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
    expect(clampGetirbakimLimit(-5)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
    expect(clampGetirbakimLimit(Number.NaN)).toBe(GETIRBAKIM_DEFAULT_LIMIT)
  })

  test("üst sınır sunucuda uygulanır", () => {
    expect(clampGetirbakimLimit(5)).toBe(5)
    expect(clampGetirbakimLimit(999)).toBe(GETIRBAKIM_MAX_LIMIT)
  })
})

describe("parseGetirbakimProduct — fiyat kuruş olarak taşınır", () => {
  test("kuruş alanları tam sayı olarak korunur", () => {
    const p = parseGetirbakimProduct({
      id: "1",
      name: "Balata",
      listPriceKurus: 189000,
      b2bPriceKurus: 160650,
      discountBps: 1500,
      vatRateBps: 2000,
    })
    expect(p?.listPriceKurus).toBe(189000)
    expect(p?.b2bPriceKurus).toBe(160650)
    expect(p?.discountBps).toBe(1500)
    expect(p?.vatRateBps).toBe(2000)
  })

  test("ondalık gelen fiyat kesilir — kuruş tam sayıdır", () => {
    const p = parseGetirbakimProduct({ id: "1", name: "Balata", b2bPriceKurus: 160650.7 })
    expect(p?.b2bPriceKurus).toBe(160650)
    expect(Number.isInteger(p?.b2bPriceKurus)).toBe(true)
  })

  test("fiyat alanı yoksa null döner, 0 DEĞİL", () => {
    // 0 kuruş "bedava" demek olurdu; fiyatsız ürün yüzeyde "fiyat sorulur".
    const p = parseGetirbakimProduct({ id: "1", name: "Balata" })
    expect(p?.listPriceKurus).toBeNull()
    expect(p?.b2bPriceKurus).toBeNull()
  })

  test("fiyat metin olarak gelirse kabul edilmez", () => {
    const p = parseGetirbakimProduct({ id: "1", name: "Balata", b2bPriceKurus: "160650" })
    expect(p?.b2bPriceKurus).toBeNull()
  })

  test("KDV oranı verilmezse %20 varsayılır", () => {
    expect(parseGetirbakimProduct({ id: "1", name: "Balata" })?.vatRateBps).toBe(2000)
  })
})

describe("parseGetirbakimProduct — dayanıklılık", () => {
  test("yalnız doğrulanmış aynı araç kimliği uyumlu kalır", () => {
    const confirmed = parseGetirbakimProduct({
      id: "42", name: "X", sourceProductId: "42", contractVersion: "1.1",
      exactFitment: { requestedVehicleTypeId: 16573, status: "CONFIRMED", matchedVehicleTypeIds: [16573] },
    })
    expect(confirmed?.exactFitment.status).toBe("CONFIRMED")

    const dishonest = parseGetirbakimProduct({
      id: "42", name: "X",
      exactFitment: { requestedVehicleTypeId: 16573, status: "CONFIRMED", matchedVehicleTypeIds: [99999] },
    })
    expect(dishonest?.exactFitment.status).toBe("NOT_REQUESTED")
    expect(parseGetirbakimProduct({ id: "42", name: "X" })?.exactFitment.status).toBe("NOT_REQUESTED")
  })

  test("sözleşme 1.3 fitmentLevel'ı okunur, 1.2'de exactFitment'tan türetilir (#755)", () => {
    const fit = (requestedVehicleTypeId: number, status: string, matched: number[]) => ({
      requestedVehicleTypeId, status, matchedVehicleTypeIds: matched,
    })
    const v13 = (fitmentLevel: unknown, exactFitment: unknown) =>
      parseGetirbakimProduct({ id: "1", name: "X", contractVersion: "1.3", fitmentLevel, exactFitment })

    expect(v13("guaranteed", fit(7, "CONFIRMED", [7]))?.contractVersion).toBe("1.3")
    expect(v13("guaranteed", fit(7, "CONFIRMED", [7]))?.fitmentLevel).toBe("guaranteed")
    expect(v13("likely", fit(7, "NOT_CONFIRMED", []))?.fitmentLevel).toBe("likely")
    expect(v13("unknown", fit(7, "NOT_CONFIRMED", []))?.fitmentLevel).toBe("unknown")
    // Alan yok (1.2 yanıtı): CONFIRMED tam uyum, diğerleri bilinmiyor.
    const v12 = (exactFitment: unknown) =>
      parseGetirbakimProduct({ id: "1", name: "X", contractVersion: "1.2", exactFitment })
    expect(v12(fit(7, "CONFIRMED", [7]))?.fitmentLevel).toBe("guaranteed")
    expect(v12(fit(7, "NOT_CONFIRMED", []))?.fitmentLevel).toBe("unknown")
    expect(parseGetirbakimProduct({ id: "1", name: "X" })?.fitmentLevel).toBe("unknown")
  })

  test("fitmentLevel exactFitment'tan güçlü bir iddia taşıyamaz", () => {
    // Doğrulanmamış "guaranteed" → bilinmiyor; araç istenmeden "likely" → bilinmiyor.
    const dishonest = parseGetirbakimProduct({
      id: "1", name: "X", fitmentLevel: "guaranteed",
      exactFitment: { requestedVehicleTypeId: 7, status: "CONFIRMED", matchedVehicleTypeIds: [8] },
    })
    expect(dishonest?.fitmentLevel).toBe("unknown")
    expect(parseGetirbakimProduct({ id: "1", name: "X", fitmentLevel: "likely" })?.fitmentLevel).toBe("unknown")
    expect(parseGetirbakimProduct({ id: "1", name: "X", fitmentLevel: "ŞEY" })?.fitmentLevel).toBe("unknown")
    // CONFIRMED doğrulandıysa alan ne derse desin tam uyumlu.
    expect(parseGetirbakimProduct({
      id: "1", name: "X", fitmentLevel: "unknown",
      exactFitment: { requestedVehicleTypeId: 7, status: "CONFIRMED", matchedVehicleTypeIds: [7] },
    })?.fitmentLevel).toBe("guaranteed")
  })

  test("tanınmayan sözleşme sürümü null olur ama satır atılmaz", () => {
    const p = parseGetirbakimProduct({ id: "1", name: "X", contractVersion: "9.9" })
    expect(p?.contractVersion).toBeNull()
    expect(p?.name).toBe("X")
  })

  test("zorunlu alanı eksik satır null döner", () => {
    expect(parseGetirbakimProduct({ name: "id yok" })).toBeNull()
    expect(parseGetirbakimProduct({ id: "1" })).toBeNull()
    expect(parseGetirbakimProduct(null)).toBeNull()
    expect(parseGetirbakimProduct("metin")).toBeNull()
    expect(parseGetirbakimProduct({ id: "", name: "boş id" })).toBeNull()
  })

  test("negatif stok sıfıra çekilir", () => {
    expect(parseGetirbakimProduct({ id: "1", name: "X", stockQty: -3 })?.stockQty).toBe(0)
  })

  test("tanınmayan availability UNAVAILABLE'a düşer", () => {
    expect(parseGetirbakimProduct({ id: "1", name: "X", availability: "ŞEY" })?.availability).toBe(
      "UNAVAILABLE",
    )
    expect(parseGetirbakimProduct({ id: "1", name: "X", availability: "SUPPLYABLE" })?.availability).toBe(
      "SUPPLYABLE",
    )
  })

  test("oemNumbers metin olmayan öğeleri atar", () => {
    const p = parseGetirbakimProduct({ id: "1", name: "X", oemNumbers: ["A", 5, null, "B"] })
    expect(p?.oemNumbers).toEqual(["A", "B"])
  })

  test("oemNumbers dizi değilse boş listeye düşer", () => {
    expect(parseGetirbakimProduct({ id: "1", name: "X", oemNumbers: "A,B" })?.oemNumbers).toEqual([])
  })
})
