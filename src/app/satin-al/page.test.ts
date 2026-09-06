import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const root = join(import.meta.dir, "../../..")

describe("public signup CTA unification", () => {
  test("satin-al redirects to the shared register wizard", () => {
    const source = readFileSync(join(root, "src/app/satin-al/page.tsx"), "utf8")
    expect(source).toContain('redirect(`/register?tier=${tier}&cycle=${cycle}`)')
    expect(source).not.toMatch(/import\s*\{[^}]*PurchaseWizard/)
  })

  test("fiyatlar package CTA uses register, not the old public checkout form", () => {
    const source = readFileSync(join(root, "src/app/fiyatlar/page.tsx"), "utf8")
    expect(source).toContain('checkoutBasePath="/register"')
    expect(source).not.toContain('checkoutBasePath="/satin-al"')
    expect(source).toContain("/register?tier=")
  })
})
