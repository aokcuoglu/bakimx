import { expect, test } from "bun:test"
import { PLATE_UNREADABLE_MESSAGE, plateScanResponse, shouldMatchBrand } from "./plate-scan-response"

/**
 * `/api/plate/scan` yanıt sözleşmesi (#840). Normal çağrıda davranış değişmez:
 * plaka okunamazsa 422. `allowNoPlate` yalnız yabancı plakalı araçta araç
 * fotoğrafı için gönderilir — kamera yabancı plakayı okumaz ama kare ve marka
 * yine de kabul edilir.
 */
test("plaka okunduysa 200: plaka ve varsa marka", () => {
  expect(plateScanResponse({ plate: "34KCK628", brand: "BMW", allowNoPlate: false })).toEqual({
    status: 200,
    body: { plate: "34KCK628", brand: "BMW" },
  })
  expect(plateScanResponse({ plate: "34KCK628", brand: null, allowNoPlate: false })).toEqual({
    status: 200,
    body: { plate: "34KCK628" },
  })
})

test("plaka okunamadıysa normal çağrı 422 alır (TR davranışı aynen)", () => {
  expect(plateScanResponse({ plate: null, brand: "BMW", allowNoPlate: false })).toEqual({
    status: 422,
    body: { error: PLATE_UNREADABLE_MESSAGE },
  })
})

test("allowNoPlate: plaka okunmasa da 200, marka varsa döner", () => {
  expect(plateScanResponse({ plate: null, brand: "BMW", allowNoPlate: true })).toEqual({
    status: 200,
    body: { brand: "BMW" },
  })
  expect(plateScanResponse({ plate: null, brand: null, allowNoPlate: true })).toEqual({
    status: 200,
    body: {},
  })
})

test("shouldMatchBrand: marka yalnız plaka okunduğunda ya da allowNoPlate ile eşlenir", () => {
  expect(shouldMatchBrand({ plate: "34KCK628", rawBrand: "BMW", allowNoPlate: false })).toBe(true)
  expect(shouldMatchBrand({ plate: null, rawBrand: "BMW", allowNoPlate: false })).toBe(false)
  expect(shouldMatchBrand({ plate: null, rawBrand: "BMW", allowNoPlate: true })).toBe(true)
  expect(shouldMatchBrand({ plate: null, rawBrand: "  ", allowNoPlate: true })).toBe(false)
})
