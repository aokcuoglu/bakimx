import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const LEGAL_PAGE = readFileSync(
  join(import.meta.dir, "..", "components", "legal", "legal-page.tsx"),
  "utf8",
)

test("hukuki sayfalarda hover yalnızca üzerine gelinen linki etkiler", () => {
  expect(LEGAL_PAGE).toContain("[&_a:hover]:text-primary")
  expect(LEGAL_PAGE).not.toContain("hover:[&_a]:text-primary")
})
