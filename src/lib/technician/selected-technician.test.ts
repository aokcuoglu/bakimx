import { expect, test } from "bun:test"
import { resolveSelectedTechnicianId } from "@/lib/technician/selected-technician"

const IDS = ["tech_1", "tech_2"]

test("geçerli id seçili teknisyen olur", () => {
  expect(resolveSelectedTechnicianId("tech_2", IDS)).toBe("tech_2")
})

test("boş değer ilk teknisyene düşer", () => {
  expect(resolveSelectedTechnicianId("", IDS)).toBe("tech_1")
  expect(resolveSelectedTechnicianId(null, IDS)).toBe("tech_1")
  expect(resolveSelectedTechnicianId(undefined, IDS)).toBe("tech_1")
})

test("sadece boşluk içeren değer ilk teknisyene düşer", () => {
  expect(resolveSelectedTechnicianId("   ", IDS)).toBe("tech_1")
})

test("atölyeye ait olmayan id ilk teknisyene düşer", () => {
  expect(resolveSelectedTechnicianId("baska_atolyenin_teknisyeni", IDS)).toBe("tech_1")
})

test("baştaki/sondaki boşluk kırpılır", () => {
  expect(resolveSelectedTechnicianId("  tech_2  ", IDS)).toBe("tech_2")
})

test("teknisyen listesi boşken seçim yapılmaz", () => {
  expect(resolveSelectedTechnicianId("tech_1", [])).toBeNull()
  expect(resolveSelectedTechnicianId("", [])).toBeNull()
})
