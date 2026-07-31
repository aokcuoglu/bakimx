import { expect, test } from "bun:test"
import { LABOR_PRESETS, pickNewPresets } from "@/lib/labor/presets"

test("preset listesi 24 kalem ve hepsi kuruş tamsayı", () => {
  expect(LABOR_PRESETS).toHaveLength(24)
  for (const p of LABOR_PRESETS) {
    expect(Number.isInteger(p.defaultPriceKurus)).toBe(true)
    expect(p.defaultPriceKurus).toBeGreaterThan(0)
    expect(p.name.trim()).toBe(p.name)
  }
})

test("preset adları kendi içinde tekil", () => {
  const names = new Set(LABOR_PRESETS.map((p) => p.name))
  expect(names.size).toBe(LABOR_PRESETS.length)
})

test("mevcut olmayan tüm presetleri döndürür", () => {
  expect(pickNewPresets(LABOR_PRESETS, [])).toHaveLength(24)
})

test("mevcut adları atlar", () => {
  const res = pickNewPresets(LABOR_PRESETS, ["Buji değişimi"])
  expect(res).toHaveLength(23)
  expect(res.some((p) => p.name === "Buji değişimi")).toBe(false)
})

test("büyük/küçük harf ve boşluk farkına toleranslı", () => {
  const res = pickNewPresets(LABOR_PRESETS, ["  BUJİ DEĞİŞİMİ  "])
  expect(res).toHaveLength(23)
})

test("hepsi mevcutsa boş dizi döner", () => {
  const res = pickNewPresets(LABOR_PRESETS, LABOR_PRESETS.map((p) => p.name))
  expect(res).toEqual([])
})
