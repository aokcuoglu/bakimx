import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "../..")
const row = readFileSync(join(root, "components/parts/getirbakim-product-row.tsx"), "utf8")
const results = readFileSync(join(root, "components/parts/tecdoc-search-results.tsx"), "utf8")
const picker = readFileSync(join(root, "components/parts/tecdoc-part-picker.tsx"), "utf8")
const input = readFileSync(join(root, "components/parts/part-search-input.tsx"), "utf8")
const grid = readFileSync(join(root, "components/orders/parts-labor-grid.tsx"), "utf8")
const article = readFileSync(join(root, "components/parts/tecdoc-article-row.tsx"), "utf8")

test("GetirBakım satırı seçilebilir ve UNAVAILABLE satır seçilmez", () => {
  expect(row).toContain("onSelect?: () => void")
  expect(row).toContain("isGetirbakimSelectable")
  expect(row).toContain("<button type=\"button\" onClick={onSelect}")
  expect(row).toContain("GETIRBAKIM_SOURCE_LABEL")
})

test("TecDoc ve GetirBakım ayrı bölüm + kaynak rozeti ile ayrılır", () => {
  expect(results).toContain("TECDOC_SOURCE_LABEL")
  expect(results).toContain("GETIRBAKIM_SOURCE_LABEL")
  expect(results).toContain("nestGetirbakimUnderArticles")
  expect(results).not.toContain("visibleBakimx.length + visibleGetirbakim.length")
  expect(article).toContain("TECDOC_SOURCE_LABEL")
  expect(article).toContain("getirbakimMatches")
})

test("picker ve satır içi arama GetirBakım kalemini ekler", () => {
  expect(picker).toContain("onSelectGetirbakim")
  expect(input).toContain("onSelectGetirbakimProduct")
  expect(input).not.toContain("pointer-events-none block p-0")
  expect(grid).toContain("getirbakimDraft")
  expect(grid).toContain("onSelectGetirbakimProduct")
  expect(grid).toContain("onSelectGetirbakim")
  expect(grid).toContain('source: "getirbakim"')
})
