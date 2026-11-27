import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "technician-dashboard.tsx"), "utf8")
const quickActions = readFileSync(join(import.meta.dir, "technician-quick-actions.tsx"), "utf8")

describe("teknisyen kiosk ana ekranı", () => {
  test("dört bölüm başlığını ve boş durumu içerir", () => {
    for (const title of ["İşlerim", "Atölyedeki diğer işler", "Taslak", "Bugün biten"]) {
      expect(source).toContain(title)
    }
    expect(source).toContain("Sana atanmış iş yok")
  })

  test("hızlı işlemler Button asChild + size=\"xl\" ve doğru hedefler", () => {
    expect(quickActions).toContain("asChild")
    expect(quickActions).toContain('size="xl"')
    expect(quickActions).toContain("/orders/new?entry=plate&from=technician")
    expect(quickActions).toContain("/technician/parts")
  })

  test("iş kartı teknisyen iş ekranına gider", () => {
    expect(source).toContain("/technician/orders/")
  })
})
