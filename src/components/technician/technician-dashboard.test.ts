import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "technician-dashboard.tsx"), "utf8")
const quickActions = readFileSync(join(import.meta.dir, "technician-quick-actions.tsx"), "utf8")

describe("teknisyen kiosk ana ekranı", () => {
  test("dört bölüm başlığını içerir", () => {
    for (const title of ["İşlerim", "Atölyedeki diğer işler", "Taslak", "Bugün biten"]) {
      expect(source).toContain(title)
    }
    expect(source).toContain("Sana atanmış iş yok")
  })

  test("KPI filtre kartı ve Bana atananlar anahtarı yoktur", () => {
    expect(source).not.toContain("filter=")
    expect(source).not.toContain('"mine"')
    expect(source).not.toContain("Switch")
  })

  test("gruplar Collapsible ile açılır kapanır", () => {
    expect(source).toContain("<CollapsibleTrigger asChild>")
    expect(source).not.toContain("aria-expanded")
  })

  test("hızlı işlemler Button asChild + size=\"xl\"", () => {
    expect(quickActions).toContain("asChild")
    expect(quickActions).toContain('size="xl"')
    expect(quickActions).not.toContain("min-h-36")
  })

  test("iş kartı teknisyen iş ekranına gider", () => {
    expect(source).toContain("/technician/orders/")
  })
})
