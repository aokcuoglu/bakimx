import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"

const read = (rel: string) => readFileSync(join(import.meta.dir, rel), "utf8")
const CSS = read("app-shell.module.css")
const SHELL = read("app-shell.tsx")
const BANNER = read("impersonation-banner.tsx")
const LAYOUT = read(join("..", "..", "app", "(app)", "layout.tsx"))

const rule = (selector: string) => {
  const start = CSS.indexOf(`${selector} {`)
  expect(start).toBeGreaterThanOrEqual(0)
  return CSS.slice(start, CSS.indexOf("}", start))
}

/**
 * #913 — yönetici taklit bandı (`sticky top-0 z-50`) yapışkan ofsetin dışındaydı:
 * üst bar (`sticky top-0 z-30`), araç kabulü çipleri ve ray bandın altında
 * kalıyordu. Bant sabit yükseklikte (40px) ve ofsete `--app-imp-h` olarak girer;
 * üst bar da aynı değişkenlerle yapışır.
 */
test("taklit bandı yapışkan ofsete girer, üst bar bandın altında yapışır", () => {
  expect(rule(".inset")).toContain("--app-imp-h: 0px")
  expect(rule(".inset")).toContain(
    "--app-sticky-top: calc(var(--app-bar-h) + var(--app-banner-h) + var(--app-imp-h))",
  )
  expect(rule(":global([data-impersonating]) .inset")).toContain("--app-imp-h: 40px")
  expect(rule(".bar")).toContain("top: calc(var(--app-banner-h) + var(--app-imp-h))")
  // Üst barın ofseti yalnız `.bar`dan: Tailwind `top-*` yazılırsa ikisi ayrışır.
  const header = SHELL.slice(SHELL.indexOf("function AppHeader("))
  const headerClass = header.slice(header.indexOf("<header"), header.indexOf(">", header.indexOf("<header")))
  expect(headerClass).toContain("shellStyles.bar")
  expect(headerClass).not.toMatch(/\btop-0\b|lg:top-8/)
  // Değişkendeki 40px bandın sınıfıyla aynı ölçü; bant tek satır, kırpılır.
  expect(BANNER).toContain("sticky top-0 z-50 flex h-10 items-center")
  expect(BANNER).not.toContain("py-2")
  expect(BANNER).toContain('className="min-w-0 truncate"')
  expect(LAYOUT).toContain('data-impersonating={impersonation ? "" : undefined}')
})

test("deneme şeridi ofseti değişmez: yalnız lg+ ve şerit görünürken 32px", () => {
  const lg = CSS.slice(CSS.indexOf("@media (min-width: 64rem) {\n  .inset {"))
  expect(lg).toContain(".inset[data-top-banner] {\n    --app-banner-h: 32px;")
  expect(SHELL).toContain('data-top-banner={topBannerVisible ? "" : undefined}')
})

/**
 * #913 düzeltme turu — taklit + deneme birlikteyken iki şerit de `top:0`a
 * yapışıyordu: deneme şeridi bandı örtüyor, üst bar (72px'e yapışan) altında
 * 32px boşluk kalıyordu. Şerit bandın yüksekliği kadar aşağıda yapışır ve bandın
 * altında katmanlanır; böylece `.bar`ın `--app-banner-h + --app-imp-h` hesabı
 * gerçek yığınla aynı.
 */
test("taklit ve deneme şeridi birlikteyken şerit bandın altına yapışır", () => {
  const strip = LAYOUT.slice(LAYOUT.indexOf("plan.isTrialing && plan.trialDaysLeft != null && ("))
  const cls = strip.slice(0, strip.indexOf(">"))
  expect(cls).toContain("lg:sticky")
  expect(cls).toContain('${impersonation ? "lg:top-10 lg:z-40" : "lg:top-0 lg:z-50"}')
  // Ölçüler tek yerden: şerit ofseti (top-10 = 40px) bandın h-10'u ve --app-imp-h ile aynı.
  expect(BANNER).toContain("h-10")
  expect(rule(":global([data-impersonating]) .inset")).toContain("--app-imp-h: 40px")
  // Bant şeridin üstünde katmanlanır.
  expect(BANNER).toContain("sticky top-0 z-50")
})
