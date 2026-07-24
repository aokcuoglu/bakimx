import { expect, test } from "bun:test"
import { resolveTechnicianFilter, UNASSIGNED_TECHNICIAN } from "@/lib/orders/technician-filter"

const IDS = ["tech_1", "tech_2"]

test("boş değer filtre üretmez", () => {
  expect(resolveTechnicianFilter("", IDS)).toEqual({ value: "", where: {} })
  expect(resolveTechnicianFilter(null, IDS)).toEqual({ value: "", where: {} })
  expect(resolveTechnicianFilter(undefined, IDS)).toEqual({ value: "", where: {} })
})

test("sadece boşluk içeren değer filtre üretmez", () => {
  expect(resolveTechnicianFilter("   ", IDS)).toEqual({ value: "", where: {} })
})

test("'none' atanmamış emirleri filtreler", () => {
  expect(resolveTechnicianFilter(UNASSIGNED_TECHNICIAN, IDS)).toEqual({
    value: "none",
    where: { assignedTechnicianId: null },
  })
})

test("geçerli usta id'si o ustaya atanmışları filtreler", () => {
  expect(resolveTechnicianFilter("tech_2", IDS)).toEqual({
    value: "tech_2",
    where: { assignedTechnicianId: "tech_2" },
  })
})

test("atölyeye ait olmayan id filtreyi düşürür", () => {
  expect(resolveTechnicianFilter("baska_atolyenin_ustasi", IDS)).toEqual({ value: "", where: {} })
})

test("usta listesi boşken hiçbir id kabul edilmez ama 'none' çalışır", () => {
  expect(resolveTechnicianFilter("tech_1", [])).toEqual({ value: "", where: {} })
  expect(resolveTechnicianFilter(UNASSIGNED_TECHNICIAN, [])).toEqual({
    value: "none",
    where: { assignedTechnicianId: null },
  })
})

test("baştaki/sondaki boşluk kırpılır", () => {
  expect(resolveTechnicianFilter("  tech_1  ", IDS)).toEqual({
    value: "tech_1",
    where: { assignedTechnicianId: "tech_1" },
  })
})
