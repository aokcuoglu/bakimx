import { test, expect } from "bun:test"
import { fitDimensions } from "./fit-dimensions"

test("landscape büyük görsel uzun kenardan küçültülür", () => {
  expect(fitDimensions(4000, 3000, 1600)).toEqual({ w: 1600, h: 1200 })
})

test("portrait büyük görsel uzun kenardan küçültülür", () => {
  expect(fitDimensions(3000, 4000, 1600)).toEqual({ w: 1200, h: 1600 })
})

test("zaten küçük görsel büyütülmez", () => {
  expect(fitDimensions(800, 600, 1600)).toEqual({ w: 800, h: 600 })
})

test("tam sınırdaki görsel değişmez", () => {
  expect(fitDimensions(1600, 900, 1600)).toEqual({ w: 1600, h: 900 })
})

test("geçersiz boyut güvenli sıfır döner", () => {
  expect(fitDimensions(0, 100, 1600)).toEqual({ w: 0, h: 0 })
})
