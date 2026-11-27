import { expect, test } from "bun:test"
import {
  canSelectAnyTechnician,
  resolveKioskFocusTechnicianId,
  resolveSelectedTechnicianId,
} from "@/lib/technician/selected-technician"

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

test("yönetici rolleri ekipteki teknisyenler arasında geçiş yapabilir", () => {
  expect(canSelectAnyTechnician("owner")).toBe(true)
  expect(canSelectAnyTechnician("manager")).toBe(true)
})

test("saha rolleri yalnız kendi teknisyen kaydını görür", () => {
  expect(canSelectAnyTechnician("usta")).toBe(false)
  expect(canSelectAnyTechnician("cirak")).toBe(false)
  expect(canSelectAnyTechnician("staff")).toBe(false)
})

test("kiosk odağı: saha rolü yabancı ?technician'ı yok sayıp kendini alır", () => {
  expect(
    resolveKioskFocusTechnicianId({ canSelect: false, requested: "tech_2", ownTechnicianId: "tech_1", activeIds: IDS })
  ).toBe("tech_1")
})

test("kiosk odağı: saha rolünün kaydı yoksa ya da pasifse null", () => {
  expect(
    resolveKioskFocusTechnicianId({ canSelect: false, requested: null, ownTechnicianId: null, activeIds: IDS })
  ).toBeNull()
  expect(
    resolveKioskFocusTechnicianId({ canSelect: false, requested: null, ownTechnicianId: "gone", activeIds: IDS })
  ).toBeNull()
})

test("kiosk odağı: yönetici param vermezse ya da geçersiz verirse ilk aktif teknisyen", () => {
  expect(
    resolveKioskFocusTechnicianId({ canSelect: true, requested: undefined, ownTechnicianId: null, activeIds: IDS })
  ).toBe("tech_1")
  expect(
    resolveKioskFocusTechnicianId({ canSelect: true, requested: "other_ws", ownTechnicianId: null, activeIds: IDS })
  ).toBe("tech_1")
  expect(
    resolveKioskFocusTechnicianId({ canSelect: true, requested: "tech_2", ownTechnicianId: null, activeIds: IDS })
  ).toBe("tech_2")
})
