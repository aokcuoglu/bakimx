import { describe, expect, test } from "bun:test"
import { existsSync, readdirSync, readFileSync } from "node:fs"
import { join, relative } from "node:path"

/**
 * Giriş gerektirmeyen sayfaların üst bandı (#798) (site) layout'unda bir kez
 * render edilir. Bant bir sayfanın içine geri girerse sayfa geçişinde yeniden
 * mount olur ve o sayfada iki bant görünür; bu kaynak taraması ekranı açmadan
 * yakalar. Atölyenin müşterisine giden sayfalar gruba taşınırsa müşteri BakımX
 * pazarlama bandını görür; o da burada kırmızıya düşer.
 */
const ROOT = join(import.meta.dir, "..", "..", "..")
const SITE = join(ROOT, "src/app/(site)")
const read = (path: string) => readFileSync(path, "utf8")

function sourceFiles(dir: string): string[] {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name)
    if (entry.isDirectory()) return sourceFiles(path)
    return /\.tsx?$/.test(entry.name) && !/\.test\.ts$/.test(entry.name) ? [path] : []
  })
}

describe("(site) ortak üst bandı", () => {
  test("bant layout'ta bir kez render edilir", () => {
    const layout = read(join(SITE, "layout.tsx"))
    expect(layout).toContain("<SiteHeader />")
    expect(layout.match(/<SiteHeader \/>/g)).toHaveLength(1)
  })

  test("gruptaki rotalar kendi bandını basmaz", () => {
    const offenders = sourceFiles(SITE)
      .filter((file) => file !== join(SITE, "layout.tsx"))
      .filter((file) => /landing-header|site-header|LandingHeader|SiteHeader/.test(read(file)))
      .map((file) => relative(ROOT, file))
    expect(offenders).toEqual([])
  })

  test("kayıt penceresi sağlayıcısı yalnız layout'ta (bandın düğmesi de onu açar)", () => {
    // Sayfa kendi sağlayıcısını kurarsa iki pencere olur; bandın düğmesi dıştakini açar (#783).
    expect(read(join(SITE, "layout.tsx"))).toContain("<SignupDialogProvider>")
    const offenders = sourceFiles(SITE)
      .filter((file) => file !== join(SITE, "layout.tsx"))
      .filter((file) => read(file).includes("SignupDialogProvider"))
      .map((file) => relative(ROOT, file))
    expect(offenders).toEqual([])
  })

  test("public kabuklar bandı kendi içinde render etmez", () => {
    for (const file of [
      "src/components/public/PublicSite.tsx",
      "src/components/legal/legal-page.tsx",
      "src/components/auth/register-client.tsx",
    ]) {
      expect(read(join(ROOT, file))).not.toMatch(/landing-header|site-header|LandingHeader|SiteHeader/)
    }
  })

  test("bandın dinamik hedefi tam önceden yüklenir, loading.tsx ile yavaşlatılmaz", () => {
    // Ölçüm (#798): /login'e geçiş prefetch ile ~75–90 ms, (auth)/loading.tsx ile ~850 ms.
    const header = read(join(ROOT, "src/components/marketing/landing/landing-header.tsx"))
    expect(header).toMatch(/<Link className=\{styles\.login\} href="\/login" prefetch>/)
    expect(existsSync(join(SITE, "(auth)", "loading.tsx"))).toBe(false)
    expect(existsSync(join(SITE, "(auth)", "login", "loading.tsx"))).toBe(false)
    expect(existsSync(join(SITE, "(auth)", "register", "loading.tsx"))).toBe(false)
  })

  test("müşteriye giden ve ödeme rotaları grubun dışında kalır", () => {
    for (const route of ["p", "s", "w", "checkout", "satin-al", "payment", "invite", "admin-login"]) {
      expect(existsSync(join(SITE, route))).toBe(false)
      expect(existsSync(join(ROOT, "src/app", route))).toBe(true)
    }
  })
})
