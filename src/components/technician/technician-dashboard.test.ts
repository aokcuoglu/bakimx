import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const source = readFileSync(join(import.meta.dir, "technician-dashboard.tsx"), "utf8")

describe("teknisyen paneli KPI filtreleri", () => {
  test("beş KPI kartını klavye erişilebilir seçim kontrolü olarak sunar", () => {
    expect(source).toContain('type="button"')
    expect(source).toContain('aria-pressed={activeFilter === card.filter}')
    expect(source).toContain('onClick={() => handleFilterChange(card.filter)}')
  })

  test("filtreyi URL'de tutar ve teknisyen seçimini değiştirdiğinde korur", () => {
    expect(source).toContain('const DASHBOARD_FILTER_PARAM = "filter"')
    expect(source).toContain('new URLSearchParams(searchParams.toString())')
    expect(source).toContain('params.set(TECHNICIAN_PARAM, value)')
  })

  test("seçilen KPI için tek ilgili listeyi ve boş durumu gösterir", () => {
    expect(source).toContain('const visibleSections = activeFilter === "all"')
    expect(source).toContain('Bana Atanan İşler')
    expect(source).toContain('Bugün teslim edilecek iş bulunmuyor')
    expect(source).toContain('{visibleSections.map((section) => (')
  })
})
