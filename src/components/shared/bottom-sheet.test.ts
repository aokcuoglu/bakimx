import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (p: string) => readFileSync(p, "utf8")

describe("alt sayfa kapatma düğmesi (#1060)", () => {
  test("BottomSheet Sheet'in kendi kapatma düğmesini gizlemez", () => {
    expect(read("src/components/shared/bottom-sheet.tsx")).not.toContain("showCloseButton={false}")
  })

  test("Sheet kapatma düğmesi Türkçe adlı ve telefonda 44px (size=icon)", () => {
    const sheet = read("src/components/ui/sheet.tsx")
    expect(sheet).toContain('<span className="sr-only">Kapat</span>')
    expect(sheet).not.toContain('size="icon-sm"')
  })

  test("iş ekranı alt sayfaları showCloseButton={false} vermez", () => {
    for (const f of [
      "src/components/technician/work-screen/work-sheets.tsx",
      "src/components/technician/technician-order-detail.tsx",
      "src/components/orders/parts-labor-grid.tsx",
    ]) {
      expect(read(f)).not.toContain("showCloseButton={false}")
    }
  })
})
