import { expect, test } from "bun:test"
import { readFileSync } from "node:fs"
import { join } from "node:path"
import { createElement } from "react"
import { AppRouterContext } from "next/dist/shared/lib/app-router-context.shared-runtime"
import { renderToStaticMarkup } from "react-dom/server"
import { LoginForm } from "./login-form"

// #796 — /login ana sayfanın e-santral tasarım diliyle; davranış aynı kalır.
const router = { push: () => {}, replace: () => {}, refresh: () => {}, back: () => {}, forward: () => {}, prefetch: () => {} }
const render = (props: Parameters<typeof LoginForm>[0] = {}) =>
  renderToStaticMarkup(createElement(AppRouterContext.Provider, { value: router }, createElement(LoginForm, props)))

test("giriş formu kit alanlarını kullanır; kimlik alanı kullanıcı adını da kabul eder", () => {
  const html = render()
  const identifier = html.match(/<input[^>]*name="identifier"[^>]*>/)?.[0] ?? ""
  expect(identifier).toContain('type="text"')
  expect(identifier).toContain('autoComplete="username"')
  expect(identifier).toContain('placeholder=" "')
  expect(html).toContain("E-posta veya kullanıcı adı")
  expect(html).not.toContain('name="workshopCode"')
  expect(html).toMatch(/<input[^>]*name="password"[^>]*type="password"|<input[^>]*type="password"[^>]*name="password"/)
  expect(html).toContain(">Göster<")
})

test("başlık, birincil eylem ve bağlantılar", () => {
  const html = render()
  expect(html).toMatch(/<h1[^>]*>Giriş yap<\/h1>/)
  expect(html).toMatch(/<button[^>]*type="submit"[^>]*>Giriş yap<\/button>/)
  expect(html).toContain('href="/forgot-password"')
  expect(html).toContain("Şifremi unuttum ›")
  expect(html).toContain('href="/register"')
  expect(html).toContain("Ücretsiz deneyin ›")
})

test("oturum bildirimleri korunur", () => {
  expect(render({ expiredReason: "trial_expired" })).toContain('role="alert"')
  expect(render({ successNotice: "Satış hesabınız oluşturuldu." })).toContain("Satış hesabınız oluşturuldu.")
})

test("giriş sayfası eski kenar çubuğunu bırakıp ana sayfa bantlarını kullanır", () => {
  const site = join(import.meta.dir, "..", "..", "app", "(site)")
  const page = readFileSync(join(site, "(auth)", "login", "page.tsx"), "utf8")
  expect(page).not.toMatch(/LoginSidebar|sections\/Header|RegisterFooter/)
  expect(page).toContain("LandingFooter")
  // Üst bant ve kayıt penceresi sağlayıcısı (#798'den beri) (site) layout'unda.
  const layout = readFileSync(join(site, "layout.tsx"), "utf8")
  expect(layout).toContain("<SiteHeader />")
  expect(layout).toContain("<SignupDialogProvider>")
})
