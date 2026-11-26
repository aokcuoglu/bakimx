import { describe, expect, test } from "bun:test"
import { readFileSync } from "node:fs"

const read = (p: string) => readFileSync(new URL(p, import.meta.url), "utf8")

// #892 — gerçek davranış e2e/detail-scroll-top.e2e.ts'te; burada mekanizma sabitlenir.
describe("ScrollToTopOnNavigate (#892)", () => {
  const source = read("./scroll-to-top-on-navigate.tsx")

  test("yalnız pathname değişince en üste kaydırır", () => {
    expect(source).toContain("usePathname")
    expect(source).toContain('behavior: "instant"')
    expect(source).not.toContain("useSearchParams")
  })

  test("tarayıcı geri/ileri geçişinde konuma dokunmaz", () => {
    expect(source).toContain('"popstate"')
  })

  test("kalıcı kabukta mount edilir", () => {
    expect(read("./app-shell.tsx")).toContain("<ScrollToTopOnNavigate />")
  })
})
