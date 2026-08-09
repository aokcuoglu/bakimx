import { expect, test } from "bun:test"
import { deriveVinConfirmed } from "@/lib/vin/confirm"

const VALID = "WF0MXXGCHMRT73173"

test("geçerli 17 haneli VIN kendiliğinden teyit sayılır", () => {
  expect(deriveVinConfirmed(VALID)).toBe(true)
  // Normalizasyon: küçük harf / boşluk girişte de geçerli sayılmalı.
  expect(deriveVinConfirmed(" wf0mxxgchmrt73173 ")).toBe(true)
})

test("boş veya geçersiz VIN teyit üretmez", () => {
  expect(deriveVinConfirmed("")).toBe(false)
  expect(deriveVinConfirmed(null)).toBe(false)
  expect(deriveVinConfirmed(undefined)).toBe(false)
  expect(deriveVinConfirmed("1234")).toBe(false)
  // I/O/Q içeren 17 karakter ISO 3779'a göre geçersiz.
  expect(deriveVinConfirmed("WF0MXXGCHMRT7317I")).toBe(false)
})

test("elle teyit edilmiş kısa şase, VIN değişmediği sürece korunur", () => {
  const previous = { vin: "ESKI-SASI-42", vinConfirmed: true }
  expect(deriveVinConfirmed("ESKI-SASI-42", previous)).toBe(true)
  // Normalizasyon farkı (boşluk/küçük harf) aynı değer sayılır.
  expect(deriveVinConfirmed(" eski-sasi-42 ", previous)).toBe(true)
})

test("VIN değiştirilirse önceki teyit düşer", () => {
  const previous = { vin: "ESKI-SASI-42", vinConfirmed: true }
  expect(deriveVinConfirmed("YENI-SASI-99", previous)).toBe(false)
  expect(deriveVinConfirmed("", previous)).toBe(false)
})

test("önceki kayıt teyitsizse geçersiz VIN teyit üretmez", () => {
  expect(deriveVinConfirmed("ESKI-SASI-42", { vin: "ESKI-SASI-42", vinConfirmed: false })).toBe(false)
})

test("geçerli VIN önceki teyitsiz durumu ezer", () => {
  expect(deriveVinConfirmed(VALID, { vin: "ESKI", vinConfirmed: false })).toBe(true)
})
